import { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import { Program, AnchorProvider, web3, utils, Wallet } from '@coral-xyz/anchor';
import { IDL } from './types';

export type { OpenclawPrivacyProtocol } from './types';

export interface AgentRegistration {
  agentName: string;
  encryptionKeypair: Keypair;
  capabilities: string[];
}

export interface PrivateChannel {
  channelId: string;
  participants: PublicKey[];
  encryptedMetadata: Uint8Array;
}

export interface EncryptedMessage {
  messageId: string;
  encryptedContent: Uint8Array;
  recipient: PublicKey;
}

export interface ShieldedTransfer {
  amountCommitment: Uint8Array;
  nullifier: Uint8Array;
  proof: Uint8Array;
}

export class OCPClient {
  program: Program;
  provider: AnchorProvider;

  readonly PROTOCOL_CONFIG_SEED = "protocol_config";
  readonly AGENT_SEED = "agent";
  readonly CHANNEL_SEED = "channel";
  readonly MESSAGE_SEED = "message";
  readonly BALANCE_SEED = "shielded_balance";

  static readonly PROGRAM_ID = new PublicKey('ocpP8j4zpgC9fqc3J2y6V3x9K1mNpRrL');

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(IDL, OCPClient.PROGRAM_ID, provider);
  }

  static create(connection: Connection, wallet: Wallet): OCPClient {
    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: 'processed',
      commitment: 'processed',
    });
    return new OCPClient(provider);
  }

  async initializeProtocol(authority: Keypair): Promise<string> {
    const [protocolConfig] = this.findProtocolConfigAddress();
    
    const tx = await this.program.methods
      .initializeProtocol()
      .accounts({
        protocolConfig,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  async registerAgent(
    owner: Keypair,
    agentName: string,
    encryptionKeypair: Keypair,
    capabilities: string[]
  ): Promise<{ tx: string; agent: PublicKey }> {
    const [agent] = this.findAgentAddress(owner.publicKey);
    
    const encryptionPubkey = encryptionKeypair.secretKey.slice(32, 64);
    
    const tx = await this.program.methods
      .registerAgent(agentName, encryptionPubkey, capabilities)
      .accounts({
        agent,
        owner: owner.publicKey,
        protocolConfig: await this.getProtocolConfigAddress(),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, agent };
  }

  async createPrivateChannel(
    creator: Keypair,
    channelId: string,
    participants: PublicKey[],
    encryptedMetadata: Uint8Array
  ): Promise<{ tx: string; channel: PublicKey }> {
    const [channel] = this.findChannelAddress(creator.publicKey, channelId);
    
    const tx = await this.program.methods
      .createPrivateChannel(channelId, participants, Array.from(encryptedMetadata))
      .accounts({
        channel,
        creator: creator.publicKey,
        protocolConfig: await this.getProtocolConfigAddress(),
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    return { tx, channel };
  }

  async sendEncryptedMessage(
    sender: Keypair,
    channel: PublicKey,
    messageId: string,
    encryptedContent: Uint8Array,
    recipient: PublicKey
  ): Promise<string> {
    const [message] = this.findMessageAddress(channel, sender.publicKey, messageId);
    
    const channelData = await this.program.account.privateChannel.fetch(channel);
    if (!channelData.isActive) {
      throw new Error("Channel is inactive");
    }
    
    if (!channelData.participants.find(p => p.equals(sender.publicKey))) {
      throw new Error("Sender is not a participant in this channel");
    }
    
    if (!channelData.participants.find(p => p.equals(recipient))) {
      throw new Error("Recipient is not a participant in this channel");
    }

    const tx = await this.program.methods
      .sendEncryptedMessage(messageId, Array.from(encryptedContent), recipient)
      .accounts({
        message,
        sender: sender.publicKey,
        channel,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    return tx;
  }

  async initializeShieldedBalance(
    owner: Keypair,
    mint: PublicKey
  ): Promise<{ tx: string; balance: PublicKey }> {
    const [balance] = this.findShieldedBalanceAddress(owner.publicKey, mint);
    
    const tx = await this.program.methods
      .initializeShieldedBalance(mint)
      .accounts({
        shieldedBalance: balance,
        owner: owner.publicKey,
        mint,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    return { tx, balance };
  }

  async executeShieldedTransfer(
    sender: Keypair,
    senderBalance: PublicKey,
    recipientBalance: PublicKey,
    transfer: ShieldedTransfer
  ): Promise<string> {
    const tx = await this.program.methods
      .shieldedTransfer(
        Array.from(transfer.amountCommitment),
        Array.from(transfer.nullifier),
        Array.from(transfer.proof)
      )
      .accounts({
        senderBalance,
        recipientBalance,
        sender: sender.publicKey,
      })
      .signers([sender])
      .rpc();

    return tx;
  }

  async updateAgentCapabilities(
    owner: Keypair,
    agent: PublicKey,
    newCapabilities: string[]
  ): Promise<string> {
    const tx = await this.program.methods
      .updateAgentCapabilities(newCapabilities)
      .accounts({
        agent,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    return tx;
  }

  async closePrivateChannel(
    creator: Keypair,
    channel: PublicKey
  ): Promise<string> {
    const channelData = await this.program.account.privateChannel.fetch(channel);
    if (channelData.creator.toString() !== creator.publicKey.toString()) {
      throw new Error("Only channel creator can close the channel");
    }

    const tx = await this.program.methods
      .closePrivateChannel()
      .accounts({
        channel,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    return tx;
  }

  async getAgent(agent: PublicKey): Promise<any> {
    return await this.program.account.agent.fetch(agent);
  }

  async getChannel(channel: PublicKey): Promise<any> {
    return await this.program.account.privateChannel.fetch(channel);
  }

  async getMessage(message: PublicKey): Promise<any> {
    return await this.program.account.encryptedMessage.fetch(message);
  }

  async getShieldedBalance(balance: PublicKey): Promise<any> {
    return await this.program.account.shieldedBalance.fetch(balance);
  }

  findProtocolConfigAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.PROTOCOL_CONFIG_SEED)],
      this.program.programId
    );
  }

  findAgentAddress(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.AGENT_SEED), owner.toBuffer()],
      this.program.programId
    );
  }

  findChannelAddress(creator: PublicKey, channelId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.CHANNEL_SEED), creator.toBuffer(), Buffer.from(channelId)],
      this.program.programId
    );
  }

  findMessageAddress(
    channel: PublicKey,
    sender: PublicKey,
    messageId: string
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.MESSAGE_SEED), channel.toBuffer(), sender.toBuffer(), Buffer.from(messageId)],
      this.program.programId
    );
  }

  findShieldedBalanceAddress(owner: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.BALANCE_SEED), owner.toBuffer(), mint.toBuffer()],
      this.program.programId
    );
  }

  async getProtocolConfigAddress(): Promise<PublicKey> {
    const [protocolConfig] = this.findProtocolConfigAddress();
    return protocolConfig;
  }

  generateEncryptionKeypair(): Keypair {
    return Keypair.generate();
  }

  encryptMessage(
    content: string,
    recipientEncryptionPubkey: Uint8Array,
    senderEncryptionKeypair: Keypair
  ): { ciphertext: Uint8Array; nonce: Uint8Array } {
    const messageBytes = new TextEncoder().encode(content);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    
    const sharedSecret = nacl.box.before(recipientEncryptionPubkey, senderEncryptionKeypair.secretKey);
    const ciphertext = nacl.secretbox(messageBytes, nonce, sharedSecret);
    
    return { ciphertext, nonce };
  }

  decryptMessage(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    senderEncryptionPubkey: Uint8Array,
    recipientEncryptionKeypair: Keypair
  ): string {
    const sharedSecret = nacl.box.before(senderEncryptionPubkey, recipientEncryptionKeypair.secretKey);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
    
    if (!decrypted) {
      throw new Error("Failed to decrypt message");
    }
    
    return new TextDecoder().decode(decrypted);
  }

  createAmountCommitment(amount: number, nonce: Uint8Array): Uint8Array {
    const amountBytes = new TextEncoder().encode(amount.toString());
    const combined = new Uint8Array(amountBytes.length + nonce.length);
    combined.set(amountBytes);
    combined.set(nonce, amountBytes.length);
    
    return nacl.hash(combined).slice(0, 32);
  }

  generateNullifier(): Uint8Array {
    return nacl.randomBytes(32);
  }
}