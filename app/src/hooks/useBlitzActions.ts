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

    const getProgram = (connection: Connection = mainnetConnection) => {
        if (!wallet) throw new Error("Wallet not connected");
        const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        return new Program(idl as Blitz, provider);
    };

    const getTeeProgram = async () => {
        if (!wallet) throw new Error("Wallet not connected");

        // Get Auth Token for TEE
        const authToken = await getAuthToken(
            TEE_URL,
            wallet.publicKey,
            async (message) => await signMessage!(message)
        );

        const teeEndpoint = `${TEE_URL}?token=${authToken.token}`;
        const teeConn = new Connection(teeEndpoint, {
            wsEndpoint: `wss://tee.magicblock.app?token=${authToken.token}`,
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

    const delegateToTee = async () => {
        const program = getProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);
        const validator = new PublicKey(TEE_VALIDATOR);
        const permissionPda = getPermissionPda(playerStatePda);

        console.log("Starting delegation process...");

        // 1. Delegate Game PDA
        const tx1 = await program.methods.delegateGame()
            .accounts({
                payer: wallet!.publicKey,
                validator,
                game: gamePda,
                // These are derived by Anchor if IDL is correct, but let's be safe
                bufferGame: PublicKey.findProgramAddressSync([Buffer.from("buffer"), gamePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationRecordGame: PublicKey.findProgramAddressSync([Buffer.from("delegation"), gamePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationMetadataGame: PublicKey.findProgramAddressSync([Buffer.from("delegation-metadata"), gamePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                ownerProgram: BLITZ_PROGRAM_ID,
                delegationProgram: new PublicKey(DELEGATION_PROGRAM_ID),
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();
        await sendAndConfirm(tx1, mainnetConnection);

        // 2. Delegate PlayerState PDA
        const tx2 = await program.methods.delegatePlayerState(gameId)
            .accounts({
                payer: wallet!.publicKey,
                validator,
                playerState: playerStatePda,
                bufferPlayerState: PublicKey.findProgramAddressSync([Buffer.from("buffer"), playerStatePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationRecordPlayerState: PublicKey.findProgramAddressSync([Buffer.from("delegation"), playerStatePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                delegationMetadataPlayerState: PublicKey.findProgramAddressSync([Buffer.from("delegation-metadata"), playerStatePda.toBuffer()], new PublicKey(DELEGATION_PROGRAM_ID))[0],
                ownerProgram: BLITZ_PROGRAM_ID,
                delegationProgram: new PublicKey(DELEGATION_PROGRAM_ID),
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();
        await sendAndConfirm(tx2, mainnetConnection);

        // 3. Create Bid Permission (PER)
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

        // Wait for permission to be active on TEE
        await waitUntilPermissionActive(TEE_URL, playerStatePda);
        console.log("Delegation and PER setup complete.");
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

        const gameAcc = await program.account.game.fetch(gamePda);
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
        const [gamePda] = getGamePda(gameIdNumber);
        const gameAcc = await program.account.game.fetch(gamePda);

        // We reveal by updating permissions to public for all player states
        for (const playerPubkey of gameAcc.players) {
            if (playerPubkey.equals(PublicKey.default)) continue;

            const [playerStatePda] = getPlayerStatePda(gameIdNumber, playerPubkey);
            const permissionPda = getPermissionPda(playerStatePda);

            const tx = await program.methods.revealRoundPermissions(new anchor.BN(gameIdNumber))
                .accounts({
                    permission: permissionPda,
                    permissionProgram: new PublicKey(PERMISSION_PROGRAM_ID),
                    payer: wallet!.publicKey,
                } as any)
                .remainingAccounts([{
                    pubkey: playerStatePda,
                    isSigner: false,
                    isWritable: true
                }])
                .transaction();

            await sendAndConfirm(tx, program.provider.connection as Connection);
        }
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
        delegateToTee,
        startRound,
        submitBid,
        resolveRound,
        revealRoundBids,
        settleGame
    };
}
