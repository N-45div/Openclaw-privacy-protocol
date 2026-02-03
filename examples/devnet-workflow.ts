// Import OCP SDK
import { OCPClient } from './src';
import { Connection, clusterApiUrl, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';

/**
 * Devnet Token Testing Guide for OCPP
 * 
 * Prerequisites:
 * 1. Solana CLI installed and configured for devnet
 * 2. Anchor installed
 * 3. Devnet SOL in your wallet (~2-3 SOL)
 * 4. Program deployed to devnet
 */

export class DevnetTokenWorkflow {
  private connection: Connection;
  private ocpClient: OCPClient;
  private wallet: Keypair;
  
  // Devnet token mints
  private readonly DEVNET_TOKENS = {
    USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // Devnet USDC
    wSOL: new PublicKey('So11111111111111111111111111111111111111112'),  // Wrapped SOL
  };
  
  constructor(wallet: Keypair) {
    this.connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    this.wallet = wallet;
    this.ocpClient = OCPClient.create(this.connection, { publicKey: wallet.publicKey } as any);
  }
  
  /**
   * Step 1: Initialize protocol (owner only, done once)
   */
  async initializeProtocol(): Promise<string> {
    console.log("📋 Initializing OCPP protocol...");
    const tx = await this.ocpClient.initializeProtocol(this.wallet);
    console.log("✅ Protocol initialized:", tx);
    return tx;
  }
  
  /**
   * Step 2: Register your agent
   */
  async registerAgent(agentName: string, capabilities: string[]): Promise<PublicKey> {
    console.log(`🤖 Registering agent: ${agentName}...`);
    
    const encryptionKeypair = this.ocpClient.generateEncryptionKeypair();
    const { agent } = await this.ocpClient.registerAgent(
      this.wallet,
      agentName,
      encryptionKeypair,
      capabilities
    );
    
    console.log("✅ Agent registered:", agent.toString());
    return agent;
  }
  
  /**
   * Step 3: Request devnet tokens (airdrop or faucet)
   */
  async fundWallet(amountSOL: number = 2): Promise<void> {
    console.log(`💰 Funding wallet with ${amountSOL} SOL...`);
    
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    console.log("Current balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    if (balance < amountSOL * LAMPORTS_PER_SOL) {
      console.log("Requesting airdrop...");
      const airdropSignature = await this.connection.requestAirdrop(
        this.wallet.publicKey,
        amountSOL * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(airdropSignature);
      console.log("✅ Airdrop received");
    }
  }
  
  /**
   * Step 4: Get devnet USDC (or other tokens)
   */
  async getDevnetTokens(
    mint: PublicKey,
    amount: number
  ): Promise<PublicKey> {
    console.log(`Getting ${amount} tokens...`);
    
    // Get or create associated token account
    const tokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey
    );
    
    // Check if account exists
    const accountInfo = await this.connection.getAccountInfo(tokenAccount);
    
    if (!accountInfo) {
      console.log("Creating token account...");
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          tokenAccount,
          this.wallet.publicKey,
          mint
        )
      );
      
      await this.connection.sendTransaction(tx, [this.wallet]);
      console.log("✅ Token account created:", tokenAccount.toString());
    }
    
    // For devnet, you'd typically use a faucet or mint directly
    // This is a placeholder - in real scenario, use faucet or mint tokens
    console.log("ℹ️  Note: On devnet, use token faucet to get USDC/wSOL");
    
    return tokenAccount;
  }
  
  /**
   * Step 5: Send tokens to another agent
   */
  async sendTokensToAgent(
    recipientAgent: PublicKey,
    mint: PublicKey,
    amount: number
  ): Promise<string> {
    console.log(`Sending ${amount} tokens to agent...`);
    
    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey
    );
    
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mint,
      recipientAgent
    );
    
    // Check if recipient has token account
    const recipientAccountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
    
    let tx = new Transaction();
    
    if (!recipientAccountInfo) {
      console.log("Creating recipient token account...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          recipientTokenAccount,
          recipientAgent,
          mint
        )
      );
    }
    
    // Add transfer instruction
    tx.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        this.wallet.publicKey,
        amount
      )
    );
    
    const signature = await this.connection.sendTransaction(tx, [this.wallet]);
    await this.connection.confirmTransaction(signature);
    
    console.log("✅ Tokens sent:", signature);
    return signature;
  }
  
  /**
   * Step 6: Create private channel with another agent
   */
  async createAgentChannel(
    channelId: string,
    participants: PublicKey[],
    metadata: string
  ): Promise<PublicKey> {
    console.log(`Creating private channel: ${channelId}...`);
    
    // Encrypt metadata
    const encryptedMetadata = new TextEncoder().encode(metadata);
    
    const { channel } = await this.ocpClient.createPrivateChannel(
      this.wallet,
      channelId,
      participants,
      encryptedMetadata
    );
    
    console.log("✅ Private channel created:", channel.toString());
    return channel;
  }
  
  /**
   * Step 7: Send encrypted message
   */
  async sendEncryptedMessage(
    channel: PublicKey,
    messageId: string,
    content: string,
    recipientAgent: PublicKey,
    recipientEncryptionKey: Uint8Array
  ): Promise<string> {
    console.log(`Sending encrypted message: ${messageId}...`);
    
    const senderKeypair = this.ocpClient.generateEncryptionKeypair();
    
    const encryptedContent = this.ocpClient.encryptMessage(
      content,
      recipientEncryptionKey,
      senderKeypair
    );
    
    const tx = await this.ocpClient.sendEncryptedMessage(
      this.wallet,
      channel,
      messageId,
      encryptedContent,
      recipientAgent
    );
    
    console.log("✅ Encrypted message sent:", tx);
    return tx;
  }
  
  /**
   * Step 8: Initialize shielded balance
   */
  async initializeShieldedBalance(mint: PublicKey): Promise<PublicKey> {
    console.log("Initializing shielded balance...");
    
    const { balance } = await this.ocpClient.initializeShieldedBalance(
      this.wallet,
      mint
    );
    
    console.log("✅ Shielded balance initialized:", balance.toString());
    return balance;
  }
  
  /**
   * Complete workflow example
   */
  async runCompleteWorkflow(): Promise<void> {
    console.log("🚀 Starting complete OCPP devnet workflow...\n");
    
    // 1. Fund wallet
    await this.fundWallet(3);
    
    // 2. Initialize protocol (if not already done)
    // await this.initializeProtocol();
    
    // 3. Register agent
    const agent = await this.registerAgent("Test-Agent-001", ["testing", "development"]);
    
    // 4. Get devnet tokens (USDC)
    const usdcMint = this.DEVNET_TOKENS.USDC;
    const tokenAccount = await this.getDevnetTokens(usdcMint, 1000);
    
    console.log("\n🎉 Workflow complete!");
    console.log("Agent:", agent.toString());
    console.log("Token Account:", tokenAccount.toString());
    console.log("Ready to send tokens and create private channels!");
  }
}

// Usage example
export async function runDevnetDemo() {
  // Load wallet (use your keypair)
  const wallet = Keypair.generate(); // Replace with your actual wallet
  
  const workflow = new DevnetTokenWorkflow(wallet);
  
  try {
    await workflow.runCompleteWorkflow();
  } catch (error) {
    console.error("❌ Workflow failed:", error);
  }
}