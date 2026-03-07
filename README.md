# ⚔ BLITZ — Sealed-Bid Battle Royale

> A confidential sealed-bid auction game on Solana Devnet, powered by MagicBlock's Trusted Execution Environment (TEE). Blitz demonstrates the **Winner's Curse** mechanic: the highest bidder wins but pays a penalty for overbidding.

![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-0.32.1-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🎮 What is BLITZ?

BLITZ is a multiplayer sealed-bid game where 2–6 players compete over 5 rounds. Each round, a mystery item with a hidden market value is revealed. Players submit **sealed bids** — kept private via MagicBlock's TEE (Trusted Execution Environment) — and the highest bidder wins the round. But winning costs: your score is `True Value − Your Bid`, so overbidding hurts you.

After each round, the lowest-scoring player is **eliminated**. The last one standing claims the entire SOL pot.

### 🤖 AI Arena Mode

No friends online? No problem. BLITZ has a built-in **AI Arena mode** with 5 AI bots, each with a distinct personality and bidding strategy:

| Bot | Emoji | Strategy |
|---|---|---|
| CRYPTOKNIGHT | 🤖 | Aggressive — overbids 5–25% above market value |
| VOIDMAGE | 👾 | Conservative — bids 55–75% of value |
| SHADOWROGUE | 🕹️ | Wildcard — random 20–160% of value |
| IRONCLAD | ⚙️ | Calculated — bids close to fair value (85–105%) |
| ORACLE | 🔮 | Adaptive — mirrors your previous bids |

AI mode runs **entirely client-side** — instant play, no wallet or SOL required.

---

## 🏗 Architecture

```
blitz/
├── programs/blitz/              # Anchor on-chain program (Rust)
│   └── src/
│       ├── lib.rs               # Instructions: create_game, join_game, submit_bid, resolve_round, settle_game
│       ├── state.rs             # Game, PlayerState, RoundItem account structs
│       └── errors.rs            # Custom error codes
├── app/                         # React frontend (Vite + TypeScript)
│   └── src/
│       ├── hooks/
│       │   ├── useBlitzGame.ts  # Polls on-chain game state (mainnet)
│       │   ├── useBlitzActions.ts # All transaction signers
│       │   └── useAIGame.ts     # Full client-side AI game simulation engine
│       ├── components/
│       │   ├── Lobby.tsx        # Game creation / AI Arena setup
│       │   ├── BiddingRound.tsx # Bid slider, countdown, opponent status
│       │   ├── RevealPhase.tsx  # Live bid reveal, scoring, standings
│       │   └── GameOver.tsx     # Final results, winner, pot settlement
│       └── utils/
│           ├── anchor.ts        # PDA derivation helpers
│           └── constants.ts     # Program ID, endpoints, item names
├── tests/                       # Anchor test suite
└── Anchor.toml
```

---

## ⚙️ Game Mechanics

### Winner's Curse
The core mechanic: the round winner gets **penalized** for overbidding.

```
Score = True Market Value − Your Bid
```

- Bid **below** value → you didn't win, no score change
- Bid **above** value in the winning round → your score **decreases**
- The goal is to win rounds by bidding *just enough*, not more

### Elimination
After each round, the player with the **lowest total score** is eliminated. After 5 rounds (or once only 1 player survives), the game ends and the last adventurer standing claims the SOL pot.

---

## 🔐 TEE Confidentiality

Sealed bids use MagicBlock's TEE (Trusted Execution Environment) via Ephemeral Rollups. During the bidding window:
- Bids are encrypted at the TEE layer
- No player (or validator) can see other players' bids before reveal
- After the window closes, the TEE decrypts and resolves the round on-chain

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Rust | 1.85.0 |
| Solana CLI | 2.3.13 |
| Anchor CLI | 0.32.1 |
| Node.js | ≥18 |
| Yarn or npm | latest |

### 1. Install Tools

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v2.3.13/install)"

# Anchor via AVM
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
```

### 2. Clone and Install

```bash
git clone https://github.com/ronkenx9/blitz-sealed-bid-royale.git
cd blitz-sealed-bid-royale

# Install root deps
yarn install

# Install frontend deps
cd app && npm install
```

### 3. Build the Anchor Program

```bash
anchor build
```

This compiles the Rust program and generates IDL + TypeScript types in `target/`.

### 4. Deploy to Devnet

```bash
# Configure CLI for devnet
solana config set --url devnet

# Airdrop SOL to your deploy wallet
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet
```

After deployment, update `app/src/utils/constants.ts` with your new Program ID.

### 5. Run the Frontend

```bash
cd app
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — switch to Devnet in your Phantom/Solflare wallet.

---

## 🤖 Playing Locally (AI Arena)

No Devnet setup required! Click **🤖 AI ARENA** in the header toggle to play instantly against 5 AI opponents. No wallet or SOL needed.

**Flow:**
1. Click **START AI ARENA** → bots join instantly
2. Click **ENTER THE ARENA** → bidding phase begins
3. Submit your bid within 10 seconds
4. Watch bots "think" with animated statuses → auto-advance to reveal
5. See all bids + Winner's Curse scoring
6. Click **RESOLVE ROUND** → lowest scorer eliminated
7. Repeat for 5 rounds → final standings

---

## 🌐 PvP Mode (Devnet)

**Flow:**
1. Connect Phantom or Solflare wallet (switch to **Devnet**)
2. Click **CREATE GAME** or **JOIN GAME** 
3. Once in, click **DELEGATE TO TEE** 
4. Click **ENTER THE ARENA** → submit your sealed bid on-chain
5. After bid window closes, click **RESOLVE ROUND** 
6. After 5 rounds, settle the pot to Mainnet

> **Devnet SOL faucet:** [faucet.solana.com](https://faucet.solana.com)

---

## 📋 Program Instructions

| Instruction | Description |
|---|---|
| `create_game` | Initialize a new game with entry fee and game ID |
| `join_game` | Register a player into an open game |
| `delegate_to_tee` | Delegate game account to MagicBlock TEE validator |
| `submit_bid` | Submit sealed bid (encrypted via TEE) |
| `resolve_round` | Reveal bids, score players, eliminate last place |
| `settle_game` | Transfer pot to winner, close game accounts |

---

## 🔧 Configuration

`app/src/utils/constants.ts`:

```typescript
export const PROGRAM_ID = new PublicKey("4rBQpg3Fy8ZYYY54QQJmzjUza55ofDPnzxETV2VniYKW");
export const MAINNET_URL = "https://api.mainnet-beta.solana.com";
export const DEVNET_URL  = "https://api.devnet.solana.com";
export const TEE_URL     = "https://tee.magicblock.app";
```

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust + Anchor Framework |
| TEE Confidentiality | MagicBlock Ephemeral Rollups SDK |
| Frontend | React 18 + Vite + TypeScript |
| Wallet | `@solana/wallet-adapter` (Phantom, Solflare) |
| Blockchain RPC | `@solana/web3.js` |
| AI Engine | Custom client-side simulation (`useAIGame.ts`) |

---

## 📁 Key Files

| File | Purpose |
|---|---|
| `programs/blitz/src/lib.rs` | All on-chain game instructions |
| `programs/blitz/src/state.rs` | `Game`, `PlayerState`, `RoundItem` account definitions |
| `app/src/hooks/useAIGame.ts` | Full AI game engine + 5 bot personalities |
| `app/src/hooks/useBlitzGame.ts` | Mainnet polling for on-chain game state |
| `app/src/hooks/useBlitzActions.ts` | Transaction builders for all game actions |
| `app/src/utils/constants.ts` | Program ID, RPC URLs, item name registry |

---

## 🛠 Troubleshooting

**"wallet not connected"**  
→ Connect Phantom or Solflare and switch to Devnet

**"insufficient funds"**  
→ Airdrop SOL from [faucet.solana.com](https://faucet.solana.com)

**"Transaction too large"**  
→ Try again — ephemeral rollup may be warming up

**"anchor build fails"**  
→ Run `rustup update` and `cargo clean` then rebuild

---

## 🔗 References

- [Anchor Docs](https://www.anchor-lang.com/)
- [Solana Docs](https://docs.solana.com/)
- [MagicBlock Ephemeral Rollups SDK](https://github.com/magicblock-labs/ephemeral-rollups-sdk)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

---

## 📄 License

MIT — built with ⚔ by [ronkenx9](https://github.com/ronkenx9)
