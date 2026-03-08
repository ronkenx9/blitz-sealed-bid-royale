import { useRef } from 'react';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
    getAuthToken,
    waitUntilPermissionActive
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
    mainnetConnection,
    getGamePda,
    getPlayerStatePda,
    getVaultPda,
    getPermissionPda,
    getRoundItemPda,
    BLITZ_PROGRAM_ID
} from '../utils/anchor';
import {
    TEE_VALIDATOR,
    TEE_URL,
    PERMISSION_PROGRAM_ID,
    VRF_DEFAULT_QUEUE,
    VRF_PROGRAM_ID,
    DELEGATION_PROGRAM_ID,
    MAGIC_PROGRAM_ID,
    MAGIC_CONTEXT_ID
} from '../utils/constants';
import idl from '../target/idl/blitz.json';
import type { Blitz } from '../target/types/blitz';

export function useBlitzActions(gameIdNumber: number) {
    const wallet = useAnchorWallet();
    const { signMessage } = useWallet();
    const teeAuthTokenRef = useRef<string | null>(null);

    const getAuthTokenCached = async () => {
        if (!wallet) throw new Error('Wallet not connected');

        // Guard: not all wallets support signMessage (e.g. Ledger, some mobile)
        if (!signMessage) {
            throw new Error(
                'Your wallet does not support message signing, which is required ' +
                'for TEE authentication. Please use Phantom or Solflare.'
            );
        }

        if (teeAuthTokenRef.current) return teeAuthTokenRef.current;
        const auth = await getAuthToken(TEE_URL, wallet.publicKey, signMessage);
        teeAuthTokenRef.current = auth.token;
        return auth.token;
    };

    const getProgram = (connection: Connection = mainnetConnection) => {
        if (!wallet) throw new Error("Wallet not connected");
        const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        return new Program(idl as Blitz, provider);
    };

    const getTeeProgram = async () => {
        if (!wallet) throw new Error("Wallet not connected");

        // Get Auth Token for TEE
        const token = await getAuthTokenCached();

        const teeEndpoint = `${TEE_URL}?token=${token}`;
        const teeConn = new Connection(teeEndpoint, {
            wsEndpoint: `wss://tee.magicblock.app?token=${token}`,
            commitment: 'confirmed'
        });

        const provider = new anchor.AnchorProvider(teeConn, wallet, { commitment: 'confirmed' });
        return new Program(idl as Blitz, provider);
    };

    const sendAndConfirm = async (tx: Transaction, connection: Connection) => {
        if (!wallet) throw new Error("Wallet not connected");
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = wallet.publicKey;
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
        return sig;
    };

    const createGame = async () => {
        const program = getProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);
        const [vaultPda] = getVaultPda(gameIdNumber);

        const tx = await program.methods.createGame(gameId)
            .accounts({
                game: gamePda,
                playerState: playerStatePda,
                vault: vaultPda,
                creator: wallet!.publicKey,
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();

        return sendAndConfirm(tx, mainnetConnection);
    };

    const joinGame = async () => {
        const program = getProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);
        const [vaultPda] = getVaultPda(gameIdNumber);

        const tx = await program.methods.joinGame(gameId)
            .accounts({
                game: gamePda,
                playerState: playerStatePda,
                vault: vaultPda,
                player: wallet!.publicKey,
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();

        return sendAndConfirm(tx, mainnetConnection);
    };

    // ─── CREATOR ONLY: call once when all players have joined ───────────────────
    const delegateGame = async () => {
        const program = getProgram();
        const [gamePda] = getGamePda(gameIdNumber);
        const validator = new PublicKey(TEE_VALIDATOR);

        // 1a. Delegate the Game PDA (creator only — Rust enforces this)
        const tx1 = await program.methods.delegateGame()
            .accounts({
                payer: wallet!.publicKey,
                validator,
                game: gamePda,
                bufferGame: PublicKey.findProgramAddressSync(
                    [Buffer.from('buffer'), gamePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationRecordGame: PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation'), gamePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationMetadataGame: PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation-metadata'), gamePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                ownerProgram: BLITZ_PROGRAM_ID,
                delegationProgram: new PublicKey(DELEGATION_PROGRAM_ID),
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();
        await sendAndConfirm(tx1, mainnetConnection);
        console.log('Game PDA delegated to TEE');
    };

    // ─── ALL PLAYERS: each player calls this for themselves ──────────────────────
    const delegatePlayerState = async () => {
        const program = getProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);
        const permissionPda = getPermissionPda(playerStatePda);
        const validator = new PublicKey(TEE_VALIDATOR);

        // 2a. Delegate this player's PlayerState PDA
        const tx2 = await program.methods.delegatePlayerState(gameId)
            .accounts({
                payer: wallet!.publicKey,
                validator,
                playerState: playerStatePda,
                bufferPlayerState: PublicKey.findProgramAddressSync(
                    [Buffer.from('buffer'), playerStatePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationRecordPlayerState: PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation'), playerStatePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationMetadataPlayerState: PublicKey.findProgramAddressSync(
                    [Buffer.from('delegation-metadata'), playerStatePda.toBuffer()],
                    new PublicKey(DELEGATION_PROGRAM_ID))[0],
                ownerProgram: BLITZ_PROGRAM_ID,
                delegationProgram: new PublicKey(DELEGATION_PROGRAM_ID),
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();
        await sendAndConfirm(tx2, mainnetConnection);

        // 2b. Set up PER access control for this player's sealed bids
        const tx3 = await program.methods.createBidPermission(gameId)
            .accounts({
                playerState: playerStatePda,
                permission: permissionPda,
                player: wallet!.publicKey,
                permissionProgram: new PublicKey(PERMISSION_PROGRAM_ID),
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();
        await sendAndConfirm(tx3, mainnetConnection);

        // 2c. Block until TEE acknowledges the permission is active
        await waitUntilPermissionActive(TEE_URL, playerStatePda);
        console.log('PlayerState delegated and PER permission active');
    };

    const startRound = async (clientSeed: number = Math.floor(Math.random() * 255)) => {
        const program = await getTeeProgram();
        const [gamePda] = getGamePda(gameIdNumber);

        // Fetch game to get current round
        const gameAcc = await (program.account as any).game.fetch(gamePda);
        const [roundItemPda] = getRoundItemPda(gameIdNumber, gameAcc.currentRound + 1);

        const tx = await program.methods.startRound(clientSeed)
            .accounts({
                payer: wallet!.publicKey,
                game: gamePda,
                roundItem: roundItemPda,
                oracleQueue: new PublicKey(VRF_DEFAULT_QUEUE),
                systemProgram: SystemProgram.programId,
                programIdentity: PublicKey.findProgramAddressSync([Buffer.from("identity")], new PublicKey(VRF_PROGRAM_ID))[0],
                vrfProgram: new PublicKey(VRF_PROGRAM_ID),
                slotHashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
            } as any)
            .transaction();

        return sendAndConfirm(tx, program.provider.connection as Connection);
    };

    const submitBid = async (lamports: number) => {
        const program = await getTeeProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);

        const tx = await program.methods.submitBid(gameId, new anchor.BN(lamports))
            .accounts({
                game: gamePda,
                playerState: playerStatePda,
                player: wallet!.publicKey,
            } as any)
            .transaction();

        return sendAndConfirm(tx, program.provider.connection as Connection);
    };

    const resolveRound = async () => {
        const program = await getTeeProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);

        const gameAcc = await (program.account as any).game.fetch(gamePda);
        const [roundItemPda] = getRoundItemPda(gameIdNumber, gameAcc.currentRound);

        // Prepare remaining accounts (all player states)
        const playerStates = gameAcc.players
            .filter((p: PublicKey) => !p.equals(PublicKey.default))
            .map((p: PublicKey) => ({
                pubkey: getPlayerStatePda(gameIdNumber, p)[0],
                isSigner: false,
                isWritable: true,
            }));

        const tx = await program.methods.resolveRound(gameId)
            .accounts({
                game: gamePda,
                roundItem: roundItemPda,
                payer: wallet!.publicKey,
            } as any)
            .remainingAccounts(playerStates)
            .transaction();

        return sendAndConfirm(tx, program.provider.connection as Connection);
    };

    const revealRoundBids = async () => {
        const program = await getTeeProgram();
        const teeConn = program.provider.connection as Connection;
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);

        const gameAcc = await (program.account as any).game.fetch(gamePda);

        // Build the list of all active (non-default) player state PDAs
        const playerStatePdas = gameAcc.players
            .filter((pk: PublicKey) => !pk.equals(PublicKey.default))
            .map((pk: PublicKey) => ({
                pubkey: getPlayerStatePda(gameIdNumber, pk)[0],
                isSigner: false,
                isWritable: true,
            }));

        // The permission PDA for the first player (used as the primary account).
        // All player state accounts are passed as remainingAccounts.
        const firstPlayerPda = playerStatePdas[0]?.pubkey;
        if (!firstPlayerPda) throw new Error('No players found in game');
        const permissionPda = getPermissionPda(firstPlayerPda);

        // Single transaction — all players revealed atomically
        const tx = await program.methods
            .revealRoundPermissions(gameId)
            .accounts({
                permission: permissionPda,
                permissionProgram: new PublicKey(PERMISSION_PROGRAM_ID),
                payer: wallet!.publicKey,
            } as any)
            .remainingAccounts(playerStatePdas)
            .transaction();

        return sendAndConfirm(tx, teeConn);
    };

    const settleGame = async () => {
        const program = await getTeeProgram();
        const [gamePda] = getGamePda(gameIdNumber);
        const [vaultPda] = getVaultPda(gameIdNumber);

        const gameAccount = await (program.account as any).game.fetch(gamePda);
        const winner = gameAccount.winner;
        if (!winner) throw new Error("No winner decided yet");

        const tx = await program.methods.settleGame()
            .accounts({
                game: gamePda,
                vault: vaultPda,
                winner: winner,
                payer: wallet!.publicKey,
                magicProgram: new PublicKey(MAGIC_PROGRAM_ID),
                magicContext: new PublicKey(MAGIC_CONTEXT_ID),
            } as any)
            .transaction();

        return sendAndConfirm(tx, program.provider.connection as Connection);
    };

    return {
        createGame,
        joinGame,
        delegateGame,
        delegatePlayerState,
        getAuthTokenCached,
        startRound,
        submitBid,
        resolveRound,
        revealRoundBids,
        settleGame
    };
}
