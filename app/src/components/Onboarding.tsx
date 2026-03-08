import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface OnboardingProps {
    onClose: () => void;
}

export function Onboarding({ onClose }: OnboardingProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 300);
        return () => clearTimeout(timer);
    }, [currentSlide]);

    const slides = [
        {
            id: 'welcome',
            title: 'BLITZ',
            subtitle: 'SEALED-BID BATTLE ROYALE',
            content: (
                <div className="ob-arcade-content">
                    {/* Arcade-style title */}
                    <div className="ob-arcade-header">
                        <div className="ob-arcade-logo-wrap">
                            <span className="ob-emoji">⚔️</span>
                            <h1 className="ob-arcade-logo headline-glitch" data-text="BLITZ">BLITZ</h1>
                            <span className="ob-emoji">⚔️</span>
                        </div>
                        <div className="ob-arcade-tagline">SEALED-BID BATTLE ROYALE</div>
                        <div className="ob-arcade-badge">
                            ⚡ POWERED BY SOLANA + MAGICBLOCK TEE
                        </div>
                    </div>

                    {/* Stats grid */}
                    <div className="ob-stats-grid">
                        <div className="ob-stat-pbox pbox-cyan">
                            <div className="ob-stat-val">06</div>
                            <div className="ob-stat-label">PLAYERS</div>
                        </div>
                        <div className="ob-stat-pbox pbox-purple">
                            <div className="ob-stat-val">10</div>
                            <div className="ob-stat-label">SECONDS</div>
                        </div>
                        <div className="ob-stat-pbox pbox-cyan">
                            <div className="ob-stat-val">01</div>
                            <div className="ob-stat-label">WINNER</div>
                        </div>
                    </div>

                    {/* Description panel */}
                    <div className="ob-desc-panel pbox-dim">
                        <div className="ob-scanlines"></div>
                        <p className="ob-main-text">
                            Enter the <span className="text-gold">high-stakes arena</span> where AI bots and human players compete in sealed-bid elimination rounds.
                        </p>
                        <p className="ob-sub-text">
                            Your bids are encrypted. Your strategy is invisible. Only the strongest survives.
                        </p>
                    </div>

                    {/* Flashing start indicator */}
                    <div className="ob-start-indicator">
                        <div className="ob-pulse-dot"></div>
                        <span className="ob-pulse-text">► PRESS START TO CONTINUE</span>
                        <div className="ob-pulse-dot"></div>
                    </div>
                </div>
            )
        },
        {
            id: 'rules',
            title: 'GAME RULES',
            subtitle: 'HOW TO PLAY',
            content: (
                <div className="ob-arcade-content">
                    <div className="ob-rules-list">
                        <div className="ob-rule-card card-purple">
                            <div className="ob-rule-num">01</div>
                            <div className="ob-rule-body">
                                <div className="ob-rule-title text-blue">SEALED BIDS</div>
                                <p>Your bids are <span className="text-gold">encrypted in TEE</span>. Zero visibility until reveal. Pure strategy.</p>
                            </div>
                        </div>
                        <div className="ob-rule-card card-cyan">
                            <div className="ob-rule-num">02</div>
                            <div className="ob-rule-body">
                                <div className="ob-rule-title text-purple">BID WINDOW</div>
                                <p>Each item appears for <span className="text-gold">10 seconds</span>. Submit your bid before time runs out.</p>
                            </div>
                        </div>
                        <div className="ob-rule-card card-purple">
                            <div className="ob-rule-num">03</div>
                            <div className="ob-rule-body">
                                <div className="ob-rule-title text-blue">VALUATION</div>
                                <p>Bid close to the <span className="text-green">Market Value</span>. Overbid, and you lose points.</p>
                            </div>
                        </div>
                        <div className="ob-rule-card card-cyan">
                            <div className="ob-rule-num">04</div>
                            <div className="ob-rule-body">
                                <div className="ob-rule-title text-purple">ELIMINATION</div>
                                <p>Lowest bidders are <span className="text-red">ELIMINATED</span>. Final survivor takes the pot.</p>
                            </div>
                        </div>
                    </div>

                    <div className="ob-warning-banner">
                        <div className="ob-warning-hazards"></div>
                        <p>⚠️ ELIMINATION IS PERMANENT — NO RESPAWNS</p>
                    </div>
                </div>
            )
        },
        {
            id: 'stakes',
            title: 'HOW TO WIN',
            subtitle: 'VICTORY CONDITIONS',
            content: (
                <div className="ob-arcade-content">
                    <div className="ob-prize-card pbox-gold">
                        <div className="ob-prize-inner">
                            <div className="ob-prize-eyebrow">TOTAL PRIZE POOL</div>
                            <div className="ob-prize-val">100<span>%</span></div>
                            <div className="ob-prize-sub">OF ENTRY FEES → WINNER TAKES ALL</div>
                            <div className="ob-prize-example">(Example: 6 players × 0.1 SOL = 0.6 SOL total pot)</div>
                        </div>
                    </div>

                    <div className="ob-win-conditions">
                        <div className="ob-win-item">
                            <span className="ob-arrow">►</span>
                            <div className="ob-win-body">
                                <strong>SURVIVE ALL ROUNDS</strong>
                                <p>Win items across 5 rounds. Stay alive until the final revelation.</p>
                            </div>
                        </div>
                        <div className="ob-win-item">
                            <span className="ob-arrow">►</span>
                            <div className="ob-win-body">
                                <strong>MANAGE YOUR STACK</strong>
                                <p>Bid strategically—overspend early and you'll have nothing for final rounds.</p>
                            </div>
                        </div>
                        <div className="ob-win-item">
                            <span className="ob-arrow">►</span>
                            <div className="ob-win-body">
                                <strong>OUTLAST EVERYONE</strong>
                                <p>Last player standing wins entire pot settled to <span className="text-purple">Solana Mainnet</span>.</p>
                            </div>
                        </div>
                    </div>

                    <div className="ob-tech-footer">
                        <div className="ob-tech-box box-cyan">
                            <div className="ob-tech-label">EXECUTION</div>
                            <div className="ob-tech-val">Ephemeral Rollup</div>
                        </div>
                        <div className="ob-tech-box box-purple">
                            <div className="ob-tech-label">SETTLEMENT</div>
                            <div className="ob-tech-val">Solana Mainnet</div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        setTimeout(onClose, 400);
    };

    const slide = slides[currentSlide];

    return (
        <div className={`ob-arcade-overlay ${isVisible ? 'active' : ''}`}>
            {/* CRT scanlines effect */}
            <div className="ob-arcade-scanlines" />

            {/* Starfield background */}
            <div className="ob-arcade-stars">
                {[...Array(30)].map((_, i) => (
                    <div key={i} className="ob-star" style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 5}s`
                    }} />
                ))}
            </div>

            <div className="ob-arcade-container">
                <div className="ob-arcade-modal pbox-cyan glass-dark">
                    {/* Header */}
                    <div className="ob-arcade-modal-header">
                        <div className="ob-header-text">
                            <h2 className="ob-header-title">{slide.title}</h2>
                            <div className="ob-header-subtitle">{slide.subtitle}</div>
                        </div>
                        <button className="ob-close-btn" onClick={handleComplete}>
                            <X size={20} />
                        </button>

                        <div className="ob-progress-track">
                            {slides.map((_, i) => (
                                <div key={i} className={`ob-progress-dot ${i <= currentSlide ? 'active' : ''}`} />
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className={`ob-arcade-modal-body ${isAnimating ? 'animating' : ''}`}>
                        {slide.content}
                    </div>

                    {/* Footer */}
                    <div className="ob-arcade-modal-footer">
                        <button
                            className={`ob-nav-btn prev ${currentSlide === 0 ? 'disabled' : ''}`}
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                        >
                            <ChevronLeft size={24} /> <span>BACK</span>
                        </button>

                        <div className="ob-step-indicator">
                            <span className="text-gold">{String(currentSlide + 1).padStart(2, '0')}</span>
                            <span className="text-dim">/</span>
                            <span>{String(slides.length).padStart(2, '0')}</span>
                        </div>

                        {currentSlide === slides.length - 1 ? (
                            <button className="btn btn-primary btn-glow ob-final-btn" onClick={handleComplete}>
                                ⚡ ENTER ARENA
                            </button>
                        ) : (
                            <button className="ob-nav-btn next" onClick={nextSlide}>
                                <span>NEXT</span> <ChevronRight size={24} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
