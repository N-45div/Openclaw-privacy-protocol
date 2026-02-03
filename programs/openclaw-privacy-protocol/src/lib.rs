use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use anchor_spl::token::{TokenAccount, Mint, Token, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use std::mem::size_of;

declare_id!("ocpP8j4zpgC9fqc3J2y6V3x9K1mNpRrL");

#[program]
pub mod openclaw_privacy_protocol {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_config;
        protocol.authority = ctx.accounts.authority.key();
        protocol.initialized = true;
        protocol.total_agents = 0;
        protocol.total_channels = 0;
        protocol.paused = false;
        
        emit!(ProtocolInitialized {
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_name: String,
        encryption_pubkey: [u8; 32],
        capabilities: Vec<String>,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(agent_name.len() <= 64, ErrorCode::NameTooLong);
        require!(capabilities.len() <= 10, ErrorCode::TooManyCapabilities);
        
        let agent = &mut ctx.accounts.agent;
        agent.owner = ctx.accounts.owner.key();
        agent.name = agent_name;
        agent.encryption_pubkey = encryption_pubkey;
        agent.encryption_nonce = 0;
        agent.capabilities = capabilities;
        agent.reputation_score = 0;
        agent.total_tasks_completed = 0;
        agent.registered_at = Clock::get()?.unix_timestamp;
        agent.is_active = true;
        
        let protocol = &mut ctx.accounts.protocol_config;
        protocol.total_agents = protocol.total_agents.checked_add(1).unwrap();
        
        emit!(AgentRegistered {
            agent: ctx.accounts.agent.key(),
            owner: ctx.accounts.owner.key(),
            name: agent.name.clone(),
            timestamp: agent.registered_at,
        });
        
        Ok(())
    }

    pub fn create_private_channel(
        ctx: Context<CreatePrivateChannel>,
        channel_id: String,
        mut participants: Vec<Pubkey>,
        encrypted_metadata: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(channel_id.len() <= 128, ErrorCode::ChannelIdTooLong);
        require!(participants.len() >= 2 && participants.len() <= 10, ErrorCode::InvalidParticipants);
        require!(encrypted_metadata.len() <= 512, ErrorCode::MetadataTooLarge);
        
        // SECURITY: Creator must be in participants list (prevent orphaned channels)
        let creator_key = ctx.accounts.creator.key();
        if !participants.contains(&creator_key) {
            participants.push(creator_key);
        }
        
        // Remove duplicates to prevent manipulation
        participants.sort();
        participants.dedup();
        require!(participants.len() >= 2, ErrorCode::InvalidParticipants);
        
        let channel = &mut ctx.accounts.channel;
        channel.creator = ctx.accounts.creator.key();
        channel.channel_id = channel_id;
        channel.participants = participants;
        channel.encrypted_metadata = encrypted_metadata;
        channel.message_count = 0;
        channel.created_at = Clock::get()?.unix_timestamp;
        channel.is_active = true;
        
        let protocol = &mut ctx.accounts.protocol_config;
        protocol.total_channels = protocol.total_channels.checked_add(1).unwrap();
        
        emit!(PrivateChannelCreated {
            channel: channel.key(),
            creator: channel.creator,
            participants: channel.participants.clone(),
            timestamp: channel.created_at,
        });
        
        Ok(())
    }

    pub fn send_encrypted_message(
        ctx: Context<SendEncryptedMessage>,
        message_id: String,
        encrypted_content: Vec<u8>,
        recipient: Pubkey,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(message_id.len() <= 128, ErrorCode::MessageIdTooLong);
        require!(encrypted_content.len() <= 2048, ErrorCode::MessageTooLarge);
        
        // CRITICAL: Prevent sending messages to yourself
        require!(
            recipient != ctx.accounts.sender.key(),
            ErrorCode::InvalidRecipient
        );
        
        let channel = &ctx.accounts.channel;
        require!(channel.is_active, ErrorCode::ChannelInactive);
        
        let sender = ctx.accounts.sender.key();
        require!(channel.participants.contains(&sender), ErrorCode::NotAParticipant);
        require!(channel.participants.contains(&recipient), ErrorCode::InvalidRecipient);
        
        let message = &mut ctx.accounts.message;
        message.channel = channel.key();
        message.message_id = message_id;
        message.sender = sender;
        message.recipient = recipient;
        message.encrypted_content = encrypted_content;
        message.timestamp = Clock::get()?.unix_timestamp;
        message.delivered = false;
        
        emit!(EncryptedMessageSent {
            message: message.key(),
            channel: channel.key(),
            sender,
            recipient,
            message_id: message.message_id.clone(),
            timestamp: message.timestamp,
        });
        
        Ok(())
    }

    pub fn initialize_shielded_balance(
        ctx: Context<InitializeShieldedBalance>,
        mint: Pubkey,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        
        let balance = &mut ctx.accounts.shielded_balance;
        balance.owner = ctx.accounts.owner.key();
        balance.mint = mint;
        balance.commitment = [0u8; 32];
        balance.pending_transfers = Vec::new();
        balance.nonce = 0;
        
        emit!(ShieldedBalanceInitialized {
            balance_account: balance.key(),
            owner: balance.owner,
            mint,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn shielded_transfer(
        ctx: Context<ShieldedTransfer>,
        amount_commitment: [u8; 32],
        nullifier: [u8; 32],
        proof: Vec<u8>,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(proof.len() <= 1024, ErrorCode::ProofTooLarge);
        
        // CRITICAL: Check for duplicate accounts to prevent self-transfers and double-spending
        require!(
            ctx.accounts.sender_balance.key() != ctx.accounts.recipient_balance.key(),
            ErrorCode::DuplicateBalanceAccounts
        );
        
        let sender_balance = &mut ctx.accounts.sender_balance;
        let recipient_balance = &mut ctx.accounts.recipient_balance;
        
        // Validate account relationships - sender must own the sender_balance
        require!(
            sender_balance.owner == ctx.accounts.sender.key(),
            ErrorCode::InvalidBalanceOwner
        );
        
        require!(sender_balance.nonce < u64::MAX, ErrorCode::NonceOverflow);
        require!(recipient_balance.nonce < u64::MAX, ErrorCode::NonceOverflow);
        
        // Validate mint tokens match
        require!(
            sender_balance.mint == recipient_balance.mint,
            ErrorCode::MintMismatch
        );
        
        sender_balance.nonce = sender_balance.nonce.checked_add(1).unwrap();
        recipient_balance.pending_transfers.push(ShieldedTransferRecord {
            amount_commitment,
            nullifier,
            from: ctx.accounts.sender.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        emit!(ShieldedTransferExecuted {
            sender_balance: sender_balance.key(),
            recipient_balance: recipient_balance.key(),
            nullifier,
            amount_commitment,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn update_agent_capabilities(
        ctx: Context<UpdateAgentCapabilities>,
        new_capabilities: Vec<String>,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(new_capabilities.len() <= 10, ErrorCode::TooManyCapabilities);
        
        let agent = &mut ctx.accounts.agent;
        agent.capabilities = new_capabilities;
        agent.encryption_nonce = agent.encryption_nonce.checked_add(1).unwrap();
        
        emit!(AgentCapabilitiesUpdated {
            agent: agent.key(),
            owner: agent.owner,
            capabilities: agent.capabilities.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn close_private_channel(ctx: Context<ClosePrivateChannel>) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        let channel = &mut ctx.accounts.channel;
        require!(channel.creator == ctx.accounts.creator.key(), ErrorCode::Unauthorized);
        require!(channel.is_active, ErrorCode::ChannelInactive);
        
        channel.is_active = false;
        
        emit!(PrivateChannelClosed {
            channel: channel.key(),
            creator: channel.creator,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    pub fn set_protocol_pause(
        ctx: Context<SetProtocolPause>,
        paused: bool,
    ) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_config;
        require!(ctx.accounts.authority.key() == protocol.authority, ErrorCode::Unauthorized);
        
        protocol.paused = paused;
        
        emit!(ProtocolPauseChanged {
            authority: ctx.accounts.authority.key(),
            paused,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    pub fn send_devnet_tokens(
        ctx: Context<SendDevnetTokens>,
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let sender_token_account = &ctx.accounts.sender_token_account;
        let recipient_token_account = &ctx.accounts.recipient_token_account;
        
        // Validate token accounts have correct mint
        require!(sender_token_account.mint == ctx.accounts.mint.key(), ErrorCode::MintMismatch);
        require!(recipient_token_account.mint == ctx.accounts.mint.key(), ErrorCode::MintMismatch);
        
        // Validate sender has enough balance
        require!(sender_token_account.amount >= amount, ErrorCode::InsufficientBalance);
        
        // Validate sender is Signer
        require!(ctx.accounts.sender.is_signer, ErrorCode::MissingRequiredSignature);
        
        // Perform the transfer
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        anchor_spl::token::transfer(cpi_ctx, amount)?;
        
        emit!(DevnetTokensSent {
            sender: ctx.accounts.sender.key(),
            recipient: recipient_token_account.owner,
            mint: ctx.accounts.mint.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = size_of::<ProtocolConfig>() + 8,
        // Rent-exempt: ensure account has minimum lamports
        rent_exempt = enforce
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_name: String, encryption_pubkey: [u8; 32], capabilities: Vec<String>)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = size_of::<Agent>() + 64 + (capabilities.len() * 32) + 8,
        seeds = [b"agent", owner.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(channel_id: String, participants: Vec<Pubkey>, encrypted_metadata: Vec<u8>)]
pub struct CreatePrivateChannel<'info> {
    #[account(
        init,
        payer = creator,
        space = size_of::<PrivateChannel>() + 48 + channel_id.len() + encrypted_metadata.len() + (participants.len() * 32) + 8,
        seeds = [b"channel", creator.key().as_ref(), channel_id.as_bytes()],
        bump
    )]
    pub channel: Account<'info, PrivateChannel>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(message_id: String, encrypted_content: Vec<u8>, recipient: Pubkey)]
pub struct SendEncryptedMessage<'info> {
    #[account(
        init,
        payer = sender,
        space = size_of::<EncryptedMessage>() + 48 + message_id.len() + encrypted_content.len() + 8,
        seeds = [b"message", channel.key().as_ref(), sender.key().as_ref(), message_id.as_bytes()],
        bump
    )]
    pub message: Account<'info, EncryptedMessage>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub channel: Account<'info, PrivateChannel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeShieldedBalance<'info> {
    #[account(
        init,
        payer = owner,
        space = size_of::<ShieldedBalance>() + 8,
        seeds = [b"shielded_balance", owner.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub shielded_balance: Account<'info, ShieldedBalance>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Mint account
    pub mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShieldedTransfer<'info> {
    #[account(
        mut,
        constraint = sender_balance.owner == sender.key() @ ErrorCode::InvalidBalanceOwner
    )]
    pub sender_balance: Account<'info, ShieldedBalance>,
    #[account(mut)]
    pub recipient_balance: Account<'info, ShieldedBalance>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct UpdateAgentCapabilities<'info> {
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub agent: Account<'info, Agent>,
    pub owner: Signer<'info>,
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct ClosePrivateChannel<'info> {
    #[account(mut)]
    pub channel: Account<'info, PrivateChannel>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct SetProtocolPause<'info> {
    #[account(mut)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub initialized: bool,
    pub paused: bool,
    pub total_agents: u64,
    pub total_channels: u64,
}

#[account]
pub struct Agent {
    pub owner: Pubkey,
    pub name: String,
    pub encryption_pubkey: [u8; 32],
    pub encryption_nonce: u64,
    pub capabilities: Vec<String>,
    pub reputation_score: i64,
    pub total_tasks_completed: u64,
    pub registered_at: i64,
    pub is_active: bool,
}

#[account]
pub struct PrivateChannel {
    pub creator: Pubkey,
    pub channel_id: String,
    pub participants: Vec<Pubkey>,
    pub encrypted_metadata: Vec<u8>,
    pub message_count: u64,
    pub created_at: i64,
    pub is_active: bool,
}

#[account]
pub struct EncryptedMessage {
    pub channel: Pubkey,
    pub message_id: String,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub encrypted_content: Vec<u8>,
    pub timestamp: i64,
    pub delivered: bool,
}

#[account]
pub struct ShieldedBalance {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub commitment: [u8; 32],
    pub pending_transfers: Vec<ShieldedTransferRecord>,
    pub nonce: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ShieldedTransferRecord {
    pub amount_commitment: [u8; 32],
    pub nullifier: [u8; 32],
    pub from: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub name: String,
    pub timestamp: i64,
}

#[event]
pub struct PrivateChannelCreated {
    pub channel: Pubkey,
    pub creator: Pubkey,
    pub participants: Vec<Pubkey>,
    pub timestamp: i64,
}

#[event]
pub struct EncryptedMessageSent {
    pub message: Pubkey,
    pub channel: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub message_id: String,
    pub timestamp: i64,
}

#[event]
pub struct ShieldedBalanceInitialized {
    pub balance_account: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ShieldedTransferExecuted {
    pub sender_balance: Pubkey,
    pub recipient_balance: Pubkey,
    pub nullifier: [u8; 32],
    pub amount_commitment: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct AgentCapabilitiesUpdated {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub capabilities: Vec<String>,
    pub timestamp: i64,
}

#[event]
pub struct PrivateChannelClosed {
    pub channel: Pubkey,
    pub creator: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolPauseChanged {
    pub authority: Pubkey,
    pub paused: bool,
    pub timestamp: i64,
}

#[event]
pub struct DevnetTokensSent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Too many capabilities")]
    TooManyCapabilities,
    #[msg("Channel ID too long")]
    ChannelIdTooLong,
    #[msg("Invalid number of participants")]
    InvalidParticipants,
    #[msg("Metadata too large")]
    MetadataTooLarge,
    #[msg("Not a participant in this channel")]
    NotAParticipant,
    #[msg("Invalid recipient")]
    InvalidRecipient,
    #[msg("Channel is inactive")]
    ChannelInactive,
    #[msg("Message ID too long")]
    MessageIdTooLong,
    #[msg("Message too large")]
    MessageTooLarge,
    #[msg("Proof too large")]
    ProofTooLarge,
    #[msg("Nonce overflow")]
    NonceOverflow,
    #[msg("Unauthorized operation")]
    Unauthorized,
    #[msg("Sender and recipient balance accounts must be different")]
    DuplicateBalanceAccounts,
    #[msg("Sender does not own the sender balance account")]
    InvalidBalanceOwner,
    #[msg("Mint tokens do not match between balance accounts")]
    MintMismatch,
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
    #[msg("Missing required signature")]
    MissingRequiredSignature,
}
