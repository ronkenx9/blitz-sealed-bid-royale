import { useState, useEffect } from 'react';

interface OnboardingProps {
    onClose: () => void;
}

export function Onboarding({ onClose }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleNext = () => setStep(s => s + 1);
    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 400);
    };

    if (step > 3) {
        handleClose();
        return null;
    }

    return (
        <div className={`onboarding-overlay ${isVisible ? 'active' : ''}`}>
            <div className={`onboarding-card pbox glass shadow-gold slide-${step}`}>
                {step === 1 && (
                    <div className="ob-slide">
                        <div className="ob-eyebrow">SYSTEM INITIALIZED</div>
                        <h1 className="ob-title headline-glitch" data-text="WELCOME TO BLITZ">WELCOME TO BLITZ</h1>
                        <p className="ob-text">
                            A high-stakes, sealed-bid auction royale where only the cold-blooded survive.
                            You are entering the <span className="text-gold">Chamber of Valor</span>.
                        </p>
                        <div className="ob-visual">
                            <div className="ob-orb"></div>
                        </div>
                        <button className="btn btn-primary btn-glow full-width" onClick={handleNext}>
                            ENTER THE CHAMBER →
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="ob-slide">
                        <div className="ob-eyebrow">THE PROTOCOL</div>
                        <h1 className="ob-title">HOW TO PLAY</h1>
                        <div className="ob-rules">
                            <div className="rule-item">
                                <span className="rule-icon">🤫</span>
                                <div className="rule-content">
                                    <strong>SEALED BIDS</strong>
                                    <p>Your bids are encrypted in a <span className="text-purple">TEE</span>. No one, not even the server, can see them until revelation.</p>
                                </div>
                            </div>
                            <div className="rule-item">
                                <span className="rule-icon">⚖️</span>
                                <div className="rule-content">
                                    <strong>MARKET TRUTH</strong>
                                    <p>Bid as close to the <span className="text-green">Market Value</span> as possible. Overbid, and you lose points. Underbid, and you get outbid.</p>
                                </div>
                            </div>
                            <div className="rule-item">
                                <span className="rule-icon">💀</span>
                                <div className="rule-content">
                                    <strong>EXTINCTION</strong>
                                    <p>Run out of score, and you are eliminated. The last survivor claims the entire pot.</p>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-primary btn-glow full-width" onClick={handleNext}>
                            UNDERSTOOD →
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="ob-slide">
                        <div className="ob-eyebrow">READY FOR BATTLE</div>
                        <h1 className="ob-title">CLAIM YOUR FATE</h1>
                        <p className="ob-text">
                            PvP mode runs on <span className="text-blue">MagicBlock Ephemeral Rollups</span> for sub-second speed.
                            AI mode is available for instant practice.
                        </p>
                        <div className="ob-visual-last">
                            <div className="ob-grid-effect"></div>
                            <span className="ob-ready-text">ARE YOU READY?</span>
                        </div>
                        <button className="btn btn-primary btn-glow full-width" onClick={handleClose}>
                            BEGIN MISSION →
                        </button>
                    </div>
                )}

                <div className="ob-footer">
                    <div className="ob-dots">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`ob-dot ${step === i ? 'active' : ''}`} />
                        ))}
                    </div>
                    <button className="ob-skip" onClick={handleClose}>SKIP PROTOCOL</button>
                </div>
            </div>
        </div>
    );
}
