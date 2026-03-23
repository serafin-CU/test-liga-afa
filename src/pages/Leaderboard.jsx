import React, { useState } from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, TrendingUp, Loader2, Crown } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    sand: '#C7B273',
};

function RankBadge({ rank }) {
    if (rank === 1) return <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: CU.orange, color: 'white' }}>1</div>;
    if (rank === 2) return <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: CU.sand, color: 'white' }}>2</div>;
    if (rank === 3) return <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: CU.magenta, color: 'white' }}>3</div>;
    return <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: '#f3f4f6', color: '#6b7280' }}>{rank}</div>;
}

function LeaderboardTable({ entries, currentUserId, mode }) {
    if (entries.length === 0) {
        return (
            <div className="text-center py-12" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                Todavía no hay puntajes registrados.
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {entries.map((entry, i) => {
                const rank = i + 1;
                const isMe = entry.user_id === currentUserId;
                return (
                    <div key={entry.user_id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
                        style={{
                            background: isMe ? CU.orange + '18' : rank <= 3 ? '#f9fafb' : 'white',
                            border: isMe ? `1px solid ${CU.orange}50` : '1px solid transparent',
                        }}>
                        <RankBadge rank={rank} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: CU.charcoal }}>
                                {rank === 1 && <span className="mr-1">🏆</span>}
                                {entry.display_name || entry.email || `Usuario ${rank}`}
                                {isMe && (
                                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                                        style={{ background: CU.orange + '30', color: CU.charcoal, fontWeight: 700 }}>vos</span>
                                )}
                            </div>
                        </div>
                        {mode === 'ALL' && (
                            <div className="flex gap-3 text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                <span title="Prode">P: {entry.prode_points}</span>
                                <span title="Fantasy">F: {entry.fantasy_points}</span>
                            </div>
                        )}
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', color: CU.charcoal }}>
                            {entry.total_points}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const TAB_CONFIG = [
    { value: 'ALL', label: 'General', icon: TrendingUp },
    { value: 'PRODE', label: 'Prode', icon: Medal },
    { value: 'FANTASY', label: 'Fantasy', icon: Crown },
];

export default function Leaderboard() {
    const [tab, setTab] = useState('ALL');

    const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

    const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
        queryKey: ['leaderboardLedger'],
        queryFn: () => base44.entities.PointsLedger.list()
    });

    // Load all users to show everyone, including those with 0 points
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['allUsers'],
        queryFn: async () => {
            try { return await base44.entities.User.list(); } catch { return []; }
        }
    });

    // Build aggregated map seeded with all users at 0 points
    const aggregated = {};
    for (const u of users) {
        aggregated[u.id] = {
            user_id: u.id,
            display_name: u.display_name || u.full_name || null,
            email: u.email || null,
            prode_points: 0,
            fantasy_points: 0,
            total_points: 0,
        };
    }
    for (const entry of ledger) {
        if (!entry.user_id) continue;
        if (!aggregated[entry.user_id]) {
            aggregated[entry.user_id] = { user_id: entry.user_id, display_name: null, email: null, prode_points: 0, fantasy_points: 0, total_points: 0 };
        }
        const pts = entry.points || 0;
        if (entry.mode === 'PRODE') aggregated[entry.user_id].prode_points += pts;
        else if (entry.mode === 'FANTASY') aggregated[entry.user_id].fantasy_points += pts;
        aggregated[entry.user_id].total_points += pts;
    }

    const allEntries = Object.values(aggregated);

    const getEntries = (mode) => {
        if (mode === 'ALL') return [...allEntries].sort((a, b) => b.total_points - a.total_points);
        if (mode === 'PRODE') return [...allEntries].map(e => ({ ...e, total_points: e.prode_points })).sort((a, b) => b.total_points - a.total_points);
        return [...allEntries].map(e => ({ ...e, total_points: e.fantasy_points })).sort((a, b) => b.total_points - a.total_points);
    };

    const entries = getEntries(tab);
    const myRank = entries.findIndex(e => e.user_id === currentUser?.id) + 1;

    if (ledgerLoading || usersLoading) {
        return (
            <div className="max-w-2xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando standings...
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
            <WorldCupBanner compact />
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.orange }}>
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, margin: 0 }}>⚽ Tabla</h1>
                        <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                            Liga AFA — Apertura 2026
                        </p>
                    </div>
                </div>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280' }}>
                    {entries.length} participante{entries.length !== 1 ? 's' : ''}
                    {myRank > 0 && <> · Estás en el puesto <span style={{ fontWeight: 700, color: CU.charcoal }}>#{myRank}</span></>}
                </p>
            </div>

            {myRank > 0 && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: CU.orange + '15', border: `1px solid ${CU.orange}40` }}>
                    <div className="flex items-center gap-3">
                        <RankBadge rank={myRank} />
                        <div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.875rem', color: CU.charcoal }}>Tu posición</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#6b7280' }}>
                                {tab === 'ALL'
                                    ? `${entries[myRank - 1]?.prode_points || 0} Prode + ${entries[myRank - 1]?.fantasy_points || 0} Fantasy`
                                    : `${entries[myRank - 1]?.total_points || 0} puntos`}
                            </div>
                        </div>
                    </div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal }}>
                        {entries[myRank - 1]?.total_points || 0}
                    </div>
                </div>
            )}

            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
                {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => setTab(value)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all"
                        style={{
                            fontFamily: "'Raleway', sans-serif", fontWeight: 600,
                            background: tab === value ? 'white' : 'transparent',
                            color: tab === value ? CU.magenta : '#6b7280',
                            border: tab === value ? `1px solid #e5e7eb` : '1px solid transparent',
                            cursor: 'pointer'
                        }}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            <LeaderboardTable entries={entries} currentUserId={currentUser?.id} mode={tab} />
        </div>
    );
}