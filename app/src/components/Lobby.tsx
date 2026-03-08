import { useBlitzGame } from '../hooks/useBlitzGame';
import { useBlitzActions } from '../hooks/useBlitzActions';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useGameMode } from '../App';

interface LobbyProps {
    setPhase: (phase: string) => void;
}

export function Lobby({ setPhase }: LobbyProps) {
    const { mode, aiGame } = useGameMode();
    const GAME_ID_NUM = 8352204;
    const { game, allPlayers, refetch } = useBlitzGame(mode === 'pvp' ? GAME_ID_NUM.toString() : undefined);
    const { createGame, joinGame, delegateToTee, startRound } = useBlitzActions(GAME_ID_NUM);
    const wallet = useAnchorWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');

    const showStatus = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setStatusMsg(msg);
        setStatusType(type);
        if (type !== 'error') setTimeout(() => setStatusMsg(null), 4000);
    };

    // ── AI MODE HANDLERS ──
    const handleCreateAI = () => {
        aiGame.createAIGame();
        showStatus('🤖 AI Arena created! 5 bots joined instantly.', 'success');
    };

    const handleStartAI = () => {
        aiGame.startRound();
        setPhase('bidding');
    };

    // ── PVP MODE HANDLERS ──
    const handleCreate = async () => {
        if (!wallet) { showStatus('Connect your wallet first!', 'error'); return; }
        try {
            setIsLoading(true);
            showStatus('Creating game on Devnet... confirm in wallet', 'info');
            await createGame();
            showStatus('Game created! Others can now join.', 'success');
            await refetch();
        } catch (e: any) {
            console.error(e);
            const msg = e?.message || 'Unknown error';
            if (msg.includes('insufficient')) {
                showStatus('Not enough SOL! Get devnet SOL from faucet.solana.com', 'error');
            } else if (msg.includes('User rejected')) {
                showStatus('Transaction cancelled by user.', 'error');
            } else {
                showStatus(`Error: ${msg.slice(0, 100)}`, 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!wallet) return;
        try {
            setIsLoading(true);
            showStatus('Joining game... confirm in wallet', 'info');
            await joinGame();
            showStatus('You joined the game!', 'success');
            await refetch();
        } catch (e: any) {
            console.error(e);
            showStatus(`Join failed: ${(e?.message || 'Unknown').slice(0, 80)}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelegate = async () => {
        try {
            setIsLoading(true);
            showStatus('Delegating to TEE...', 'info');
            await delegateToTee();
            const isCreator = game && wallet && game.creator.equals(wallet.publicKey);
            if (isCreator && game.currentRound === 0) {
                showStatus('🎲 Starting First Round (VRF)...', 'info');
                await startRound();
            }
            showStatus('Delegated! Entering the arena...', 'success');
            setTimeout(() => setPhase('bidding'), 600);
        } catch (e: any) {
            console.error(e);
            setPhase('bidding');
        } finally {
            setIsLoading(false);
        }
    };

    // ── RENDER ──
    if (mode === 'ai') {
        return (
            <>
                <div className="section-title">🤖 AI ARENA</div>

                {statusMsg && (
                    <div className={`status-toast ${statusType}`} onClick={() => setStatusMsg(null)}>
                        {statusType === 'success' && '✅ '}
                        {statusType === 'error' && '❌ '}
                        {statusType === 'info' && '⏳ '}
                        {statusMsg}
                    </div>
                )}

                <div className="lobby-grid">
                    <div className="game-info-panel" style={{ position: 'relative' }}>
                        <div className="corner-deco tl"></div>
                        <div className="corner-deco tr"></div>
                        <div className="corner-deco bl"></div>
                        <div className="corner-deco br"></div>
                        <div className="info-row">
                            <span className="info-label">MODE</span>
                            <span className="info-val" style={{ fontSize: '20px', fontFamily: '"Press Start 2P"', color: 'var(--purple)' }}>🤖 AI ARENA</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">ENTRY FEE</span>
                            <span className="info-val big"><span className="sol-icon">◎</span> FREE (SIM)</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">OPPONENTS</span>
                            <span className="info-val big" style={{ color: 'var(--green)' }}>5 AI BOTS</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">STATUS</span>
                            <span className="info-val" style={{ color: aiGame.gameStarted ? 'var(--green)' : 'var(--gold)', fontSize: '22px' }}>
                                {aiGame.gameStarted ? '🟢 READY TO FIGHT' : '⬤ PRESS START'}
                            </span>
                        </div>
                    </div>

                    <div className="game-info-panel" style={{ position: 'relative' }}>
                        <div className="corner-deco tl"></div>
                        <div className="corner-deco tr"></div>
                        <div className="corner-deco bl"></div>
                        <div className="corner-deco br"></div>
                        <div className="info-row">
                            <span className="info-label">ROUNDS</span>
                            <span className="info-val">5</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">PLAYERS</span>
                            <span className="info-val">{aiGame.gameStarted ? '6' : '0'} / 6</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">BID WINDOW</span>
                            <span className="info-val">10s</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">NETWORK</span>
                            <span className="info-val" style={{ color: 'var(--purple)', fontSize: '18px' }}>LOCAL SIM</span>
                        </div>
                    </div>

                    <div className="players-panel">
                        <div className="section-title">🤖 AI COMBATANTS</div>
                        <div className="player-slots">
                            {aiGame.players.length > 0 ? (
                                aiGame.players.map((p, i) => (
                                    <div key={i} className={`player-slot filled ${p.isYou ? 'you' : 'ai-slot'}`} style={{ position: 'relative' }}>
                                        {p.isYou && <><div className="corner-deco tl"></div><div className="corner-deco br"></div></>}
                                        <div className="slot-emoji">{p.emoji}</div>
                                        <div className="slot-name">{p.name}</div>
                                        <div className="slot-addr">{p.isYou ? '▶ YOU ◀' : (p.style || '')}</div>
                                        {p.isBot && p.quote && (
                                            <div className="bot-quote">{p.quote}</div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                [0, 1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="player-slot empty">
                                        <div className="slot-name empty-name">[ EMPTY SLOT ]</div>
                                        <div className="slot-addr">— awaiting bot —</div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="btn-row">
                            {!aiGame.gameStarted ? (
                                <button className="btn btn-primary btn-glow" onClick={handleCreateAI}>
                                    🤖 START AI ARENA 🤖
                                </button>
                            ) : (
                                <button className="btn btn-primary btn-glow" onClick={handleStartAI}>
                                    ⚔ ENTER THE ARENA ⚔
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="divider"></div>
                <div style={{ fontFamily: 'var(--vt)', fontSize: '20px', color: 'var(--dim)', lineHeight: 1.8, padding: '0 4px' }}>
                    ▸ Play against <span style={{ color: 'var(--purple)' }}>5 AI bots</span> with unique bidding personalities.<br />
                    ▸ No wallet or SOL required — <span style={{ color: 'var(--green)' }}>instant play</span>.<br />
                    ▸ Same Winner's Curse rules: overbid and your score <span style={{ color: 'var(--crimson)' }}>DECREASES</span>.
                </div>
            </>
        );
    }

    // ── PVP MODE (original) ──
    const gameExists = !!game;
    const inGame = wallet && allPlayers.some(p => p.player.equals(wallet.publicKey));

    return (
        <>
            <div className="section-title">⚔ GAME CHAMBER</div>

            {statusMsg && (
                <div className={`status-toast ${statusType}`} onClick={() => setStatusMsg(null)}>
                    {statusType === 'success' && '✅ '}
                    {statusType === 'error' && '❌ '}
                    {statusType === 'info' && '⏳ '}
                    {statusMsg}
                </div>
            )}

            <div className="lobby-grid">
                <div className="game-info-panel" style={{ position: 'relative' }}>
                    <div className="corner-deco tl"></div>
                    <div className="corner-deco tr"></div>
                    <div className="corner-deco bl"></div>
                    <div className="corner-deco br"></div>
                    <div className="info-row">
                        <span className="info-label">GAME ID</span>
                        <span className="info-val" style={{ fontSize: '20px', fontFamily: '"Press Start 2P"', letterSpacing: '2px' }}>#{GAME_ID_NUM.toString(16).toUpperCase()}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">ENTRY FEE</span>
                        <span className="info-val big"><span className="sol-icon">◎</span> 0.05 SOL</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">TOTAL POT</span>
                        <span className="info-val big" style={{ color: 'var(--green)' }}><span className="sol-icon">◎</span> {game ? (game.totalPot.toNumber() / 1e9).toFixed(2) : '0.00'} SOL</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">STATUS</span>
                        <span className="info-val" style={{ color: gameExists ? 'var(--green)' : 'var(--gold)', fontSize: '22px' }}>
                            {gameExists ? '🟢 WAITING FOR PLAYERS' : '⬤ NOT CREATED'}
                        </span>
                    </div>
                </div>

                <div className="game-info-panel" style={{ position: 'relative' }}>
                    <div className="corner-deco tl"></div>
                    <div className="corner-deco tr"></div>
                    <div className="corner-deco bl"></div>
                    <div className="corner-deco br"></div>
                    <div className="info-row">
                        <span className="info-label">ROUNDS</span>
                        <span className="info-val">5</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">PLAYERS</span>
                        <span className="info-val">{game ? game.playerCount : 0} / 6</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">BID WINDOW</span>
                        <span className="info-val">10s</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">NETWORK</span>
                        <span className="info-val" style={{ color: 'var(--purple)', fontSize: '18px' }}>DEVNET TEE</span>
                    </div>
                </div>

                <div className="players-panel">
                    <div className="section-title">⚔ PARTY MEMBERS</div>
                    <div className="player-slots">
                        {[0, 1, 2, 3, 4, 5].map((i) => {
                            const p = allPlayers[i];
                            if (p) {
                                const isYou = wallet && p.player.equals(wallet.publicKey);
                                return (
                                    <div key={i} className={`player-slot filled ${isYou ? 'you' : ''}`} style={{ position: 'relative' }}>
                                        {isYou && <><div className="corner-deco tl"></div><div className="corner-deco br"></div></>}
                                        <div className="slot-name">Player {i + 1}</div>
                                        <div className="slot-addr">{p.player.toBase58().substring(0, 5)}...{p.player.toBase58().slice(-4)}</div>
                                        {isYou && <div className="you-tag">▶ YOU ◀</div>}
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={i} className="player-slot empty">
                                        <div className="slot-name empty-name">[ EMPTY SLOT ]</div>
                                        <div className="slot-addr">— awaiting hero —</div>
                                    </div>
                                );
                            }
                        })}
                    </div>

                    <div className="btn-row">
                        {!gameExists && (
                            <button className="btn btn-primary btn-glow" onClick={handleCreate} disabled={!wallet || isLoading}>
                                {isLoading ? '⏳ CREATING...' : '⚔ CREATE GAME ⚔'}
                            </button>
                        )}
                        {gameExists && !inGame && (
                            <button className="btn btn-primary btn-glow" onClick={handleJoin} disabled={!wallet || isLoading}>
                                {isLoading ? '⏳ JOINING...' : '⚔ JOIN GAME ⚔'}
                            </button>
                        )}
                        {gameExists && inGame && (
                            <>
                                <button className="btn btn-ghost" onClick={handleDelegate} disabled={isLoading}>
                                    {isLoading ? '⏳ DELEGATING...' : '◉ DELEGATE TO TEE'}
                                </button>
                                <button className="btn btn-primary btn-glow" onClick={() => setPhase('bidding')}>
                                    ⚔ ENTER THE ARENA ⚔
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="divider"></div>
            <div style={{ fontFamily: 'var(--vt)', fontSize: '20px', color: 'var(--dim)', lineHeight: 1.8, padding: '0 4px' }}>
                ▸ The Winner's Curse awaits: overbid and your score <span style={{ color: 'var(--crimson)' }}>DECREASES</span>.<br />
                ▸ Bids are <span style={{ color: 'var(--purple)' }}>sealed</span> via TEE — no peeking.<br />
                ▸ After 5 rounds, last adventurer standing claims the <span style={{ color: 'var(--gold)' }}>entire pot</span>.
            </div>
        </>
    );
}
