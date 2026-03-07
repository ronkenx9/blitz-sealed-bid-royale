import { useState, useEffect } from 'react';
import { useBlitzActions } from '../hooks/useBlitzActions';
import { useGameMode } from '../App';
import { ITEM_NAMES } from '../utils/constants';

interface BiddingRoundProps {
    setPhase: (phase: string) => void;
    isActive: boolean;
}

export function BiddingRound({ setPhase, isActive }: BiddingRoundProps) {
    const { mode, aiGame } = useGameMode();
    const [timeLeft, setTimeLeft] = useState(10);
    const [lamports, setLamports] = useState(50000000);
    const [hasBid, setHasBid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [botStatuses, setBotStatuses] = useState<Record<string, boolean>>({});
    const { submitBid: submitBidTx } = useBlitzActions(8352204);

    useEffect(() => {
        if (!isActive) return;
        setHasBid(false);
        setTimeLeft(10);
        setBotStatuses({});
    }, [isActive]);

    useEffect(() => {
        if (!isActive || timeLeft <= 0 || hasBid) return;
        const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearInterval(timer);
    }, [isActive, timeLeft, hasBid]);

    // AI mode: stagger bot "thinking" animations
    useEffect(() => {
        if (mode !== 'ai' || !isActive || !hasBid) return;

        const bots = aiGame.players.filter(p => p.isBot && !p.isEliminated);
        bots.forEach((bot, i) => {
            setTimeout(() => {
                setBotStatuses(prev => ({ ...prev, [bot.name]: true }));
            }, 800 + i * 600 + Math.random() * 400);
        });

        // After all bots have "bid", auto-advance
        const totalDelay = 800 + bots.length * 700 + 1200;
        const timer = setTimeout(() => {
            aiGame.submitBotBids();
            setPhase('reveal');
        }, totalDelay);

        return () => clearTimeout(timer);
    }, [mode, isActive, hasBid]);

    const sol = (lamports / 1e9).toFixed(3);
    const pct = ((lamports - 10000000) / (100000000 - 10000000) * 100).toFixed(1);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLamports(parseInt(e.target.value));
    };

    const setBid = (val: number) => setLamports(val);

    const submitBid = async () => {
        if (mode === 'ai') {
            aiGame.submitPlayerBid(lamports);
            setHasBid(true);
            return;
        }

        // PvP mode
        try {
            setIsLoading(true);
            await submitBidTx(lamports);
            setHasBid(true);
        } catch (e) {
            console.error(e);
            setHasBid(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Get item info
    const itemName = mode === 'ai' && aiGame.roundItem
        ? ITEM_NAMES[aiGame.roundItem.itemNameIndex % ITEM_NAMES.length]
        : '🔮 MYSTERY ITEM';

    const currentRound = mode === 'ai' ? aiGame.currentRound : 1;
    const totalRounds = mode === 'ai' ? aiGame.totalRounds : 5;

    // Get active opponents for status strip
    const opponents = mode === 'ai'
        ? aiGame.players.filter(p => !p.isYou)
        : [];

    return (
        <>
            <div className="round-header">
                <div className="round-badge">⚔ ROUND {currentRound} / {totalRounds}</div>
                <div className="countdown-wrap">
                    <div className="countdown-label">TIME TO BID</div>
                    <div className="countdown-bar-outer">
                        <div className="countdown-bar-inner" id="cbar" style={{ animation: isActive && !hasBid ? 'drainBar 10s linear forwards' : 'none', width: hasBid || timeLeft === 0 ? '0%' : undefined }}></div>
                        <div className="countdown-num" id="cnum">{timeLeft}</div>
                    </div>
                </div>
            </div>

            <div className="bid-layout">

                {/* ITEM CARD */}
                <div className="item-card">
                    <div className="item-glow-ring">
                        <span className="item-icon">{itemName.split(' ')[0]}</span>
                    </div>
                    <div className="item-name">{itemName.split(' ').slice(1).join(' ') || 'MYSTERY ITEM'}</div>
                    <div className="item-value-label">MARKET VALUE</div>
                    <div className="item-hidden-val">??? SOL</div>
                    <div className="item-range">Range: 0.01 — 0.10 SOL</div>

                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontFamily: 'var(--pixel)', fontSize: '6px', color: 'var(--dim)', letterSpacing: '2px', marginBottom: '8px' }}>WINNER'S CURSE</div>
                        <div style={{ fontFamily: 'var(--vt)', fontSize: '20px', color: 'var(--text)', lineHeight: 1.6 }}>
                            Score = <span style={{ color: 'var(--purple)' }}>True Value</span> − <span style={{ color: 'var(--blue)' }}>Your Bid</span><br />
                            <span style={{ color: 'var(--crimson)' }}>Overbid = Penalty</span>
                        </div>
                    </div>
                </div>

                {/* BID PANEL */}
                {!hasBid ? (
                    <div className="bid-panel" id="bidPanel">
                        <div className="bid-panel-title">◈ PLACE YOUR SEALED BID</div>

                        <div className="bid-amount-display">
                            <div className="bid-sol" id="bidSolDisplay">◎ {sol} SOL</div>
                            <div className="bid-lamport" id="bidLamportDisplay">{lamports.toLocaleString()} lamports</div>
                        </div>

                        <div>
                            <div style={{ fontFamily: 'var(--pixel)', fontSize: '7px', color: 'var(--dim)', marginBottom: '8px' }}>ADJUST BID</div>
                            <input type="range" id="bidSlider" min="10000000" max="100000000" value={lamports}
                                onChange={handleSliderChange} style={{ '--pct': pct + '%' } as any} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--pixel)', fontSize: '6px', color: 'var(--dim)', marginTop: '4px' }}>
                                <span>0.01 SOL</span><span>0.10 SOL</span>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontFamily: 'var(--pixel)', fontSize: '7px', color: 'var(--dim)', marginBottom: '8px' }}>QUICK SELECT</div>
                            <div className="bid-presets">
                                <div className={`preset-btn ${lamports === 10000000 ? 'active' : ''}`} onClick={() => setBid(10000000)}>MIN<br /><span style={{ color: 'var(--gold)' }}>0.01</span></div>
                                <div className={`preset-btn ${lamports === 50000000 ? 'active' : ''}`} onClick={() => setBid(50000000)}>MID<br /><span style={{ color: 'var(--gold)' }}>0.05</span></div>
                                <div className={`preset-btn ${lamports === 75000000 ? 'active' : ''}`} onClick={() => setBid(75000000)}>HIGH<br /><span style={{ color: 'var(--gold)' }}>0.075</span></div>
                                <div className={`preset-btn ${lamports === 100000000 ? 'active' : ''}`} onClick={() => setBid(100000000)}>MAX<br /><span style={{ color: 'var(--gold)' }}>0.10</span></div>
                            </div>
                        </div>

                        <button className="btn btn-primary btn-glow" onClick={submitBid} disabled={isLoading} style={{ width: '100%' }}>
                            {isLoading ? '⏳ SUBMITTING...' : '🔐 SEAL & SUBMIT BID'}
                        </button>
                    </div>
                ) : (
                    <div className="bid-submitted show" id="bidSubmitted">
                        <div className="check">✅</div>
                        <div className="submitted-text">BID SEALED</div>
                        <div className="seal-note">Your bid is hidden<br />in the {mode === 'ai' ? 'simulation' : 'TEE vault'}.<br /><br />
                            {mode === 'ai' ? 'AI bots are deciding...' : 'Awaiting other players...'}
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button className="btn btn-ghost" onClick={() => setPhase('reveal')} style={{ fontSize: '7px' }}>
                                ▶ SKIP TO REVEAL
                            </button>
                        </div>
                    </div>
                )}

            </div>

            {/* OPPONENT STATUS */}
            <div className="opponents-strip">
                <div className="opp-title">{mode === 'ai' ? '🤖 BOT STATUS' : '⚔ ADVENTURER STATUS'}</div>
                <div className="opp-list">
                    {opponents.map((opp, i) => (
                        <div key={i} className={`opp-card ${opp.isEliminated ? 'eliminated' : (botStatuses[opp.name] ? 'bid-in' : '')}`}>
                            <div className="opp-avatar">{opp.isEliminated ? '💀' : opp.emoji}</div>
                            <div className="opp-name">{opp.name}</div>
                            <div className={`opp-status ${opp.isEliminated ? '' : (botStatuses[opp.name] ? 'done' : 'waiting')}`}>
                                {opp.isEliminated ? 'ELIMINATED' : (botStatuses[opp.name] ? 'BID IN ✓' : (hasBid ? 'THINKING...' : 'WAITING'))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
