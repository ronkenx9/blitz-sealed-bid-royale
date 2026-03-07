interface Player {
    player: string;
    score: number;
    isEliminated: boolean;
}

interface GameStageProps {
    phase: number;
    players: Player[];
    currentItemName: string;
}

export function GameStage({ phase, players, currentItemName }: GameStageProps) {

    return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-panel2 to-cyber-bg z-10">

            {/* HUD Info */}
            <div className="absolute top-6 left-6 font-mono text-xs md:text-sm text-cyber-cyan border border-cyber-cyan/30 bg-cyber-cyan/10 px-3 py-1 rounded shadow-[0_0_10px_rgba(0,240,255,0.2)] backdrop-blur-sm z-30">
                SYS.PHASE :: {phase === 0 ? 'WAITING_FOR_PLAYERS' : phase === 1 ? 'ENCRYPTED_BIDDING' : phase === 2 ? 'ORACLE_REVEAL' : 'SESSION_TERMINATED'}
            </div>

            {/* Opponent Ring (Top Area) */}
            <div className="absolute top-16 w-full flex justify-center gap-4 px-4 z-20 flex-wrap">
                {players.slice(1).map((p, idx) => (
                    <div key={idx} className={`cyber-panel-inset bg-opacity-70 backdrop-blur min-w-[140px] p-3 flex flex-col items-center gap-2 transition-all duration-500 ${p.isEliminated ? 'opacity-30 grayscale scale-95' : 'opacity-100 hover:scale-105'} hover:border-cyber-cyan/50`} style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="relative">
                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${p.player}`} alt="avatar" className="cyber-avatar shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-cyber-bg p-1" />
                            {p.isEliminated && <div className="absolute inset-0 flex items-center justify-center bg-cyber-pink/20 rounded-full backdrop-blur-[1px]"><span className="text-xl">💀</span></div>}
                        </div>
                        <div className="text-center w-full">
                            <div className="font-mono text-xs text-cyber-muted truncate">{p.player.slice(0, 4)}...{p.player.slice(-4)}</div>
                            <div className={`font-display font-bold text-sm mt-1 ${p.score < 0 ? 'text-cyber-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]' : 'text-cyber-green drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]'}`}>
                                {p.score > 0 ? '+' : ''}{p.score.toFixed(2)} SOL
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Central Stage / Hologram Pedestal */}
            <div className="flex flex-col items-center justify-center z-10 w-full mt-24">
                {/* Hologram Text */}
                <div className="font-display font-light text-xl md:text-3xl text-white mb-8 text-center tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] h-10">
                    {phase > 0 && phase < 3 ? (
                        <span className="text-cyber-cyan font-bold">{currentItemName}</span>
                    ) : (phase === 0 ? 'AWAITING CONTENDERS' : 'VICTORY')}
                </div>

                {/* Sleek Pedestal */}
                <div className="relative w-48 h-12 flex justify-center perspective-[800px]">
                    {/* Item Hologram */}
                    {phase > 0 && phase < 3 && (
                        <div className="absolute bottom-full mb-4 w-16 h-16 animate-pulse-glow z-20">
                            <div className="w-full h-full bg-gradient-to-tr from-cyber-cyan to-cyber-pink rounded-xl blur-sm opacity-80 absolute inset-0"></div>
                            <div className="w-full h-full bg-cyber-panel2 border border-cyber-cyan rounded-xl relative flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.4)]">
                                <span className="text-2xl">✨</span>
                            </div>
                        </div>
                    )}

                    {/* Reveal Notification */}
                    {phase === 2 && (
                        <div className="absolute -top-32 font-mono text-cyber-green tracking-widest text-lg animate-subtle-float bg-cyber-green/10 px-4 py-1 rounded border border-cyber-green/50 backdrop-blur-md">
                            [ DECRYPTED ]
                        </div>
                    )}

                    {/* Pedestal Base */}
                    <div className="w-full h-full bg-cyber-panel border-t-2 border-x border-cyber-border rounded-[50%] opacity-90 shadow-[0_10px_40px_rgba(0,240,255,0.15)] flex justify-center transform rotateX-[60deg]">
                        <div className="w-3/4 h-3/4 bg-cyber-cyan/20 rounded-[50%] blur-md mt-1 animate-pulse"></div>
                    </div>
                </div>
            </div>

            {/* My Player Booth (Bottom) */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 md:translate-x-0 md:left-6 z-30">
                <div className="cyber-panel-inset flex items-center gap-4 p-3 pr-6 border-l-4 border-l-cyber-cyan shadow-[0_0_20px_rgba(0,240,255,0.1)] bg-cyber-bg/80 backdrop-blur-md transition-transform hover:scale-105">
                    <div className="relative">
                        <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=MyUserWallet123`} alt="my-avatar" className="cyber-avatar shadow-[0_0_10px_rgba(0,240,255,0.5)] border-cyber-cyan bg-cyber-bg p-1" />
                    </div>
                    <div className="flex flex-col">
                        <div className="font-mono text-xs text-cyber-cyan tracking-wider mb-1">PLAYER ONE (YOU)</div>
                        <div className="font-display font-bold text-lg text-cyber-text leading-none">{players[1]?.score.toFixed(2)} SOL</div>
                    </div>
                </div>
            </div>

        </div>
    );
}
