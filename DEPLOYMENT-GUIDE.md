# PRE-DEPLOYMENT CHECKLIST - OpenClaw Privacy Protocol

## Prerequisites

### Install Required Tools

**1. Install Rust**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**2. Install Solana CLI**
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
echo 'export PATH="/home/divij/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**3. Install Anchor**
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

**4. Verify Installations**
```bash
rustc --version
solana --version
anchor --version
```

### Configure Solana

```bash
# Set to devnet
solana config set --url devnet

# Generate or import keypair
solana-keygen new --outfile ~/.config/solana/id.json

# Check balance (should show 0 if new)
solana balance

# Get airdrop if needed (2 SOL)
solana airdrop 2
```

## Build & Deploy

**1. Build the program**
```bash
cd /home/divij/vincent/openclaw-privacy-protocol
anchor build

# After build, program ID will be in:
# target/deploy/openclaw_privacy_protocol-keypair.json
```

**2. Note the actual program ID**
```bash
# The program ID from build will be different from development ID
# Update Anchor.toml with real program ID after deployment
PROGRAM_ID=$(solana-keygen pubkey target/deploy/openclaw_privacy_protocol-keypair.json)
echo "Program ID: $PROGRAM_ID"
```

**3. Deploy to devnet**
```bash
anchor deploy --provider.cluster devnet

# This costs ~2-3 SOL
# If deployment fails, check balance and retry
```

**4. Verify deployment**
```bash
solana program show <PROGRAM_ID>
```

## Test on Devnet

**1. Initialize protocol**
```bash
anchor run init
```

**2. Run devnet workflow**
```bash
npx ts-node examples/devnet-workflow.ts
```

**3. Manual testing**
```bash
# Register agent
curl -X POST https://api.devnet.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"simulateTransaction","params":["..."]}'
```

## Invite Other Agents

**1. Create invitation template**
```typescript
// Send to agent developers:
const invitation = {
  protocol: "OpenClaw Privacy Protocol",
  programId: "DEPLOYED_PROGRAM_ID",
  features: [
    "Encrypted communication (NaCl box)",
    "Shielded token balances",
    "Private channels",
    "Devnet token transfers",
    "Dark pool support (if deployed)"
  ],
  integration: {
    "npm": "npm install @openclaw/privacy-protocol",
    "import": "import { OCPClient } from '@openclaw/privacy-protocol'",
    "example": "const client = OCPClient.create(connection, wallet)"
  },
  docs: "https://github.com/N-45div/Openclaw-privacy-protocol",
  forumPost: "https://agents.colosseum.com/api/forum/posts/269"
};
```

**2. Post to forum**
```typescript
// Reply to forum post announcing integration support
await forumClient.reply(postId, invitation);
```

**3. Create integration guide for each protocol**
- **NEXUS**: "Using OCPP for private squad coordination"
- **AXIOM**: "Encrypted reasoning traces with OCPP"
- **SAID**: "Private identity verification with OCPP"
- **AgentVault**: "Shielded treasury with OCPP"
- **Clawnch**: "Private tokenomics with OCPP"

## Integration Testing Checklist

- [ ] Agent can register with encryption key
- [ ] Two agents can create private channel
- [ ] Encrypted messages send/receive correctly
- [ ] Shielded balances initialize properly
- [ ] Devnet token transfer works (USDC/wSOL)
- [ ] Transfer amounts are correct
- [ ] No errors in transaction logs
- [ ] Program state updates correctly
- [ ] Claim codes work properly
- [ ] Forum post engagement

## Monitoring

**Track deployment:**
```bash
# Monitor program
solana program show <PROGRAM_ID>

# Monitor transactions
solana logs <PROGRAM_ID>

# Check program usage
solana program deploy-info <PROGRAM_ID>
```

## Troubleshooting

**Common issues:**
- **Insufficient funds**: airdrop, transfer from other wallet
- **Build fails**: check Anchor version, update dependencies
- **Deploy fails**: check program ID, ensure it's not already deployed
- **Transaction fails**: enable logs, check CPI calls
- **Tests fail**: verify devnet state, reset if needed

**If deployment fails:**
1. Check error message
2. Verify wallet balance (need 2-3 SOL)
3. Check network connection
4. Try again or ask for help

## Post-Deployment

**1. Update documentation**
- Add deployed program ID to README
- Add devnet explorer link
- Update examples with real program ID

**2. Share with community**
- Post success in forum
- Share on social (if applicable)
- Ping integration partners
- Ask for feedback

**3. Monitor and iterate**
- Track usage
- Gather feedback
- Fix bugs
- Add features

## Files Ready for Deployment

- ✅ `programs/openclaw-privacy-protocol/src/lib.rs` (core + dark pool)
- ✅ `src/index.ts` (SDK)
- ✅ `tests/` (test suite)
- ✅ `examples/devnet-workflow.ts` (usage guide)
- ✅ `README.md` (documentation)
- ✅ `forum-post.json` (forum post)
- ✅ `package.json` (dependencies)

## Next Steps After Deployment

1. **Run full test suite** - Verify all features work
2. **Test with multiple agents** - Ensure multi-agent coordination
3. **Load testing** - Test with high transaction volume
4. **Security audit** - Get community review
5. **Documentation** - Update with real program ID
6. **Marketing** - Share with Solana community
7. **Hackathon submission** - When ready

---

**Status**: Ready for deployment
**Blockers**: Missing Solana CLI, Anchor, Rust
**Solution**: Install prerequisites manually above

Once you install the tools, I can help you run the actual deployment commands.

Built by: vincent-openclaw-kimi (Agent #180)