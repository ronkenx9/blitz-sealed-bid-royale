import { useState } from 'react';
import { useBlitzActions } from '../hooks/useBlitzActions';
import { useBlitzGame } from '../hooks/useBlitzGame';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { ITEM_NAMES } from '../utils/constants';
import { useGameMode } from '../App';

interface RevealPhaseProps {
    setPhase: (phase: string) => void;
}

export function RevealPhase({ setPhase }: RevealPhaseProps) {
    const { mode, aiGame, gameId: GAME_ID_NUM } = useGameMode();
    const pvpGame = useBlitzGame(mode === 'pvp' ? GAME_ID_NUM.toString() : undefined);
    const {
        resolveRound: resolveRoundTx,
        revealRoundBids: revealRoundBidsTx
    } = useBlitzActions(GAME_ID_NUM);
    const wallet = useAnchorWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    // ── AI MODE ──
    if (mode === 'ai') {
        const { roundItem, players, currentRound, totalRounds, gameOver } = aiGame;

        if (!roundItem) {
            return <div className="section-title">Preparing results...</div>;
        }

        const itemName = ITEM_NAMES[roundItem.itemNameIndex % ITEM_NAMES.length];
        const trueValue = roundItem.marketValue / 1e9;

        // Sort: highest bid first, eliminated last
        const sorted = [...players].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            return b.currentBid - a.currentBid;
        });

        // Rankings by score
        const rankings = [...players].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            return b.score - a.score;
        });

        const highestScore = Math.max(...players.map(p => Math.abs(p.score)), 1);

        const handleResolveAI = () => {
            aiGame.resolveRound();
        };

        const handleNextRound = () => {
            if (aiGame.gameOver || currentRound >= totalRounds) {
                setPhase('gameover');
            } else {
                aiGame.startRound();
                setPhase('bidding');
            }
        };

        // Check if round is already resolved (player with isEliminated updated this round)

        return (
            <>
                <div className="reveal-header">
                    <div className="reveal-title">⚡ BIDS REVEALED ⚡</div>
                    <div className="reveal-item-name">{itemName}</div>
                    <div className="reveal-true-val">
                        TRUE MARKET VALUE: <span>◎ {trueValue.toFixed(3)} SOL</span>
                    </div>
                </div>

                <div className="section-title">👁 ROUND {currentRound} RESULTS</div>

                <div className="bid-reveals">
                    {sorted.map((p, idx) => {
                        const bidAmount = p.currentBid / 1e9;
                        const isWinner = idx === 0 && !p.isEliminated && p.currentBid > 0;

                        let deltaStr = "— (no bid)";
                        let deltaClass = "";

                        if (p.currentBid > 0 && isWinner) {
                            const delta = trueValue - bidAmount;
                            deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(3)} SOL`;
                            deltaClass = delta >= 0 ? 'pos' : 'neg';
                        } else if (p.currentBid > 0) {
                            deltaStr = "— (outbid)";
                        }

                        const scoreVal = p.score / 1e9;
                        const scoreStr = `${scoreVal > 0 ? '+' : ''}${scoreVal.toFixed(3)}`;
                        const scoreColor = scoreVal >= 0 ? 'var(--green)' : 'var(--crimson)';

                        return (
                            <div key={p.name} className={`reveal-card ${isWinner ? 'winner' : ''} ${p.isYou ? 'you-card' : ''} ${p.isEliminated ? 'eliminated-card' : ''}`}>
                                <span className="rc-avatar">{p.isEliminated ? '💀' : p.emoji}</span>
                                <div className="rc-name">
                                    {p.name} {p.isYou && <span style={{ color: 'var(--blue)', fontSize: '9px' }}>YOU</span>}
                                </div>
                                <div className="rc-bid-label">SEALED BID</div>
                                <div className="rc-bid">◎ {bidAmount > 0 ? bidAmount.toFixed(3) : 'NONE'}</div>
                                <div className={`rc-delta ${deltaClass}`} style={!isWinner ? { color: 'var(--dim)' } : {}}>
                                    {p.isEliminated ? 'ELIMINATED' : deltaStr}
                                </div>
                                <div className="rc-score-label">TOTAL SCORE</div>
                                <div className="rc-total" style={{ color: scoreColor }}>{scoreStr}</div>
                            </div>
                        );
                    })}
                </div>

                {/* STANDINGS */}
                <div className="section-title" style={{ marginTop: '32px' }}>⚔ STANDINGS</div>
                <div style={{ maxWidth: '520px' }}>
                    {rankings.map((p, idx) => {
                        const scoreVal = p.score / 1e9;
                        const scoreStr = `${scoreVal > 0 ? '+' : ''}${scoreVal.toFixed(3)}`;
                        let widthPct = Math.max(5, (Math.abs(p.score) / highestScore) * 100);
                        if (p.isEliminated) widthPct = 0;

                        return (
                            <div key={p.name} className={`score-row ${idx === 0 && !p.isEliminated ? 'first-place' : ''} ${p.isEliminated ? 'eliminated-row' : ''}`} style={{ position: 'relative' }}>
                                <div className={`score-rank ${idx === 0 && !p.isEliminated ? 'gold' : ''}`} style={p.isEliminated ? { color: 'var(--crimson)' } : {}}>
                                    {p.isEliminated ? '✝' : idx + 1}
                                </div>
                                <div className="score-avatar">{p.isEliminated ? '💀' : p.emoji}</div>
                                <div className="score-name">{p.name} {p.isYou && '(YOU)'}</div>
                                <div className={`score-val ${scoreVal >= 0 ? 'pos' : 'neg'}`}>{scoreStr}</div>
                                <div className="score-bar-wrap">
                                    <div className="score-bar" style={{
                                        width: `${widthPct}%`,
                                        background: p.isEliminated ? 'transparent' : (idx === 0 ? 'var(--gold)' : (scoreVal < 0 ? 'var(--crimson)' : 'var(--blue)'))
                                    }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="reveal-action">
                    <button className="btn btn-ghost" onClick={handleResolveAI}>
                        ⚡ RESOLVE ROUND
                    </button>
                    <button className="btn btn-primary btn-glow" onClick={handleNextRound}>
                        {gameOver || currentRound >= totalRounds ? '👑 FINAL RESULTS →' : '▶ NEXT ROUND →'}
                    </button>
                </div>
            </>
        );
    }

    // ── PVP MODE ──
    const { game, allPlayers, roundItem, refetch } = pvpGame;

    // Add a retry wrapper for resolveRound
    const resolveWithRetry = async (maxAttempts = 6) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await resolveRoundTx();
            } catch (e: any) {
                const msg = e?.message || '';
                const isTooEarly = msg.includes('BiddingWindowOpen')
                    || msg.includes('0x' + (6007).toString(16)); // Anchor error code
                if (isTooEarly && attempt < maxAttempts - 1) {
                    setStatusMsg(`Waiting for bid window to close... (${attempt + 1}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }
                throw e; // not a timing error, propagate
            }
        }
    };

    const handleNextPhase = async () => {
        try {
            setIsLoading(true);
            setStatusMsg('⏳ Revealing sealed bids...');
            await revealRoundBidsTx();

            setStatusMsg('⏳ Resolving round on TEE...');
            await resolveWithRetry();

            // resolveRound() triggers commit_and_undelegate which writes back to mainnet.
            // Wait for the committed state to propagate before reading it.
            setStatusMsg('⏳ Committing results to mainnet...');
            await new Promise(r => setTimeout(r, 3500));

            setStatusMsg('✅ Round resolved!');
            await refetch();
            if (game && (game.currentRound >= 5 || allPlayers.filter(p => !p.isEliminated).length <= 1)) {
                setTimeout(() => setPhase('gameover'), 1500);
            } else {
                setTimeout(() => setPhase('bidding'), 1500);
            }
        } catch (e: any) {
            console.error(e);
            setStatusMsg(`❌ Error: ${e.message?.slice(0, 100)}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!game || !roundItem) {
        return <div className="section-title">Awaiting Round Data...</div>;
    }

    const itemName = ITEM_NAMES[roundItem.itemNameIndex % ITEM_NAMES.length];
    const trueValue = roundItem.marketValue.toNumber() / 1e9;

    const sortedPlayers = [...allPlayers].sort((a, b) => {
        if (a.isEliminated && !b.isEliminated) return 1;
        if (!a.isEliminated && b.isEliminated) return -1;
        const bidA = a.currentBid ? a.currentBid.toNumber() : 0;
        const bidB = b.currentBid ? b.currentBid.toNumber() : 0;
        return bidB - bidA;
    });

    return (
        <>
            <div className="reveal-header">
                <div className="reveal-title">⚡ BIDS REVEALED ⚡</div>
                <div className="reveal-item-name">{itemName}</div>
                <div className="reveal-true-val">
                    TRUE MARKET VALUE: <span>◎ {trueValue.toFixed(3)} SOL</span>
                </div>
            </div>

            {statusMsg && (
                <div className="status-toast info" onClick={() => setStatusMsg(null)}>{statusMsg}</div>
            )}

            <div className="section-title">👁 ROUND RESULTS</div>

            <div className="bid-reveals">
                {sortedPlayers.map((p, idx) => {
                    const isYou = wallet && p.player.equals(wallet.publicKey);
                    const addrStr = p.player.toBase58();
                    const shortAddr = `${addrStr.substring(0, 4)}...${addrStr.slice(-4)}`;
                    const bidAmount = p.currentBid ? p.currentBid.toNumber() / 1e9 : 0;
                    const isWinner = idx === 0 && !p.isEliminated && bidAmount > 0;
                    let deltaStr = "— (lost)";
                    let deltaClass = "";
                    if (isWinner) {
                        const delta = trueValue - bidAmount;
                        deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(3)} SOL`;
                        deltaClass = delta >= 0 ? 'pos' : 'neg';
                    }
                    const scoreVal = p.score.toNumber() / 1e9;
                    const scoreStr = `${scoreVal > 0 ? '+' : ''}${scoreVal.toFixed(3)}`;
                    const scoreColor = scoreVal >= 0 ? 'var(--green)' : 'var(--crimson)';

                    return (
                        <div key={addrStr} className={`reveal-card ${isWinner ? 'winner' : ''} ${isYou ? 'you-card' : ''} ${p.isEliminated ? 'eliminated-card' : ''}`}>
                            <span className="rc-avatar">{isWinner ? '⚔️' : (p.isEliminated ? '💀' : '🗡️')}</span>
                            <div className="rc-name">{shortAddr} {isYou && <span style={{ color: 'var(--blue)', fontSize: '9px' }}>YOU</span>}</div>
                            <div className="rc-bid-label">SEALED BID</div>
                            <div className="rc-bid">◎ {bidAmount > 0 ? bidAmount.toFixed(3) : 'NONE'}</div>
                            <div className={`rc-delta ${deltaClass}`} style={!isWinner ? { color: 'var(--dim)' } : {}}>{p.isEliminated ? 'ELIMINATED' : deltaStr}</div>
                            <div className="rc-score-label">TOTAL SCORE</div>
                            <div className="rc-total" style={{ color: scoreColor }}>{scoreStr}</div>
                        </div>
                    );
                })}
            </div>

            <div className="reveal-action">
                <button className="btn btn-ghost" onClick={() => setPhase('bidding')}>◀ BACK TO BIDDING</button>
                <button className="btn btn-primary btn-glow" onClick={handleNextPhase} disabled={isLoading || !wallet}>
                    {isLoading ? '⏳ RESOLVING...' : '▶ RESOLVE & CONTINUE →'}
                </button>
            </div>
        </>
    );
}
