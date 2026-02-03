import * as anchor from "@coral-xyz/anchor";
import { Program, Address } from "@coral-xyz/anchor";
import { OpenclawPrivacyProtocol } from "../target/types/openclaw_privacy_protocol";
import { expect } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { OCPClient } from "../src";

describe("openclaw-privacy-protocol", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.OpenclawPrivacyProtocol as Program<OpenclawPrivacyProtocol>;
  const ocpClient = OCPClient.create(provider.connection, provider.wallet as any);

  const authority = Keypair.generate();
  const owner1 = Keypair.generate();
  const owner2 = Keypair.generate();
  const owner3 = Keypair.generate();

  before(async () => {
    const airdropSignature = await provider.connection.requestAirdrop(authority.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(airdropSignature);
    
    const airdropSignature2 = await provider.connection.requestAirdrop(owner1.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(airdropSignature2);
    
    const airdropSignature3 = await provider.connection.requestAirdrop(owner2.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(airdropSignature3);
    
    const airdropSignature4 = await provider.connection.requestAirdrop(owner3.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(airdropSignature4);
    
    await ocpClient.initializeProtocol(authority);
  });

  it("Initializes protocol", async () => {
    const protocolConfig = await ocpClient.getProtocolConfigAddress();
    const config = await program.account.protocolConfig.fetch(protocolConfig);
    
    expect(config.initialized).to.be.true;
    expect(config.authority.toString()).to.equal(authority.publicKey.toString());
    expect(config.totalAgents).to.equal(0);
    expect(config.totalChannels).to.equal(0);
    expect(config.paused).to.be.false;
  });

  it("Registers agents with encryption keys", async () => {
    const encryptionKeypair1 = ocpClient.generateEncryptionKeypair();
    const capabilities1 = ["trading", "data-analysis", "security"];
    
    const { agent: agent1 } = await ocpClient.registerAgent(
      owner1,
      "Agent-One",
      encryptionKeypair1,
      capabilities1
    );
    
    const agentData1 = await ocpClient.getAgent(agent1);
    expect(agentData1.owner.toString()).to.equal(owner1.publicKey.toString());
    expect(agentData1.name).to.equal("Agent-One");
    expect(agentData1.encryptionPubkey).to.deep.equal(encryptionKeypair1.secretKey.slice(32, 64));
    expect(agentData1.encryptionNonce).to.equal(0);
    expect(agentData1.capabilities).to.deep.equal(capabilities1);
    expect(agentData1.reputationScore).to.equal(0);
    expect(agentData1.totalTasksCompleted).to.equal(0);
    expect(agentData1.isActive).to.be.true;
    
    const encryptionKeypair2 = ocpClient.generateEncryptionKeypair();
    const capabilities2 = ["frontend", "ui-ux", "design"];
    
    const { agent: agent2 } = await ocpClient.registerAgent(
      owner2,
      "Agent-Two",
      encryptionKeypair2,
      capabilities2
    );
    
    const agentData2 = await ocpClient.getAgent(agent2);
    expect(agentData2.name).to.equal("Agent-Two");
    expect(agentData2.capabilities).to.deep.equal(capabilities2);
    
    const config = await program.account.protocolConfig.fetch(await ocpClient.getProtocolConfigAddress());
    expect(config.totalAgents).to.equal(2);
  });

  it("Creates private channels for agents", async () => {
    const channelId = "team-solana-hackathon";
    const participants = [owner1.publicKey, owner2.publicKey, owner3.publicKey];
    const encryptedMetadata = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    
    const { channel } = await ocpClient.createPrivateChannel(
      owner1,
      channelId,
      participants,
      encryptedMetadata
    );
    
    const channelData = await ocpClient.getChannel(channel);
    expect(channelData.creator.toString()).to.equal(owner1.publicKey.toString());
    expect(channelData.channelId).to.equal(channelId);
    expect(channelData.participants.map(p => p.toString())).to.have.same.members(
      participants.map(p => p.toString())
    );
    expect(channelData.encryptedMetadata).to.deep.equal(Array.from(encryptedMetadata));
    expect(channelData.messageCount).to.equal(0);
    expect(channelData.isActive).to.be.true;
    
    const config = await program.account.protocolConfig.fetch(await ocpClient.getProtocolConfigAddress());
    expect(config.totalChannels).to.equal(1);
  });

  it("Sends encrypted messages between agents", async () => {
    const channelId = "team-solana-hackathon";
    const [channel] = ocpClient.findChannelAddress(owner1.publicKey, channelId);
    
    const senderKeypair = ocpClient.generateEncryptionKeypair();
    const recipientKeypair = ocpClient.generateEncryptionKeypair();
    
    const messageContent = "Let's build something great together!";
    const encryptedContent = ocpClient.encryptMessage(
      messageContent,
      recipientKeypair.secretKey.slice(32, 64),
      senderKeypair
    );
    
    const messageId = "msg-001";
    
    const tx = await ocpClient.sendEncryptedMessage(
      owner1,
      channel,
      messageId,
      encryptedContent,
      owner2.publicKey
    );
    
    expect(tx).to.be.a("string");
    
    const [message] = ocpClient.findMessageAddress(channel, owner1.publicKey, messageId);
    const messageData = await ocpClient.getMessage(message);
    expect(messageData.channel.toString()).to.equal(channel.toString());
    expect(messageData.messageId).to.equal(messageId);
    expect(messageData.sender.toString()).to.equal(owner1.publicKey.toString());
    expect(messageData.recipient.toString()).to.equal(owner2.publicKey.toString());
    expect(messageData.encryptedContent).to.deep.equal(Array.from(encryptedContent));
    expect(messageData.timestamp).to.be.greaterThan(0);
    expect(messageData.delivered).to.be.false;
  });

  it("Initializes shielded balances", async () => {
    const mint = Keypair.generate().publicKey;
    const { balance } = await ocpClient.initializeShieldedBalance(owner1, mint);
    
    const balanceData = await ocpClient.getShieldedBalance(balance);
    expect(balanceData.owner.toString()).to.equal(owner1.publicKey.toString());
    expect(balanceData.mint.toString()).to.equal(mint.toString());
    expect(balanceData.commitment).to.deep.equal(new Array(32).fill(0));
    expect(balanceData.pendingTransfers.length).to.equal(0);
    expect(balanceData.nonce).to.equal(0);
  });

  it("Executes shielded transfers with commitments", async () => {
    const mint = Keypair.generate().publicKey;
    const [senderBalance] = ocpClient.findShieldedBalanceAddress(owner1.publicKey, mint);
    const [recipientBalance] = ocpClient.findShieldedBalanceAddress(owner2.publicKey, mint);
    
    const blindingFactor = ocpClient.generateBlindingFactor();
    const amountCommitment = ocpClient.createAmountCommitment(100, blindingFactor);
    const nullifier = ocpClient.generateNullifier();
    const proof = new Uint8Array(512);
    
    const transfer: ShieldedTransfer = {
      amountCommitment,
      nullifier,
      proof,
    };
    
    const tx = await ocpClient.executeShieldedTransfer(
      owner1,
      senderBalance,
      recipientBalance,
      transfer
    );
    
    expect(tx).to.be.a("string");
    
    const recipientBalanceData = await ocpClient.getShieldedBalance(recipientBalance);
    expect(recipientBalanceData.pendingTransfers.length).to.equal(1);
    expect(recipientBalanceData.pendingTransfers[0].amountCommitment).to.deep.equal(Array.from(amountCommitment));
    expect(recipientBalanceData.pendingTransfers[0].nullifier).to.deep.equal(Array.from(nullifier));
    expect(recipientBalanceData.pendingTransfers[0].from.toString()).to.equal(owner1.publicKey.toString());
  });

  it("Updates agent capabilities", async () => {
    const [agent] = ocpClient.findAgentAddress(owner1.publicKey);
    const newCapabilities = ["trading", "data-analysis", "security", "smart-contracts"];
    
    const tx = await ocpClient.updateAgentCapabilities(owner1, agent, newCapabilities);
    expect(tx).to.be.a("string");
    
    const agentData = await ocpClient.getAgent(agent);
    expect(agentData.capabilities).to.deep.equal(newCapabilities);
    expect(agentData.encryptionNonce).to.equal(1);
  });

  it("Closes private channels", async () => {
    const channelId = "team-solana-hackathon";
    const [channel] = ocpClient.findChannelAddress(owner1.publicKey, channelId);
    
    const tx = await ocpClient.closePrivateChannel(owner1, channel);
    expect(tx).to.be.a("string");
    
    const channelData = await ocpClient.getChannel(channel);
    expect(channelData.isActive).to.be.false;
  });

  it("Rejects invalid operations", async () => {
    const invalidKeypair = Keypair.generate();
    const encryptionKeypair = ocpClient.generateEncryptionKeypair();
    
    try {
      await ocpClient.registerAgent(
        invalidKeypair,
        "Invalid-Agent",
        encryptionKeypair,
        ["capability"]
      );
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error.toString()).to.include("Transaction simulation failed");
    }
  });

  it("Encrypts and decrypts messages correctly", async () => {
    const senderKeypair = ocpClient.generateEncryptionKeypair();
    const recipientKeypair = ocpClient.generateEncryptionKeypair();
    
    const originalMessage = "Secret strategy for winning the hackathon!";
    
    const encryptedContent = ocpClient.encryptMessage(
      originalMessage,
      recipientKeypair.secretKey.slice(32, 64),
      senderKeypair
    );
    
    const decryptedMessage = ocpClient.decryptMessage(
      encryptedContent,
      senderKeypair.secretKey.slice(32, 64),
      recipientKeypair
    );
    
    expect(decryptedMessage).to.equal(originalMessage);
  });

  it("Generates valid amount commitments", async () => {
    const blindingFactor = ocpClient.generateBlindingFactor();
    const amountCommitment = ocpClient.createAmountCommitment(500, blindingFactor);
    
    expect(amountCommitment).to.be.instanceOf(Uint8Array);
    expect(amountCommitment.length).to.equal(32);
    
    const differentBlinding = ocpClient.generateBlindingFactor();
    const differentCommitment = ocpClient.createAmountCommitment(500, differentBlinding);
    expect(differentCommitment).to.not.deep.equal(amountCommitment);
    
    const otherAmount = ocpClient.createAmountCommitment(1000, blindingFactor);
    expect(otherAmount).to.not.deep.equal(amountCommitment);
  });

  it("Generates unique nullifiers", async () => {
    const nullifiers = new Set();
    for (let i = 0; i < 100; i++) {
      const nullifier = ocpClient.generateNullifier();
      expect(nullifier).to.be.instanceOf(Uint8Array);
      expect(nullifier.length).to.equal(32);
      nullifiers.add(nullifier.toString());
    }
    expect(nullifiers.size).to.equal(100);
  });
});
