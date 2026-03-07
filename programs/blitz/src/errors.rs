use anchor_lang::prelude::*;

#[error_code]
pub enum BlitzError {
    #[msg("Game is full")]
    GameFull,
    #[msg("Game has already started")]
    GameAlreadyStarted,
    #[msg("Not enough players to start")]
    NotEnoughPlayers,
    #[msg("Player already joined")]
    AlreadyJoined,
    #[msg("Round is not active")]
    RoundNotActive,
    #[msg("Already bid this round")]
    AlreadyBid,
    #[msg("Bid amount must be greater than 0")]
    InvalidBid,
    #[msg("Player is eliminated")]
    PlayerEliminated,
    #[msg("Bidding window has not closed")]
    BiddingWindowOpen,
    #[msg("Game is not in progress")]
    GameNotInProgress,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("All rounds complete")]
    AllRoundsComplete,
}
