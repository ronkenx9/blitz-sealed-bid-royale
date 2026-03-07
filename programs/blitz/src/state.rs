use anchor_lang::prelude::*;

pub const GAME_SEED: &[u8] = b"game";
pub const PLAYER_STATE_SEED: &[u8] = b"player_state";
pub const ROUND_ITEM_SEED: &[u8] = b"round_item";
pub const VAULT_SEED: &[u8] = b"vault";

pub const MAX_PLAYERS: usize = 6;
pub const MIN_PLAYERS: usize = 2;
pub const NUM_ROUNDS: u8 = 5;
pub const ENTRY_FEE: u64 = 50_000_000; // 0.05 SOL
pub const ITEM_VALUE_MIN: u64 = 10_000_000; // 0.01 SOL
pub const ITEM_VALUE_MAX: u64 = 100_000_000; // 0.1 SOL

#[account]
pub struct Game {
    pub game_id: u64,                          // 8
    pub creator: Pubkey,                       // 32
    pub player_count: u8,                      // 1
    pub players: [Pubkey; 6],                  // 32 * 6 = 192
    pub eliminated: [bool; 6],                 // 6
    pub current_round: u8,                     // 1
    pub round_active: bool,                    // 1
    pub round_start_time: i64,                 // 8
    pub current_item_value: u64,               // 8
    pub status: GameStatus,                    // 1
    pub winner: Option<Pubkey>,                // 1 + 32 = 33
    pub total_pot: u64,                        // 8
    pub bump: u8,                              // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GameStatus {
    WaitingForPlayers,
    InProgress,
    Completed,
}

#[account]
pub struct PlayerState {
    pub game_id: u64,                          // 8
    pub player: Pubkey,                        // 32
    pub score: i64,                            // 8
    pub current_bid: Option<u64>,              // 1 + 8 = 9
    pub has_bid_this_round: bool,              // 1
    pub is_eliminated: bool,                   // 1
    pub bump: u8,                              // 1
}

#[account]
pub struct RoundItem {
    pub game_id: u64,                          // 8
    pub round: u8,                             // 1
    pub item_name_index: u8,                   // 1
    pub market_value: u64,                     // 8
    pub winning_bid: Option<u64>,              // 1 + 8 = 9
    pub winner: Option<Pubkey>,                // 1 + 32 = 33
    pub bump: u8,                              // 1
}
