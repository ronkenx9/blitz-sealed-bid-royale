import { useEffect, useState, useMemo } from 'react';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { mainnetConnection, getGamePda, getPlayerStatePda, getRoundItemPda } from '../utils/anchor';
import idl from '../target/idl/blitz.json';
import type { Blitz } from '../target/types/blitz';

export type GameData = {
    gameId: anchor.BN;
    creator: anchor.web3.PublicKey;
    playerCount: number;
    players: anchor.web3.PublicKey[];
    eliminated: boolean[];
    currentRound: number;
    roundActive: boolean;
    roundStartTime: anchor.BN;
    currentItemValue: anchor.BN;
    status: any;
    winner: anchor.web3.PublicKey | null;
    totalPot: anchor.BN;
};

export type PlayerStateData = {
    gameId: anchor.BN;
    player: anchor.web3.PublicKey;
    score: anchor.BN;
    currentBid: anchor.BN | null;
    hasBidThisRound: boolean;
    isEliminated: boolean;
};

export type RoundItemData = {
    gameId: anchor.BN;
    round: number;
    itemNameIndex: number;
    marketValue: anchor.BN;
    winningBid: anchor.BN | null;
    winner: anchor.web3.PublicKey | null;
};

export function useBlitzGame(gameIdStr?: string) {
    const wallet = useAnchorWallet();
    const [game, setGame] = useState<GameData | null>(null);
    const [myState, setMyState] = useState<PlayerStateData | null>(null);
    const [roundItem, setRoundItem] = useState<RoundItemData | null>(null);
    const [allPlayers, setAllPlayers] = useState<PlayerStateData[]>([]);
    const [error, setError] = useState<string | null>(null);

    const gameId = useMemo(() => {
        return gameIdStr ? new anchor.BN(gameIdStr) : null;
    }, [gameIdStr]);

    const mainnetProvider = useMemo(() => {
        if (!wallet) return null;
        return new anchor.AnchorProvider(mainnetConnection, wallet, { commitment: 'confirmed' });
    }, [wallet]);

    const programMainnet = useMemo(() => {
        if (!mainnetProvider) return null;
        return new Program(idl as Blitz, mainnetProvider);
    }, [mainnetProvider]);

    // Refetch function exposed for manual refresh
    const refetch = async () => {
        if (!programMainnet || !gameId || !wallet) return;
        try {
            const [gamePda] = getGamePda(gameId.toNumber());

            // Only fetch from mainnet (TEE requires auth tokens)
            const accountInfo = await mainnetConnection.getAccountInfo(gamePda);
            if (!accountInfo) {
                setGame(null);
                setMyState(null);
                setAllPlayers([]);
                setError(null);
                return;
            }

            const gameData = await programMainnet.account.game.fetch(gamePda);
            setGame(gameData as unknown as GameData);
            setError(null);

            // Fetch My State
            const [myStatePda] = getPlayerStatePda(gameId.toNumber(), wallet.publicKey);
            try {
                const myStateData = await programMainnet.account.playerState.fetch(myStatePda);
                setMyState(myStateData as unknown as PlayerStateData);
            } catch {
                setMyState(null);
            }

            // Fetch Round Item
            if (gameData.currentRound > 0) {
                const [roundItemPda] = getRoundItemPda(gameId.toNumber(), gameData.currentRound);
                try {
                    const riData = await programMainnet.account.roundItem.fetch(roundItemPda);
                    setRoundItem(riData as unknown as RoundItemData);
                } catch {
                    setRoundItem(null);
                }
            }

            // Fetch All Players
            const players: PlayerStateData[] = [];
            for (let i = 0; i < gameData.playerCount; i++) {
                const playerPubkey = gameData.players[i];
                if (playerPubkey.equals(anchor.web3.PublicKey.default)) continue;
                const [pda] = getPlayerStatePda(gameId.toNumber(), playerPubkey);
                try {
                    const pData = await programMainnet.account.playerState.fetch(pda);
                    players.push(pData as unknown as PlayerStateData);
                } catch {
                    // ignore
                }
            }
            setAllPlayers(players);

        } catch (err: any) {
            console.warn("Game fetch error (may not exist yet):", err?.message?.slice(0, 80));
            setError(err?.message || "Unknown error");
        }
    };

    useEffect(() => {
        if (!programMainnet || !gameId || !wallet) return;

        refetch();
        const interval = setInterval(refetch, 4000);
        return () => clearInterval(interval);
    }, [programMainnet, gameId, wallet]);

    return {
        game,
        myState,
        allPlayers,
        roundItem,
        error,
        refetch,
        programMainnet,
    };
}
