import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Trophy, Star, Shield, Zap, Target, AlertCircle, Clock, TrendingUp } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
    red: '#dc2626',
    gray: '#9ca3af',
};

const POS_COLORS = {
    GK: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    DEF: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
    MID: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    FWD: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
};

function PlayerCard({ p, isExpanded, onToggle }) {
    const posStyle = POS_COLORS[p.pos] || POS_COLORS.MID;
    const pts = p.points;
    const ptsColor = pts > 10 ? CU.green : pts > 5 ? CU.orange : pts > 0 ? CU.charcoal : CU.red;

    return (
        <div
            onClick={onToggle}
            className="rounded-xl border transition-all cursor-pointer hover:shadow-md"
            style={{
                borderColor: p.is_captain ? CU.orange : posStyle.border,
                background: p.is_captain ? '#fffbeb' : 'white',
                borderWidth: p.is_captain ? '2px' : '1px',
            }}
        >
            <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Position badge */}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: posStyle.bg, color: posStyle.text, fontFamily: "'Raleway', sans-serif" }}>
                    {p.pos}
                </span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate"
                            style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            {p.player_name}
                        </span>
                        {p.is_captain && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: CU.orange, color: 'white', fontFamily: "'Raleway', sans-serif" }}>
                                C×2
                            </span>
                        )}
                    </div>
                    {/* Mini stat row */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>
                            {p.mins}' jugados
                        </span>
                        {p.goals > 0 && <span className="text-xs font-semibold" style={{ color: CU.green }}>⚽ {p.goals > 1 ? `×${p.goals}` : ''}</span>}
                        {p.assists > 0 && <span className="text-xs font-semibold" style={{ color: CU.blue }}>🅰️ {p.assists > 1 ? `×${p.assists}` : ''}</span>}
                        {p.yc > 0 && <span className="text-xs">🟨</span>}
                        {p.rc > 0 && <span className="text-xs">🟥</span>}
                        {p.clean_sheet && (pos => pos === 'GK' || pos === 'DEF')(p.pos) && (
                            <span className="text-xs font-semibold" style={{ color: CU.blue }}>🧤 CS</span>
                        )}
                    </div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0">
                    <div className="text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: ptsColor }}>
                        {pts > 0 ? `+${pts}` : pts}
                    </div>
                    <div className="text-xs" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>pts</div>
                </div>

                {/* Expand chevron */}
                <div style={{ color: CU.gray }}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </div>

            {/* Expanded breakdown */}
            {isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: '#f3f4f6' }}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        <div className="flex justify-between">
                            <span style={{ color: CU.gray }}>Minutos jugados</span>
                            <span className="font-semibold" style={{ color: CU.charcoal }}>{p.mins}'</span>
                        </div>
                        {p.mins >= 60 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Bonus 60+ min</span>
                                <span className="font-semibold text-green-600">+2</span>
                            </div>
                        )}
                        {p.mins > 0 && p.mins < 60 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Bonus 1-59 min</span>
                                <span className="font-semibold text-green-600">+1</span>
                            </div>
                        )}
                        {p.goals > 0 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Goles ({p.goals}×)</span>
                                <span className="font-semibold text-green-600">+{p.goals * (p.pos === 'FWD' ? 5 : p.pos === 'MID' ? 6 : 7)}</span>
                            </div>
                        )}
                        {p.assists > 0 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Asistencias ({p.assists}×)</span>
                                <span className="font-semibold text-green-600">+{p.assists}</span>
                            </div>
                        )}
                        {p.clean_sheet && (p.pos === 'GK' || p.pos === 'DEF') && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Arco en cero</span>
                                <span className="font-semibold text-green-600">+4</span>
                            </div>
                        )}
                        {p.yc > 0 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Amarilla ({p.yc}×)</span>
                                <span className="font-semibold text-red-600">{p.yc * -1}</span>
                            </div>
                        )}
                        {p.rc > 0 && (
                            <div className="flex justify-between">
                                <span style={{ color: CU.gray }}>Roja</span>
                                <span className="font-semibold text-red-600">-3</span>
                            </div>
                        )}
                        {p.is_captain && p.base_points > 0 && (
                            <div className="flex justify-between col-span-2 pt-1 mt-1 border-t" style={{ borderColor: CU.orange + '40' }}>
                                <span style={{ color: CU.orange, fontWeight: 600 }}>Capitán (×2)</span>
                                <span className="font-bold" style={{ color: CU.orange }}>+{p.base_points} extra</span>
                            </div>
                        )}
                        <div className="flex justify-between col-span-2 pt-1 mt-1 border-t font-bold" style={{ borderColor: '#e5e7eb' }}>
                            <span style={{ color: CU.charcoal }}>Total</span>
                            <span style={{ color: ptsColor }}>{pts > 0 ? `+${pts}` : pts} pts</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MatchCard({ match, result, ledgerEntry, teamsMap, isExpanded, onToggle }) {
    const home = teamsMap[match.home_team_id];
    const away = teamsMap[match.away_team_id];
    const totalPts = ledgerEntry?.points ?? 0;
    const breakdown = ledgerEntry ? (() => { try { return JSON.parse(ledgerEntry.breakdown_json); } catch { return null; } })() : null;
    const perPlayer = breakdown?.per_player || [];

    const [expandedPlayer, setExpandedPlayer] = useState(null);

    const kickoff = new Date(match.kickoff_at);
    const kickoffLabel = kickoff.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

    const ptsColor = totalPts > 15 ? CU.green : totalPts > 8 ? CU.orange : totalPts > 0 ? CU.charcoal : CU.gray;
    const bgColor = totalPts > 15 ? '#f0fdf4' : totalPts > 8 ? '#fffbeb' : 'white';

    return (
        <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#e5e7eb', background: bgColor }}>
            {/* Match header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* Teams */}
                    <div className="flex items-center gap-2 min-w-0">
                        {home?.logo_url && <img src={home.logo_url} alt={home.fifa_code} className="w-6 h-6 object-contain shrink-0" />}
                        <span className="font-bold text-sm" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            {home?.fifa_code || home?.name || '?'}
                        </span>
                        {result && (
                            <span className="text-sm font-bold px-2 py-0.5 rounded"
                                style={{ background: '#1f293710', color: CU.charcoal, fontFamily: "'DM Serif Display', serif" }}>
                                {result.home_goals}–{result.away_goals}
                            </span>
                        )}
                        <span className="font-bold text-sm" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            {away?.fifa_code || away?.name || '?'}
                        </span>
                        {away?.logo_url && <img src={away.logo_url} alt={away.fifa_code} className="w-6 h-6 object-contain shrink-0" />}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                        {ledgerEntry ? (
                            <>
                                <div className="text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: ptsColor }}>
                                    {totalPts > 0 ? `+${totalPts}` : totalPts}
                                </div>
                                <div className="text-xs" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>pts</div>
                            </>
                        ) : (
                            <div className="text-sm" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>—</div>
                        )}
                    </div>
                    <div style={{ color: CU.gray }}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {/* Date subline */}
            <div className="px-4 -mt-2 pb-2 text-xs" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>
                {kickoffLabel}
                {perPlayer.length > 0 && (
                    <span className="ml-2">{perPlayer.filter(p => p.mins > 0).length} jugadores activos</span>
                )}
            </div>

            {/* Expanded player breakdown */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: '#f3f4f6' }}>
                    {perPlayer.length === 0 ? (
                        <div className="text-center py-4 text-sm" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>
                            Ningún jugador de tu equipo participó en este partido.
                        </div>
                    ) : (
                        <>
                            <div className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: CU.gray, fontFamily: "'Raleway', sans-serif" }}>
                                Tu equipo en este partido
                            </div>
                            {[...perPlayer]
                                .sort((a, b) => b.points - a.points)
                                .map(p => (
                                    <PlayerCard
                                        key={p.player_id}
                                        p={p}
                                        isExpanded={expandedPlayer === p.player_id}
                                        onToggle={() => setExpandedPlayer(expandedPlayer === p.player_id ? null : p.player_id)}
                                    />
                                ))
                            }
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function MiFantasy() {
    const [expandedMatch, setExpandedMatch] = useState(null);
    const [selectedVenue, setSelectedVenue] = useState(null);

    const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

    const { data: allMatches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list('kickoff_at', 500)
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list(undefined, 200)
    });

    const { data: matchResults = [] } = useQuery({
        queryKey: ['matchResults'],
        queryFn: () => base44.entities.MatchResultFinal.list('finalized_at', 500)
    });

    const { data: ledgerEntries = [], isLoading: ledgerLoading } = useQuery({
        queryKey: ['fantasyLedger', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            const all = await base44.entities.PointsLedger.filter({ user_id: currentUser.id, mode: 'FANTASY' });
            return all;
        },
        enabled: !!currentUser
    });

    const { data: squad } = useQuery({
        queryKey: ['mySquad', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return null;
            const squads = await base44.entities.FantasySquad.filter({ user_id: currentUser.id, status: 'FINAL' });
            return squads[0] || null;
        },
        enabled: !!currentUser
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const resultsMap = Object.fromEntries(matchResults.map(r => [r.match_id, r]));

    // Only show finalized matches that have been scored
    const scoredMatchIds = new Set(ledgerEntries.map(e => e.source_id));
    const finalizedMatches = allMatches
        .filter(m => m.status === 'FINAL' && m.api_fixture_id)
        .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

    // Group by venue for filter tabs
    const venues = [...new Set(finalizedMatches.map(m => m.venue).filter(Boolean))].sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, '')) || 0;
        const nb = parseInt(b.replace(/\D/g, '')) || 0;
        return nb - na; // most recent first
    });

    // Auto-select most recent venue
    useEffect(() => {
        if (venues.length > 0 && !selectedVenue) {
            setSelectedVenue(venues[0]);
        }
    }, [venues.length]);

    const filteredMatches = selectedVenue
        ? finalizedMatches.filter(m => m.venue === selectedVenue)
        : finalizedMatches;

    // Stats summary
    const totalFantasyPts = ledgerEntries.reduce((s, e) => s + (e.points || 0), 0);
    const scoredMatches = ledgerEntries.filter(e => e.points > 0).length;
    const bestMatch = ledgerEntries.reduce((best, e) => (!best || e.points > best.points) ? e : best, null);
    const bestMatchData = bestMatch ? allMatches.find(m => m.id === bestMatch.source_id) : null;

    const isLoading = matchesLoading || ledgerLoading;

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto p-6 flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mr-3" />
                <span style={{ fontFamily: "'Raleway', sans-serif", color: CU.gray }}>Cargando tu Fantasy...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-3 sm:p-6 pb-16" style={{ fontFamily: "'Raleway', sans-serif" }}>

            {/* Header */}
            <div className="mb-5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.blue }}>
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            Mi Fantasy
                        </h1>
                        {currentUser && (
                            <p className="text-xs" style={{ color: CU.gray }}>{currentUser.full_name || currentUser.email}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="rounded-xl p-3 text-center" style={{ background: '#f0fdf4', border: `1px solid #86efac` }}>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.green }}>
                        {totalFantasyPts}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#166534' }}>Puntos totales</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#eff6ff', border: `1px solid #93c5fd` }}>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.blue }}>
                        {scoredMatches}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#1e40af' }}>Partidos con pts</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#fffbeb', border: `1px solid #fde68a` }}>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: '#92400e' }}>
                        {bestMatch?.points || 0}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#92400e' }}>Mejor partido</div>
                </div>
            </div>

            {/* No squad warning */}
            {!squad && (
                <div className="rounded-xl p-4 mb-5 flex items-start gap-3"
                    style={{ background: '#fef3c7', border: `1px solid ${CU.orange}40` }}>
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: CU.orange }} />
                    <div>
                        <div className="font-semibold text-sm" style={{ color: '#92400e' }}>No tenés equipo finalizado</div>
                        <div className="text-xs mt-0.5" style={{ color: '#78350f' }}>
                            Armá y finalizá tu equipo en el Armador de Equipo para empezar a acumular puntos.
                        </div>
                    </div>
                </div>
            )}

            {/* Venue filter tabs */}
            {venues.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {venues.map(v => (
                        <button
                            key={v}
                            onClick={() => { setSelectedVenue(v); setExpandedMatch(null); }}
                            className="shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                            style={{
                                background: selectedVenue === v ? CU.charcoal : '#f3f4f6',
                                color: selectedVenue === v ? 'white' : CU.charcoal,
                                fontFamily: "'Raleway', sans-serif",
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            )}

            {/* Selected fecha total */}
            {selectedVenue && (
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-sm font-semibold" style={{ color: CU.charcoal }}>{selectedVenue}</span>
                    <span className="text-sm font-bold" style={{ color: CU.green }}>
                        +{filteredMatches.reduce((sum, m) => {
                            const entry = ledgerEntries.find(e => e.source_id === m.id);
                            return sum + (entry?.points || 0);
                        }, 0)} pts
                    </span>
                </div>
            )}

            {/* Match list */}
            {filteredMatches.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: CU.gray }}>
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">No hay partidos finalizados aún.</p>
                    <p className="text-sm mt-1">Los puntos aparecen después de cada partido.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredMatches.map(match => {
                        const ledgerEntry = ledgerEntries.find(e => e.source_id === match.id);
                        return (
                            <MatchCard
                                key={match.id}
                                match={match}
                                result={resultsMap[match.id]}
                                ledgerEntry={ledgerEntry}
                                teamsMap={teamsMap}
                                isExpanded={expandedMatch === match.id}
                                onToggle={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}