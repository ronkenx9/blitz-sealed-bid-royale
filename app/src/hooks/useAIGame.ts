import { useState, useCallback } from 'react';
import { ITEM_NAMES } from '../utils/constants';

// ── AI BOT PERSONALITIES ──
export type BotPersonality = {
    name: string;
    emoji: string;
    style: string;
    quote: string;
    /** Given the true value, returns the bot's bid */
    bidStrategy: (trueValue: number, round: number, prevPlayerBid?: number) => number;
};

export const AI_BOTS: BotPersonality[] = [
    {
        name: 'CRYPTOKNIGHT',
        emoji: '🤖',
        style: 'AGGRESSIVE',
        quote: '"I\'d rather win than be right."',
        bidStrategy: (tv) => {
            // Overbids 5-25% above true value
            const mult = 1.05 + Math.random() * 0.20;
            return Math.round(tv * mult);
        },
    },
    {
        name: 'VOIDMAGE',
        emoji: '👾',
        style: 'CONSERVATIVE',
        quote: '"Patience is the ultimate weapon."',
        bidStrategy: (tv) => {
            // Bids 55-75% of true value
            const mult = 0.55 + Math.random() * 0.20;
            return Math.round(tv * mult);
        },
    },
    {
        name: 'SHADOWROGUE',
        emoji: '🕹️',
        style: 'WILDCARD',
        quote: '"Chaos is a ladder."',
        bidStrategy: (tv) => {
            // Random 20-160% of value
            const mult = 0.20 + Math.random() * 1.40;
            return Math.round(tv * mult);
        },
    },
    {
        name: 'IRONCLAD',
        emoji: '⚙️',
        style: 'CALCULATED',
        quote: '"Math doesn\'t lie."',
        bidStrategy: (tv) => {
            // Bids 85-105% of true value (close to fair)
            const mult = 0.85 + Math.random() * 0.20;
            return Math.round(tv * mult);
        },
    },
    {
        name: 'ORACLE',
        emoji: '🔮',
        style: 'ADAPTIVE',
        quote: '"I see through you."',
        bidStrategy: (tv, _round, prevPlayerBid) => {
            // If it knows the player's last bid, bids slightly above
            if (prevPlayerBid && prevPlayerBid > 0) {
                const delta = (Math.random() * 0.1 - 0.05);
                return Math.round(prevPlayerBid * (1 + delta));
            }
            // Default: bid 90-100% of true value
            const mult = 0.90 + Math.random() * 0.10;
            return Math.round(tv * mult);
        },
    },
];

// ── PLAYER/BOT STATE ──
export type AIPlayerState = {
    name: string;
    emoji: string;
    isBot: boolean;
    isYou: boolean;
    score: number;
    currentBid: number;
    hasBid: boolean;
    isEliminated: boolean;
    style?: string;
    quote?: string;
};

export type AIRoundItem = {
    itemNameIndex: number;
    marketValue: number; // lamports
};

export type AIGamePhase = 'lobby' | 'bidding' | 'reveal' | 'gameover';

// ── THE HOOK ──
export function useAIGame() {
    const [players, setPlayers] = useState<AIPlayerState[]>([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds] = useState(5);
    const [roundItem, setRoundItem] = useState<AIRoundItem | null>(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [lastPlayerBid, setLastPlayerBid] = useState(0);
    const [botBidTimers, setBotBidTimers] = useState<string[]>([]); // bot names that have "bid"

    // Create the AI game — instant
    const createAIGame = useCallback(() => {
        const aiPlayers: AIPlayerState[] = [
            {
                name: 'YOU',
                emoji: '⚔️',
                isBot: false,
                isYou: true,
                score: 0,
                currentBid: 0,
                hasBid: false,
                isEliminated: false,
            },
            ...AI_BOTS.map(bot => ({
                name: bot.name,
                emoji: bot.emoji,
                isBot: true,
                isYou: false,
                score: 0,
                currentBid: 0,
                hasBid: false,
                isEliminated: false,
                style: bot.style,
                quote: bot.quote,
            })),
        ];
        setPlayers(aiPlayers);
        setCurrentRound(0);
        setGameStarted(true);
        setGameOver(false);
        setBotBidTimers([]);
    }, []);

    // Start a new round — generate random item
    const startRound = useCallback(() => {
        const itemIndex = Math.floor(Math.random() * ITEM_NAMES.length);
        // Random value between 0.01 and 0.10 SOL (in lamports)
        const value = 10_000_000 + Math.floor(Math.random() * 90_000_000);

        setRoundItem({ itemNameIndex: itemIndex, marketValue: value });
        setCurrentRound(prev => prev + 1);
        setBotBidTimers([]);

        // Reset bids for all players
        setPlayers(prev => prev.map(p => ({
            ...p,
            currentBid: 0,
            hasBid: false,
        })));
    }, []);

    // Player submits their bid
    const submitPlayerBid = useCallback((bidLamports: number) => {
        setLastPlayerBid(bidLamports);
        setPlayers(prev => prev.map(p =>
            p.isYou ? { ...p, currentBid: bidLamports, hasBid: true } : p
        ));
    }, []);

    // AI bots submit their bids (called with staggered delays from the UI)
    const submitBotBids = useCallback(() => {
        if (!roundItem) return;

        const tv = roundItem.marketValue;
        const newPlayers = [...players];

        for (let i = 0; i < newPlayers.length; i++) {
            const p = newPlayers[i];
            if (!p.isBot || p.isEliminated) continue;

            const bot = AI_BOTS.find(b => b.name === p.name);
            if (!bot) continue;

            const bid = bot.bidStrategy(tv, currentRound, lastPlayerBid);
            // Clamp bid to valid range
            const clampedBid = Math.max(10_000_000, Math.min(100_000_000, bid));
            newPlayers[i] = { ...p, currentBid: clampedBid, hasBid: true };
        }

        setPlayers(newPlayers);
    }, [roundItem, players, currentRound, lastPlayerBid]);

    // Resolve the round — find winner, apply scoring, eliminate lowest
    const resolveRound = useCallback(() => {
        if (!roundItem) return;

        const tv = roundItem.marketValue;
        let updated = [...players];

        // Find highest bidder among non-eliminated
        let highestBid = 0;
        let highestIdx = -1;

        for (let i = 0; i < updated.length; i++) {
            if (updated[i].isEliminated) continue;
            if (updated[i].currentBid > highestBid) {
                highestBid = updated[i].currentBid;
                highestIdx = i;
            }
        }

        const startingPlayers = 6;
        const playersAlive = updated.filter(p => !p.isEliminated).length;

        // Calculation for all active players
        for (let i = 0; i < updated.length; i++) {
            if (updated[i].isEliminated) continue;

            const p = updated[i];
            let roundScore = 0;
            const bidRatio = p.currentBid / tv;
            const didWin = (i === highestIdx);

            // 1. ACCURACY POINTS (0-5000 for winners, 0-3000 for losers)
            if (bidRatio < 0.5 && p.currentBid > 0) {
                // Anti-farming rule: 0 pts for tiny bids
                roundScore += 0;
            } else if (p.currentBid === 0) {
                // Penalty for no bid
                roundScore -= 2000;
            } else {
                const accuracy = 1 - Math.abs(tv - p.currentBid) / tv;
                const baseAccuracy = Math.floor(accuracy * 5000);

                if (didWin) {
                    if (bidRatio > 1.2) {
                        // Reckless cliff: 0 accuracy points
                        roundScore += 0;
                    } else {
                        roundScore += baseAccuracy;
                    }
                } else {
                    // Loser cap
                    roundScore += Math.min(baseAccuracy, 3000);
                }
            }

            // 2. SCALED KILL BONUS (10,000 base)
            if (didWin) {
                const killMultiplier = startingPlayers / playersAlive;
                let killBonus = 10000 * killMultiplier;

                // Reckless Penalty: Half kill bonus if overbid > 20%
                if (bidRatio > 1.2) {
                    killBonus *= 0.5;
                }

                roundScore += Math.floor(killBonus);

                // 3. PROFIT MULTIPLIER (2x if smart win)
                if (p.currentBid < tv) {
                    roundScore *= 2;
                }
            }

            updated[i] = {
                ...p,
                score: p.score + roundScore
            };
        }

        // Find lowest score among non-eliminated
        const activePlayersAfter = updated.filter(p => !p.isEliminated);
        if (activePlayersAfter.length > 1) {
            let lowestScore = Infinity;
            let lowestIdx = -1;

            for (let i = 0; i < updated.length; i++) {
                if (updated[i].isEliminated) continue;
                if (updated[i].score < lowestScore) {
                    lowestScore = updated[i].score;
                    lowestIdx = i;
                }
            }

            if (lowestIdx >= 0) {
                updated[lowestIdx] = { ...updated[lowestIdx], isEliminated: true };
            }
        }

        setPlayers(updated);

        // Check game over
        const remaining = updated.filter(p => !p.isEliminated);
        if (remaining.length <= 1 || currentRound >= totalRounds) {
            setGameOver(true);
        }
    }, [roundItem, players, currentRound, totalRounds]);

    // Get the winner
    const winner = gameOver
        ? [...players].filter(p => !p.isEliminated).sort((a, b) => b.score - a.score)[0] || null
        : null;

    return {
        players,
        currentRound,
        totalRounds,
        roundItem,
        gameStarted,
        gameOver,
        winner,
        createAIGame,
        startRound,
        submitPlayerBid,
        submitBotBids,
        resolveRound,
        botBidTimers,
        setBotBidTimers,
    };
}
