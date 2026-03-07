import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { mainnetConnection, getGamePda, getPlayerStatePda, getVaultPda } from '../utils/anchor';
import { TEE_VALIDATOR } from '../utils/constants';
import idl from '../target/idl/blitz.json';
import type { Blitz } from '../target/types/blitz';

export function useBlitzActions(gameIdNumber: number) {
    const wallet = useAnchorWallet();

    const getProgram = () => {
        if (!wallet) throw new Error("Wallet not connected");
        const provider = new anchor.AnchorProvider(mainnetConnection, wallet, { commitment: 'confirmed' });
        return new Program(idl as Blitz, provider);
    };

    const sendAndConfirm = async (tx: Transaction, connection: anchor.web3.Connection) => {
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
        const [playerStatePda] = getPlayerStatePda(gameIdNumber, wallet!.publicKey);
        const validator = new PublicKey(TEE_VALIDATOR);

        const tx = new Transaction();

        try {
            const ix1 = await program.methods.delegatePlayerState(gameId)
                .accounts({
                    payer: wallet!.publicKey,
                    validator,
                    playerState: playerStatePda,
                } as any)
                .instruction();
            tx.add(ix1);
        } catch (e) {
            console.warn("Delegate skipped (demo mode)", e);
        }

        // For hackathon demo, simulate with delay if tx is empty
        if (tx.instructions.length === 0) {
            return new Promise(r => setTimeout(r, 800));
        }
        return sendAndConfirm(tx, mainnetConnection);
    };

    const submitBid = async (lamports: number) => {
        const program = getProgram();
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

        return sendAndConfirm(tx, mainnetConnection);
    };

    const resolveRound = async () => {
        const program = getProgram();
        const gameId = new anchor.BN(gameIdNumber);
        const [gamePda] = getGamePda(gameIdNumber);
        const [vaultPda] = getVaultPda(gameIdNumber);

        const tx = await program.methods.resolveRound(gameId)
            .accounts({
                game: gamePda,
                vault: vaultPda,
                payer: wallet!.publicKey,
                systemProgram: SystemProgram.programId,
            } as any)
            .transaction();

        return sendAndConfirm(tx, mainnetConnection);
    };

    const settleGame = async () => {
        const program = getProgram();
        const [gamePda] = getGamePda(gameIdNumber);
        const [vaultPda] = getVaultPda(gameIdNumber);

        const gameAccount = await program.account.game.fetch(gamePda);
        const winner = gameAccount.winner;
        if (!winner) throw new Error("No winner decided yet");

        const tx = await program.methods.settleGame()
            .accounts({
                game: gamePda,
                vault: vaultPda,
                winner: winner,
            } as any)
            .transaction();

        return sendAndConfirm(tx, mainnetConnection);
    };

    return { createGame, joinGame, delegateToTee, submitBid, resolveRound, settleGame };
}
