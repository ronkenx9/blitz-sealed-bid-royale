import { useState, useEffect } from 'react';

interface LeaderboardEntry {
    global_rank: number;
    wallet_address: string;
    username: string;
    total_xp: number;
    games_played: number;
    rank_title: string;
}

export function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaderboard() {
            try {
                // Pointing to the high-performance Next.js API route we just built
                const response = await fetch('https://blitz-portal.vercel.app/api/leaderboard/global');
                const data = await response.json();
                if (data.success) {
                    setLeaderboard(data.leaderboard);
                }
            } catch (e) {
                console.error('Failed to fetch leaderboard:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchLeaderboard();
    }, []);

    const renderRankIcon = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="leaderboard-container">
            <div className="leaderboard-header">
                <div className="pixel-title" style={{ fontSize: '32px', color: 'var(--gold)' }}>BLITZ LEGENDS</div>
                <div className="pixel-subtitle" style={{ color: 'var(--blue)', letterSpacing: '4px' }}>HALL OF FAME</div>
            </div>

            <div className="leaderboard-list">
                {loading ? (
                    <div className="loading-container">
                        <div className="pulsing-text">SCANNING ARCHIVES...</div>
                    </div>
                ) : (
                    leaderboard.map((entry) => (
                        <div
                            key={entry.wallet_address}
                            className={`leaderboard-entry ${entry.global_rank <= 3 ? 'top-rank' : ''}`}
                        >
                            <div className="rank-badge">
                                {renderRankIcon(entry.global_rank)}
                            </div>

                            <div className="player-info">
                                <div className="player-name">
                                    {entry.username || `${entry.wallet_address.slice(0, 4)}...${entry.wallet_address.slice(-4)}`}
                                </div>
                                <div className="rank-title">⭐ {entry.rank_title}</div>
                            </div>

                            <div className="score-info">
                                <div className="xp-val">{entry.total_xp.toLocaleString()}</div>
                                <div className="xp-label">XP</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="leaderboard-footer">
                <div className="pixel-note">TOTAL GLORY: {leaderboard.length} WARRIORS FOUND</div>
            </div>
        </div>
    );
}
