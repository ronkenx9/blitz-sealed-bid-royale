import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { useGameMode } from '../App';
import idl from '../target/idl/blitz.json';
import type { Blitz } from '../target/types/blitz';
import { getGamePda } from '../utils/anchor';
import { TEE_URL } from '../utils/constants';

interface LobbyProps {
    setPhase: (phase: string) => void;
}

export function Lobby({ setPhase }: LobbyProps) {
    const { mode, aiGame, gameId: GAME_ID_NUM, setGameId } = useGameMode();
    const { game, allPlayers, refetch } = useBlitzGame(mode === 'pvp' ? GAME_ID_NUM.toString() : undefined);
    const {
        createGame, joinGame, delegateGame, delegatePlayerState,
        getAuthTokenCached, startRound
    } = useBlitzActions(GAME_ID_NUM);
    const wallet = useAnchorWallet();
    const { signMessage } = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');

    const showStatus = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setStatusMsg(msg);
        setStatusType(type);
        if (type !== 'error') setTimeout(() => setStatusMsg(null), 4000);
    };

    useEffect(() => {
        if (mode === 'pvp' && wallet && !signMessage) {
            showStatus(
                'Warning: your wallet may not support TEE signing. Use Phantom or Solflare for PvP.',
                'error'
            );
        }
    }, [wallet, signMessage, mode]);

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

    const handleDelegateGame = async () => {
        // Only the creator can call this.
        try {
            setIsLoading(true);
            showStatus('Delegating Game PDA to TEE...', 'info');
            await delegateGame();
            showStatus('Game delegated! Starting first round...', 'info');

            showStatus('Requesting random item from VRF oracle...', 'info');
            await startRound();

            // Poll the TEE until roundActive flips to true.
            showStatus('Waiting for VRF callback...', 'info');
            const token = await getAuthTokenCached();
            const teeConn = new Connection(
                `${TEE_URL}?token=${token}`,
                { commitment: 'confirmed' }
            );
            const teeProgram = new Program(idl as Blitz,
                new anchor.AnchorProvider(teeConn, wallet!, { commitment: 'confirmed' })
            );
            const [gamePda] = getGamePda(GAME_ID_NUM);

            let attempts = 0;
            const MAX_ATTEMPTS = 25; // 25 x 300ms = 7.5 seconds max wait
            while (attempts < MAX_ATTEMPTS) {
                await new Promise(r => setTimeout(r, 300));
                try {
                    const gameAcc = await (teeProgram.account as any).game.fetch(gamePda);
                    if (gameAcc.roundActive) {
                        console.log(`VRF callback received after ${attempts * 300}ms`);
                        break;
                    }
                } catch {
                    // account may not be readable yet — keep waiting
                }
                attempts++;
            }

            if (attempts >= MAX_ATTEMPTS) {
                showStatus('VRF oracle timed out. Try delegating again.', 'error');
                setIsLoading(false);
                return;
            }

            showStatus('Round 1 ready! Entering arena...', 'success');
            setTimeout(() => setPhase('bidding'), 400);
        } catch (e: any) {
            console.error(e);
            showStatus(`Error: ${e?.message?.slice(0, 100)}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelegatePlayerState = async () => {
        // Every player (including creator) calls this for themselves.
        try {
            setIsLoading(true);
            showStatus('Setting up your sealed bid vault...', 'info');
            await delegatePlayerState();
            showStatus('Ready! Waiting for creator to start...', 'success');
        } catch (e: any) {
            console.error(e);
            showStatus(`Error: ${e?.message?.slice(0, 100)}`, 'error');
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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type='number'
                                value={GAME_ID_NUM}
                                onChange={e => setGameId(Number(e.target.value))}
                                style={{
                                    fontFamily: 'var(--pixel)', fontSize: '10px',
                                    background: 'var(--panel)', color: 'var(--gold)',
                                    border: '1px solid var(--border)', padding: '6px 8px', width: '140px',
                                }}
                            />
                            <button className='btn btn-ghost' style={{ fontSize: '7px', padding: '6px 10px' }}
                                onClick={() => setGameId(Date.now() % 1_000_000_000)}>
                                🎲
                            </button>
                        </div>
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
                            <div className='btn-row'>
                                {/* Every player sets up their own state first */}
                                <button className='btn btn-ghost' onClick={handleDelegatePlayerState}
                                    disabled={isLoading}>
                                    {isLoading ? '...' : '◉ SETUP SEALED BIDS'}
                                </button>
                                {/* Only creator sees this button */}
                                {game && wallet && game.creator.equals(wallet.publicKey) && (
                                    <button className='btn btn-primary' onClick={handleDelegateGame}
                                        disabled={isLoading}>
                                        {isLoading ? '...' : '⚔ DELEGATE & START ROUND 1'}
                                    </button>
                                )}
                                <button className="btn btn-primary btn-glow" onClick={() => setPhase('bidding')} style={{ display: 'none' }}>
                                    ⚔ ENTER THE ARENA ⚔
                                </button>
                            </div>
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
