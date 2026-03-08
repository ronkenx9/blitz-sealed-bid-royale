import { useState } from 'react';
import { useBlitzActions } from '../hooks/useBlitzActions';
import { useBlitzGame } from '../hooks/useBlitzGame';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { useGameMode } from '../App';

interface GameOverProps {
    setPhase: (phase: string) => void;
}

export function GameOver({ setPhase }: GameOverProps) {
    const { mode, aiGame, gameId: GAME_ID_NUM } = useGameMode();
    const pvpGame = useBlitzGame(mode === 'pvp' ? GAME_ID_NUM.toString() : undefined);
    const { settleGame } = useBlitzActions(GAME_ID_NUM);
    const wallet = useAnchorWallet();
    const [isSettling, setIsSettling] = useState(false);
    const [hasSettled, setHasSettled] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    // ── AI MODE ──
    if (mode === 'ai') {
        const { players, currentRound, winner } = aiGame;

        const rankings = [...players].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            return b.score - a.score;
        });

        const eliminatedCount = players.filter(p => p.isEliminated).length;
        const highestScore = Math.max(...players.map(p => Math.abs(p.score)), 1);

        const handlePlayAgain = () => {
            setHasSettled(false);
            setPhase('lobby');
        };

        return (
            <>
                <div className="game-over-wrap">
                    <span className="trophy">👑</span>
                    <div className="go-title">
                        {winner?.isYou ? '✨ YOU ARE THE CHAMPION ✨' : (winner ? 'VICTORY ACHIEVED' : 'DEFEAT...')}
                    </div>
                    <div className="go-winner-name">
                        {winner ? `${winner.emoji} ${winner.name}` : (rankings.length > 0 ? `${rankings[0].emoji} ${rankings[0].name}` : 'UNKNOWN')}
                    </div>
                    <div className="go-pot">
                        {winner?.isYou
                            ? '🏆 You outplayed 5 AI opponents!'
                            : `${winner?.name || (rankings.length > 0 ? rankings[0].name : 'An AI')} claimed victory`
                        }
                    </div>
                </div>

                <div className="go-stats">
                    <div className="stat-box">
                        <div className="stat-val">{currentRound}</div>
                        <div className="stat-label">ROUNDS PLAYED</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-val" style={{ color: 'var(--green)' }}>
                            {winner ? `${winner.score > 0 ? '+' : ''}${winner.score.toLocaleString()}` : '—'}
                        </div>
                        <div className="stat-label">WINNER SCORE</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-val">{eliminatedCount}</div>
                        <div className="stat-label">ELIMINATED</div>
                    </div>
                </div>

                <div className="section-title">⚔ FINAL STANDINGS</div>
                <div className="final-scores">
                    {rankings.map((p, idx) => {
                        const scoreVal = p.score;
                        const scoreStr = `${scoreVal > 0 ? '+' : ''}${scoreVal.toLocaleString()}`;
                        let widthPct = Math.max(5, (Math.abs(p.score) / highestScore) * 100);
                        if (p.isEliminated) widthPct = 0;

                        return (
                            <div key={p.name} className={`score-row ${idx === 0 && !p.isEliminated ? 'first-place' : ''} ${p.isEliminated ? 'eliminated-row' : ''}`} style={{ position: 'relative' }}>
                                <div className={`score-rank ${idx === 0 && !p.isEliminated ? 'gold' : ''}`} style={p.isEliminated ? { color: 'var(--crimson)' } : {}}>
                                    {p.isEliminated ? '✝' : (idx === 0 ? '👑' : idx + 1)}
                                </div>
                                <div className="score-avatar">{p.isEliminated ? '💀' : p.emoji}</div>
                                <div className="score-name">{p.name} {p.isYou && '(YOU)'}</div>
                                <div className="score-val pos">{scoreStr}</div>
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

                <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
                    <button className="btn btn-primary btn-glow" onClick={handlePlayAgain} style={{ marginTop: '8px' }}>
                        🤖 PLAY AGAIN ⚔
                    </button>
                </div>
            </>
        );
    }

    // ── PVP MODE ──
    const { game, allPlayers, refetch } = pvpGame;

    const handleSettle = async () => {
        if (!wallet) return;
        try {
            setIsSettling(true);
            setStatusMsg('⏳ Settling pot on Mainnet...');
            await settleGame();
            setStatusMsg('✅ Game Settled!');
            setHasSettled(true);
            await refetch();
        } catch (e: any) {
            console.error(e);
            setStatusMsg(`❌ Error: ${e.message?.slice(0, 100)}`);
            setHasSettled(true);
        } finally {
            setIsSettling(false);
        }
    };

    if (!game) {
        return <div className="section-title">Awaiting Final Results...</div>;
    }

    const winnerKey = game.winner;
    const isWinner = wallet && winnerKey && winnerKey.equals(wallet.publicKey);
    const rankings = [...allPlayers].sort((a, b) => {
        if (a.isEliminated && !b.isEliminated) return 1;
        if (!a.isEliminated && b.isEliminated) return -1;
        return b.score.toNumber() - a.score.toNumber();
    });
    const winnerScore = rankings.length > 0 && !rankings[0].isEliminated ? rankings[0].score.toNumber() / 1e9 : 0;
    const eliminatedCount = rankings.filter(p => p.isEliminated).length;
    const highestScore = Math.max(...allPlayers.map(p => Math.abs(p.score.toNumber())), 1);
    const totalPotSol = game.totalPot.toNumber() / 1e9;

    return (
        <>
            <div className="game-over-wrap">
                <span className="trophy">👑</span>
                <div className="go-title">{isWinner ? '✨ YOU ARE THE CHAMPION ✨' : 'VICTORY ACHIEVED'}</div>
                <div className="go-winner-name">
                    {winnerKey ? `${winnerKey.toBase58().slice(0, 6)}...${winnerKey.toBase58().slice(-4)}` : (rankings.length > 0 ? `${rankings[0].player.toBase58().slice(0, 6)}...` : 'UNKNOWN')}
                </div>
                <div className="go-pot">◎ {totalPotSol.toFixed(3)} SOL CLAIMED FROM THE VAULT</div>
            </div>

            {statusMsg && (
                <div className={`status-toast ${statusMsg.includes('❌') ? 'error' : (statusMsg.includes('✅') ? 'success' : 'info')}`} onClick={() => setStatusMsg(null)}>{statusMsg}</div>
            )}

            <div className="go-stats">
                <div className="stat-box">
                    <div className="stat-val">{game.currentRound}</div>
                    <div className="stat-label">ROUNDS PLAYED</div>
                </div>
                <div className="stat-box">
                    <div className="stat-val" style={{ color: 'var(--green)' }}>{winnerScore >= 0 ? '+' : ''}{winnerScore.toFixed(3)}</div>
                    <div className="stat-label">WINNER SCORE</div>
                </div>
                <div className="stat-box">
                    <div className="stat-val">{eliminatedCount}</div>
                    <div className="stat-label">ELIMINATED</div>
                </div>
            </div>

            <div className="section-title">⚔ FINAL STANDINGS</div>
            <div className="final-scores">
                {rankings.map((p, idx) => {
                    const isYou = wallet && p.player.equals(wallet.publicKey);
                    const addrStr = p.player.toBase58();
                    const shortAddr = `${addrStr.substring(0, 4)}...${addrStr.slice(-4)}`;
                    const scoreVal = p.score.toNumber() / 1e9;
                    const scoreStr = `${scoreVal > 0 ? '+' : ''}${scoreVal.toFixed(3)}`;
                    let widthPct = Math.max(5, (Math.abs(p.score.toNumber()) / highestScore) * 100);
                    if (p.isEliminated) widthPct = 0;

                    return (
                        <div key={addrStr} className={`score-row ${idx === 0 && !p.isEliminated ? 'first-place' : ''} ${p.isEliminated ? 'eliminated-row' : ''}`} style={{ position: 'relative' }}>
                            <div className={`score-rank ${idx === 0 && !p.isEliminated ? 'gold' : ''}`} style={p.isEliminated ? { color: 'var(--crimson)' } : {}}>
                                {p.isEliminated ? '✝' : (idx === 0 ? '👑' : idx + 1)}
                            </div>
                            <div className="score-avatar">{p.isEliminated ? '💀' : (idx === 0 ? '⚔️' : '🗡️')}</div>
                            <div className="score-name">{shortAddr} {isYou && '(YOU)'}</div>
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

            <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
                {!hasSettled ? (
                    <button className="btn btn-primary btn-glow" onClick={handleSettle} disabled={isSettling || !wallet} style={{ marginTop: '8px', background: 'var(--gold)', color: '#000' }}>
                        {isSettling ? '⏳ SETTLING...' : '💰 SETTLE POT TO MAINNET 💰'}
                    </button>
                ) : (
                    <button className="btn btn-primary btn-glow" onClick={() => setPhase('lobby')} style={{ marginTop: '8px' }}>
                        ⚔ PLAY AGAIN ⚔
                    </button>
                )}
            </div>
        </>
    );
}
