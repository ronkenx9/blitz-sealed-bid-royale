use anchor_lang::prelude::*;
use anchor_lang::system_program;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};
use ephemeral_rollups_sdk::access_control::{
    instructions::{CreatePermissionCpiBuilder, UpdatePermissionCpiBuilder},
    structs::{Member, MembersArgs, AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG},
};
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

// Use a placeholder program ID, user will update it later.
declare_id!("4rBQpg3Fy8ZYYY54QQJmzjUza55ofDPnzxETV2VniYKW");

mod state;
mod errors;
use state::*;
use errors::*;

use std::str::FromStr;
pub const PERMISSION_PROGRAM_ID: Pubkey = pubkey!("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");

#[ephemeral]
#[program]
pub mod blitz {
    use super::*;

    // ── INSTRUCTION 1: CREATE GAME ──────────────────────────────────
    pub fn create_game(ctx: Context<CreateGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.game_id = game_id;
        game.creator = ctx.accounts.creator.key();
        game.player_count = 1;
        game.players[0] = ctx.accounts.creator.key();
        game.eliminated = [false; 6];
        game.current_round = 0;
        game.round_active = false;
        game.status = GameStatus::WaitingForPlayers;
        game.winner = None;
        game.total_pot = ENTRY_FEE;
        game.bump = ctx.bumps.game;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            ENTRY_FEE,
        )?;

        let player_state = &mut ctx.accounts.player_state;
        player_state.game_id = game_id;
        player_state.player = ctx.accounts.creator.key();
        player_state.score = 0;
        player_state.current_bid = None;
        player_state.has_bid_this_round = false;
        player_state.is_eliminated = false;
        player_state.bump = ctx.bumps.player_state;

        msg!("Game {} created by {}", game_id, ctx.accounts.creator.key());
        Ok(())
    }

    // ── INSTRUCTION 2: JOIN GAME ────────────────────────────────────
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = ctx.accounts.player.key();

        require!(game.status == GameStatus::WaitingForPlayers, BlitzError::GameAlreadyStarted);
        require!(game.player_count < MAX_PLAYERS as u8, BlitzError::GameFull);
        require!(!game.players.contains(&player), BlitzError::AlreadyJoined);

        let idx = game.player_count as usize;
        game.players[idx] = player;
        game.player_count += 1;
        game.total_pot += ENTRY_FEE;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            ENTRY_FEE,
        )?;

        let player_state = &mut ctx.accounts.player_state;
        player_state.game_id = game_id;
        player_state.player = player;
        player_state.score = 0;
        player_state.current_bid = None;
        player_state.has_bid_this_round = false;
        player_state.is_eliminated = false;
        player_state.bump = ctx.bumps.player_state;

        msg!("{} joined Game {}", player, game_id);
        Ok(())
    }

    // ── INSTRUCTION 3: DELEGATE GAME ────────────────────────────────
    pub fn delegate_game(ctx: Context<DelegateGameInput>) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(game.player_count >= MIN_PLAYERS as u8, BlitzError::NotEnoughPlayers);
        require!(game.creator == ctx.accounts.payer.key(), BlitzError::Unauthorized);

        ctx.accounts.delegate_game(
            &ctx.accounts.payer,
            &[GAME_SEED, &game.game_id.to_le_bytes()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    // ── INSTRUCTION 3b: DELEGATE PLAYER STATE ───────────────────────
    pub fn delegate_player_state(ctx: Context<DelegatePlayerStateInput>, game_id: u64) -> Result<()> {
        ctx.accounts.delegate_player_state(
            &ctx.accounts.payer,
            &[PLAYER_STATE_SEED, &game_id.to_le_bytes(), ctx.accounts.payer.key.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    // ── INSTRUCTION 4: CREATE BID PERMISSION ────────────────────────
    pub fn create_bid_permission<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateBidPermission<'info>>,
        game_id: u64,
    ) -> Result<()> {
        let player = ctx.accounts.player.key();

        let members = Some(vec![
            Member {
                flags: AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG,
                pubkey: player,
            },
        ]);

        CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&ctx.accounts.player_state.to_account_info())
            .permission(&ctx.accounts.permission)
            .payer(&ctx.accounts.player)
            .system_program(&ctx.accounts.system_program)
            .args(MembersArgs { members })
            .invoke_signed(&[&[
                PLAYER_STATE_SEED,
                &game_id.to_le_bytes(),
                player.as_ref(),
                &[ctx.bumps.player_state],
            ]])?;

        msg!("Permission created for player {}", player);
        Ok(())
    }

    // ── INSTRUCTION 5: START ROUND ──────────────────────────────────
    pub fn start_round(ctx: Context<StartRoundCtx>, client_seed: u8) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(game.status == GameStatus::WaitingForPlayers || game.status == GameStatus::InProgress, BlitzError::GameNotInProgress);
        require!(game.current_round < NUM_ROUNDS, BlitzError::AllRoundsComplete);
        require!(game.creator == ctx.accounts.payer.key(), BlitzError::Unauthorized);

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: instruction::CallbackStartRound::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![
                SerializableAccountMeta {
                    pubkey: ctx.accounts.game.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.round_item.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;

        Ok(())
    }

    // ── INSTRUCTION 5b: VRF CALLBACK ────────────────────────────────
    pub fn callback_start_round(
        ctx: Context<CallbackStartRoundCtx>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let game = &mut ctx.accounts.game;

        let range = ITEM_VALUE_MAX - ITEM_VALUE_MIN;
        let random_offset = u64::from_le_bytes(randomness[0..8].try_into().unwrap()) % range;
        let item_value = ITEM_VALUE_MIN + random_offset;
        let item_name_index = randomness[8] % 10;

        game.current_round += 1;
        game.round_active = true;
        game.status = GameStatus::InProgress;
        game.current_item_value = item_value;

        let clock = Clock::get()?;
        game.round_start_time = clock.unix_timestamp;

        let round_item = &mut ctx.accounts.round_item;
        round_item.game_id = game.game_id;
        round_item.round = game.current_round;
        round_item.item_name_index = item_name_index;
        round_item.market_value = item_value;
        round_item.winning_bid = None;
        round_item.winner = None;

        msg!(
            "Round {} started. Item index: {}, Hidden value: {} lamports",
            game.current_round,
            item_name_index,
            item_value
        );
        Ok(())
    }

    // ── INSTRUCTION 6: SUBMIT BID ───────────────────────────────────
    pub fn submit_bid(ctx: Context<SubmitBid>, _game_id: u64, bid_amount: u64) -> Result<()> {
        let game = &ctx.accounts.game;
        let player_state = &mut ctx.accounts.player_state;

        require!(game.round_active, BlitzError::RoundNotActive);
        require!(!player_state.is_eliminated, BlitzError::PlayerEliminated);
        require!(!player_state.has_bid_this_round, BlitzError::AlreadyBid);
        require!(bid_amount > 0, BlitzError::InvalidBid);

        player_state.current_bid = Some(bid_amount);
        player_state.has_bid_this_round = true;

        msg!("Player {} bid {} lamports (hidden)", ctx.accounts.player.key(), bid_amount);
        Ok(())
    }

    // ── INSTRUCTION 7: RESOLVE ROUND ────────────────────────────────
    pub fn resolve_round(ctx: Context<ResolveRound>, _game_id: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let round_item = &mut ctx.accounts.round_item;

        require!(game.round_active, BlitzError::RoundNotActive);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= game.round_start_time + 10,
            BlitzError::BiddingWindowOpen
        );

        let item_value = game.current_item_value;

        let mut highest_bid: u64 = 0;
        let mut highest_bidder_index: Option<usize> = None;
        let mut lowest_score: i64 = i64::MAX;
        let mut lowest_score_index: Option<usize> = None;

        let mut player_states: Vec<(usize, Pubkey, u64, i64, bool)> = Vec::new();
        for (i, account_info) in ctx.remaining_accounts.iter().enumerate() {
            let data = account_info.try_borrow_data()?;
            let ps: PlayerState = AccountDeserialize::try_deserialize(&mut &data[..])?;
            if ps.is_eliminated {
                player_states.push((i, ps.player, 0, ps.score, true));
                continue;
            }
            let bid = ps.current_bid.unwrap_or(0);
            player_states.push((i, ps.player, bid, ps.score, false));

            if bid > highest_bid {
                highest_bid = bid;
                highest_bidder_index = Some(i);
            }
        }

        for (i, player, bid, score, eliminated) in player_states.iter_mut() {
            if *eliminated { continue; }

            if Some(*i) == highest_bidder_index {
                let delta = item_value as i64 - *bid as i64;
                *score += delta;
                round_item.winner = Some(*player);
                round_item.winning_bid = Some(*bid);
            }

            let account_info = &ctx.remaining_accounts[*i];
            let mut data = account_info.try_borrow_mut_data()?;
            let mut ps: PlayerState = AccountDeserialize::try_deserialize(&mut &data[..])?;
            ps.score = *score;
            ps.current_bid = None;
            ps.has_bid_this_round = false;
            ps.try_serialize(&mut *data)?;
        }

        for (i, _, _, score, eliminated) in &player_states {
            if *eliminated { continue; }
            if *score < lowest_score {
                lowest_score = *score;
                lowest_score_index = Some(*i);
            }
        }

        if let Some(elim_idx) = lowest_score_index {
            let active_count = player_states.iter().filter(|(_, _, _, _, e)| !e).count();
            if active_count > 1 {
                let account_info = &ctx.remaining_accounts[elim_idx];
                let mut data = account_info.try_borrow_mut_data()?;
                let mut ps: PlayerState = AccountDeserialize::try_deserialize(&mut &data[..])?;
                ps.is_eliminated = true;
                ps.try_serialize(&mut *data)?;

                let (_, elim_player, _, _, _) = &player_states[elim_idx];
                for j in 0..game.player_count as usize {
                    if game.players[j] == *elim_player {
                        game.eliminated[j] = true;
                        break;
                    }
                }

                msg!("Player {} eliminated with score {}", elim_player, lowest_score);
            }
        }

        game.round_active = false;

        let active_players: Vec<&(usize, Pubkey, u64, i64, bool)> =
            player_states.iter().filter(|(_, _, _, _, e)| !e).collect();

        if active_players.len() == 1 || game.current_round >= NUM_ROUNDS {
            game.status = GameStatus::Completed;
            if active_players.len() == 1 {
                game.winner = Some(active_players[0].1);
            } else {
                let winner = active_players.iter().max_by_key(|(_, _, _, s, _)| s);
                if let Some(w) = winner {
                    game.winner = Some(w.1);
                }
            }
            msg!("Game over! Winner: {:?}", game.winner);
        }

        Ok(())
    }

    // ── INSTRUCTION 8: SETTLE GAME ──────────────────────────────────
    pub fn settle_game(ctx: Context<SettleGame>) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(game.status == GameStatus::Completed, BlitzError::GameNotInProgress);

        let winner = game.winner.ok_or(BlitzError::Unauthorized)?;
        require!(ctx.accounts.winner.key() == winner, BlitzError::Unauthorized);

        let vault_lamports = ctx.accounts.vault.lamports();
        **ctx.accounts.vault.try_borrow_mut_lamports()? -= vault_lamports;
        **ctx.accounts.winner.try_borrow_mut_lamports()? += vault_lamports;

        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.game.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        msg!("Game settled. {} lamports transferred to {}", vault_lamports, winner);
        Ok(())
    }

    pub fn reveal_round_permissions<'info>(ctx: Context<'_, '_, '_, 'info, RevealPermissions<'info>>, _game_id: u64) -> Result<()> {
        for account_info in ctx.remaining_accounts.iter() {
            UpdatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
                .permissioned_account(account_info, true)
                .authority(account_info, false)
                .permission(&ctx.accounts.permission)
                .args(MembersArgs { members: None })
                .invoke()?;
        }
        msg!("Round bids revealed (permissions set to public)");
        Ok(())
    }
}

// ── ACCOUNT CONTEXTS ────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + 308,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + 68,
        seeds = [PLAYER_STATE_SEED, &game_id.to_le_bytes(), creator.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,

    /// CHECK: Vault PDA to hold the pot
    #[account(
        init_if_needed,
        payer = creator,
        space = 0,
        seeds = [VAULT_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init_if_needed,
        payer = player,
        space = 8 + 68,
        seeds = [PLAYER_STATE_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,

    /// CHECK: Vault PDA
    #[account(mut, seeds = [VAULT_SEED, &game_id.to_le_bytes()], bump)]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateGameInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Checked by delegate program
    pub validator: Option<AccountInfo<'info>>,
    #[account(mut, del)]
    pub game: Account<'info, Game>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct DelegatePlayerStateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Checked by delegate program
    pub validator: Option<AccountInfo<'info>>,
    #[account(mut, del, seeds = [PLAYER_STATE_SEED, &game_id.to_le_bytes(), payer.key().as_ref()], bump)]
    pub player_state: Account<'info, PlayerState>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateBidPermission<'info> {
    #[account(
        seeds = [PLAYER_STATE_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,
    /// CHECK: Permission PDA (derived by permission program)
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    /// CHECK: Permission Program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct StartRoundCtx<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 69,
        seeds = [ROUND_ITEM_SEED, &game.game_id.to_le_bytes(), &[game.current_round + 1]],
        bump
    )]
    pub round_item: Account<'info, RoundItem>,
    /// CHECK: Oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackStartRoundCtx<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub round_item: Account<'info, RoundItem>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct SubmitBid<'info> {
    #[account(seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        seeds = [PLAYER_STATE_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct ResolveRound<'info> {
    #[account(mut, seeds = [GAME_SEED, &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [ROUND_ITEM_SEED, &game_id.to_le_bytes(), &[game.current_round]], bump)]
    pub round_item: Account<'info, RoundItem>,
    #[account(mut)]
    pub payer: Signer<'info>,
    // remaining_accounts: all PlayerState PDAs
}

#[commit]
#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    /// CHECK: Vault PDA
    #[account(mut, seeds = [VAULT_SEED, &game.game_id.to_le_bytes()], bump)]
    pub vault: AccountInfo<'info>,
    /// CHECK: Winner
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct RevealPermissions<'info> {
    /// CHECK: Permission PDA
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission Program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    // remaining_accounts: all PlayerState account infos to reveal
}
