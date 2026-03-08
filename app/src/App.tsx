import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { MAINNET_URL } from './utils/constants';

import '@solana/wallet-adapter-react-ui/styles.css';

import { Lobby } from './components/Lobby';
import { BiddingRound } from './components/BiddingRound';
import { RevealPhase } from './components/RevealPhase';
import { GameOver } from './components/GameOver';
import { Onboarding } from './components/Onboarding';
import { useAIGame } from './hooks/useAIGame';

const PHASE_ORDER = ['lobby', 'bidding', 'reveal', 'gameover'] as const;
type Phase = typeof PHASE_ORDER[number];

// ── GAME MODE CONTEXT ──
type GameMode = 'pvp' | 'ai';
type GameModeCtx = {
  mode: GameMode;
  setMode: (m: GameMode) => void;
  aiGame: ReturnType<typeof useAIGame>;
  gameId: number;
  setGameId: (id: number) => void;
};
export const GameModeContext = createContext<GameModeCtx>(null as any);
export const useGameMode = () => useContext(GameModeContext);

// Simple ping sound using Web Audio API
function playPing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { }
}

function Embers() {
  const [embers, setEmbers] = useState<any[]>([]);
  useEffect(() => {
    const newEmbers = [];
    for (let i = 0; i < 30; i++) {
      const size = Math.random() * 3 + 1;
      newEmbers.push({
        id: i,
        left: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${6 + Math.random() * 10}s`,
        animationDelay: `${Math.random() * 8}s`,
        drift: (Math.random() - 0.5) * 2,
        bg: Math.random() > 0.5 ? '#e8b84b' : '#9945ff',
        shadow: `0 0 ${size * 2}px ${Math.random() > 0.5 ? '#e8b84b' : '#9945ff'}`
      });
    }
    setEmbers(newEmbers);
  }, []);

  return (
    <div className="embers" id="embers">
      {embers.map(e => (
        <div key={e.id} className="ember" style={{
          left: e.left,
          width: e.width,
          height: e.height,
          animationDuration: e.animationDuration,
          animationDelay: e.animationDelay,
          '--drift': e.drift,
          background: e.bg,
          boxShadow: e.shadow
        } as any} />
      ))}
    </div>
  )
}

function GameApp() {
  const { connected } = useWallet();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [highestPhase, setHighestPhase] = useState<number>(0);
  const [mode, setMode] = useState<GameMode>('ai'); // Default to AI for instant play
  const [gameId, setGameId] = useState<number>(Date.now() % 1_000_000_000);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const aiGame = useAIGame();

  useEffect(() => {
    const hasSeen = localStorage.getItem('blitz_onboarding_seen');
    if (!hasSeen) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('blitz_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const handleSetPhase = useCallback((newPhase: string) => {
    const idx = PHASE_ORDER.indexOf(newPhase as Phase);
    if (idx === -1) return;

    setPhase(newPhase as Phase);

    // Update highestPhase, but if we move back to bidding, 
    // we lock subsequent phases until reveal is triggered.
    setHighestPhase(prev => {
      if (newPhase === 'bidding') return 1;
      if (idx > prev) {
        playPing();
        return idx;
      }
      return prev;
    });
  }, []);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setPhase('lobby');
      setHighestPhase(0);
    }
  }, [connected]);

  const phaseLabels = [
    { key: 'lobby', step: 'PHASE I', icon: '⚔', label: 'LOBBY' },
    { key: 'bidding', step: 'PHASE II', icon: '🔮', label: 'BIDDING' },
    { key: 'reveal', step: 'PHASE III', icon: '👁', label: 'REVEAL' },
    { key: 'gameover', step: 'PHASE IV', icon: '👑', label: 'GAME OVER' },
  ];

  return (
    <GameModeContext.Provider value={{ mode, setMode, aiGame, gameId, setGameId }}>
      <Embers />
      <div className="app">

        {/* HEADER */}
        <header>
          <div className="logo">⚔ BLITZ ⚔</div>
          <div className="tagline">SEALED-BID BATTLE ROYALE</div>
          <div>
            <div className="chain-badge">
              <div className="sol-dot"></div>
              POWERED BY SOLANA + MAGICBLOCK TEE
            </div>
          </div>

          {/* MODE TOGGLE + WALLET */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px', alignItems: 'center' }}>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
                onClick={() => { setMode('ai'); setPhase('lobby'); setHighestPhase(0); }}
              >
                🤖 AI ARENA
              </button>
              <button
                className={`mode-btn ${mode === 'pvp' ? 'active' : ''}`}
                onClick={() => { setMode('pvp'); setPhase('lobby'); setHighestPhase(0); }}
              >
                ⚔ PVP MODE
              </button>
            </div>
            <WalletMultiButton style={{ fontFamily: 'var(--pixel)', fontSize: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 20px', height: 'auto', lineHeight: '1' }} />
          </div>
        </header>

        {/* NAV TABS */}
        <nav className="nav-tabs">
          {phaseLabels.map((tab, idx) => {
            const isLocked = idx > highestPhase;
            const isActive = phase === tab.key;
            return (
              <button
                key={tab.key}
                className={`tab-btn ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={() => !isLocked && setPhase(tab.key as Phase)}
                disabled={isLocked}
                title={isLocked ? 'Complete previous phase to unlock' : ''}
              >
                <span className="tab-step">{tab.step}</span>
                {isLocked ? '🔒' : tab.icon} {tab.label}
              </button>
            );
          })}
        </nav>

        {/* SCREENS */}
        <div className={`screen ${phase === 'lobby' ? 'active' : ''}`}>
          <Lobby setPhase={handleSetPhase} />
        </div>

        <div className={`screen ${phase === 'bidding' ? 'active' : ''}`}>
          <BiddingRound
            key={`bidding-${mode === 'ai' ? aiGame.currentRound : pvpGame.game?.currentRound || 0}`}
            setPhase={handleSetPhase}
            isActive={phase === 'bidding'}
          />
        </div>

        <div className={`screen ${phase === 'reveal' ? 'active' : ''}`}>
          <RevealPhase
            key={`reveal-${mode === 'ai' ? aiGame.currentRound : pvpGame.game?.currentRound || 0}`}
            setPhase={handleSetPhase}
          />
        </div>

        <div className={`screen ${phase === 'gameover' ? 'active' : ''}`}>
          <GameOver
            key={`gameover-${mode === 'ai' ? aiGame.currentRound : pvpGame.game?.currentRound || 0}`}
            setPhase={handleSetPhase}
          />
        </div>

      </div>
      {showOnboarding && <Onboarding onClose={handleCloseOnboarding} />}
    </GameModeContext.Provider>
  );
}

function App() {
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={MAINNET_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <GameApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
