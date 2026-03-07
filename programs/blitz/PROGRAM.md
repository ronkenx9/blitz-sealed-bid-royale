# BLITZ — Anchor Program Documentation

**Program ID:** `4rBQpg3Fy8ZYYY54QQJmzjUza55ofDPnzxETV2VniYKW`  
**Network:** Solana Devnet  
**Framework:** Anchor 0.32.1 + MagicBlock Ephemeral Rollups SDK

---

## Accounts

### `Game`
Stores the global state for one game session.

| Field | Type | Description |
|---|---|---|
| `game_id` | `u64` | Unique game identifier |
| `creator` | `Pubkey` | Wallet that created the game |
| `player_count` | `u8` | Number of joined players (max 6) |
| `current_round` | `u8` | Current round (1–5) |
| `total_pot` | `u64` | Total SOL deposited (lamports) |
| `winner` | `Pubkey` | Set to winner after game ends |
| `is_active` | `bool` | Whether the game is still running |

**PDA seed:** `["game", game_id_bytes]`

---

### `PlayerState`
Per-player account tracking bids and score across rounds.

| Field | Type | Description |
|---|---|---|
| `player` | `Pubkey` | Player's wallet |
| `game_id` | `u64` | Associated game |
| `score` | `i64` | Cumulative score (Winner's Curse delta in lamports) |
| `current_bid` | `u64` | Bid amount for the current round (lamports) |
| `is_eliminated` | `bool` | Whether player has been eliminated |
| `has_bid` | `bool` | Whether player has bid this round |

**PDA seed:** `["player", game_id_bytes, player_pubkey]`

---

### `RoundItem`
Stores the mystery item and its true market value for each round. The `market_value` is revealed only after all bids are submitted.

| Field | Type | Description |
|---|---|---|
| `game_id` | `u64` | Associated game |
| `round` | `u8` | Round number |
| `item_name_index` | `u8` | Index into the item name registry |
| `market_value` | `u64` | True market value in lamports |

**PDA seed:** `["round_item", game_id_bytes, round_byte]`

---

## Instructions

### `create_game(game_id: u64, entry_fee: u64)`
Initializes a new `Game` account. The creator automatically joins as the first player.

- Transfers `entry_fee` lamports from creator to the game's escrow
- Sets `current_round = 0`, `is_active = true`

**Accounts:** `Game` (init), `PlayerState` (init for creator), creator wallet, system program

---

### `join_game(game_id: u64)`
A second (or third, etc.) player joins an existing game.

- Transfers entry fee from joiner
- Increments `player_count`
- Opens a new `PlayerState` for the joiner
- Fails if game is full (≥6) or already started

**Accounts:** `Game` (mut), `PlayerState` (init), player wallet, system program

---

### `delegate_to_tee(game_id: u64)`
Delegates the `Game` and all `PlayerState` accounts to MagicBlock's TEE validator via Ephemeral Rollups SDK. After delegation, bids submitted through the TEE remain confidential.

**Accounts:** `Game` (mut), all `PlayerState` accounts, TEE validator, system program

---

### `submit_bid(game_id: u64, bid_amount: u64)`
Submits a sealed bid for the current round. Executed inside the TEE — the bid amount is not visible to other players or validators until `resolve_round` is called.

- Sets `PlayerState.current_bid = bid_amount`
- Sets `PlayerState.has_bid = true`

**Accounts:** `Game` (read), `PlayerState` (mut), player wallet

---

### `resolve_round(game_id: u64)`
Commits the TEE state back to Solana, revealing all bids. Then:

1. Finds the highest bidder (the round winner)
2. Applies Winner's Curse: `winner.score += market_value − bid`
3. Finds the lowest scorer among non-eliminated players
4. Marks that player as `is_eliminated = true`
5. Increments `Game.current_round`
6. If `current_round >= 5` or ≤1 player remaining, sets `is_active = false` and sets `Game.winner`

**Accounts:** `Game` (mut), `RoundItem` (read), all `PlayerState` (mut), system program

---

### `settle_game(game_id: u64)`
Transfers the accumulated `total_pot` to the winner's wallet and closes the game accounts (reclaims rent).

**Accounts:** `Game` (mut, close), winner wallet, system program

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| 6000 | `GameFull` | Game already has 6 players |
| 6001 | `GameNotActive` | Game has already ended |
| 6002 | `AlreadyJoined` | Player already in this game |
| 6003 | `AlreadyBid` | Player already bid this round |
| 6004 | `RoundNotComplete` | Not all bids are in yet |
| 6005 | `Unauthorized` | Caller is not the game creator |
| 6006 | `InvalidBid` | Bid outside allowed range |

---

## Score Formula

```
Winner's score delta = True Market Value − Winning Bid
```

If the winning bid exceeds the item's true value, the winner's score **decreases** (the Winner's Curse). This punishes greedy overbidding and rewards rational estimation.

---

## Build & Deploy

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test --skip-local-validator
```

---

## TEE Integration

This program uses [MagicBlock's Ephemeral Rollups SDK](https://github.com/magicblock-labs/ephemeral-rollups-sdk):

```toml
# Cargo.toml
ephemeral-rollups-sdk = { version = "0.6.4", features = ["cpi"] }
ephemeral-vrf-sdk = { version = "0.4.0", features = ["cpi"] }
```

The `#[ephemeral]` macro on the program marks it as TEE-compatible. Accounts delegated via `delegate_to_tee` are processed by the confidential validator at `tee.magicblock.app`.
