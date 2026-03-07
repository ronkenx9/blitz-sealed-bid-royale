# ⚔ BLITZ Frontend — React App

React + Vite frontend for the BLITZ Sealed-Bid Battle Royale game.

## Tech Stack

- **React 18** + **TypeScript** (Vite)
- **@solana/wallet-adapter** — Phantom & Solflare support
- **@coral-xyz/anchor** — On-chain program interaction
- **@magicblock-labs/ephemeral-rollups-sdk** — TEE delegation

## Dev Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Set your wallet to **Devnet**.

## Environment

No `.env` needed — all configuration in `src/utils/constants.ts`:

| Constant | Value |
|---|---|
| `PROGRAM_ID` | `4rBQpg3Fy8ZYYY54QQJmzjUza55ofDPnzxETV2VniYKW` |
| `MAINNET_URL` | `https://api.mainnet-beta.solana.com` |
| `DEVNET_URL` | `https://api.devnet.solana.com` |
| `TEE_URL` | `https://tee.magicblock.app` |

## Game Modes

### 🤖 AI Arena (default)
Instant solo play vs 5 AI bots. Runs entirely client-side via `useAIGame.ts`. No wallet or SOL needed.

### ⚔ PvP Mode
Live on-chain game on Solana Devnet. Requires wallet + ~0.1 devnet SOL.

## Key Hooks

| Hook | Role |
|---|---|
| `useAIGame` | Client-side AI game engine with 5 bot personalities |
| `useBlitzGame` | Polls Anchor program accounts for live PvP state |
| `useBlitzActions` | Signs and sends all on-chain transactions |

## Game Flow

```
Lobby → Bidding (10s countdown) → Reveal → [Bidding → Reveal] × 5 → Game Over
```

- Phase tabs are **locked** until progression
- A **ping sound** plays when a new phase unlocks
- AI bots show animated "thinking" status before auto-advancing

## Build for Production

```bash
npm run build
```

Output in `dist/`.
