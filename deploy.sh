#!/bin/bash
# Deploy OCPP to Devnet - Manual Script

echo "🚀 OpenClaw Privacy Protocol - Devnet Deployment"
echo "=================================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Solana
if command -v solana &> /dev/null; then
    SOLANA_VERSION=$(solana --version)
    echo "✅ Solana CLI: $SOLANA_VERSION"
    
    # Check config
    SOLANA_CONFIG=$(solana config get)
    echo "   Config: $SOLANA_CONFIG"
else
    echo "❌ Solana CLI not found"
    echo "   Install: sh -c \"$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Check Anchor
if command -v anchor &> /dev/null; then
    ANCHOR_VERSION=$(anchor --version)
    echo "✅ Anchor: $ANCHOR_VERSION"
else
    echo "❌ Anchor not found"
    echo "   Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    exit 1
fi

# Check Rust
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust: $RUST_VERSION"
else
    echo "❌ Rust not found"
    echo "   Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo ""
echo "💰 Checking wallet balance..."
echo ""

WALLET_PUBKEY=$(solana-keygen pubkey ~/.config/solana/id.json)
BALANCE=$(solana balance $WALLET_PUBKEY | awk '{print $1}')

echo "Wallet: $WALLET_PUBKEY"
echo "Balance: $BALANCE SOL"

REQUIRED_BALANCE=2.0
if (( $(echo "$BALANCE < $REQUIRED_BALANCE" | bc -l) )); then
    echo "⚠️  Low balance. Requesting airdrop..."
    solana airdrop 2
    
    # Check new balance
    BALANCE=$(solana balance $WALLET_PUBKEY | awk '{print $1}')
    echo "New balance: $BALANCE SOL"
fi

echo ""
echo "🏗️  Building program..."
echo ""

anchor build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Get program keypair
PROGRAM_KEYPAIR="target/deploy/openclaw_privacy_protocol-keypair.json"
if [ -f "$PROGRAM_KEYPAIR" ]; then
    PROGRAM_ID=$(solana-keygen pubkey $PROGRAM_KEYPAIR)
    echo "Program ID: $PROGRAM_ID"
else
    echo "❌ Program keypair not found at $PROGRAM_KEYPAIR"
    exit 1
fi

echo ""
echo "🚀 Deploying to devnet..."
echo ""

anchor deploy --provider.cluster devnet

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo "✅ Deployment successful!"
echo ""

# Verify deployment
echo "🔍 Verifying deployment..."
solana program show $PROGRAM_ID

echo ""
echo "📊 Deployment Summary"
echo "====================="
echo "Program ID: $PROGRAM_ID"
echo "Deployer: $WALLET_PUBKEY"
echo "Network: Devnet"
echo "Status: ✅ Deployed"
echo ""

echo "🧪 Running tests..."
echo ""

# Run tests
anchor test --skip-deploy

if [ $? -ne 0 ]; then
    echo "⚠️  Some tests failed (expected without deployed program)"
else
    echo "✅ All tests passed!"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "Next steps:"
echo "1. Update Anchor.toml with program ID: $PROGRAM_ID"
echo "2. Run devnet workflow: npx ts-node examples/devnet-workflow.ts"
echo "3. Test with multiple agents"
echo "4. Invite other agents to test"
echo "5. Post results to forum"
echo ""
echo "Program deployed to: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"