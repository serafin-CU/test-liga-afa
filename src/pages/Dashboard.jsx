import React from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Trophy, Users, Target, TrendingUp, Loader2, ChevronRight, Award, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
};

function StatCard({ icon: Icon, label, value, sublabel, accentColor }) {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: accentColor }} />
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div style={{ padding: '8px', borderRadius: '8px', background: accentColor + '18' }}>
                        <Icon className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>{label}</div>
                        {sublabel && <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{sublabel}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RecentPredictions({ predictions, matches, teams, results, ledger }) {
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const resultsByMatchId = Object.fromEntries(results.map(r => [r.match_id, r]));

    // Build a map of match_id -> prode points from ledger
    const prodePointsByMatchId = {};
    for (const entry of ledger) {
        if (entry.mode !== 'PRODE') continue;
        // source_id format: "MATCH:{match_id}:v1"
        const parts = entry.source_id?.split(':');
        if (parts?.length >= 2) {
            const mid = parts[1];
            prodePointsByMatchId[mid] = (prodePointsByMatchId[mid] || 0) + entry.points;
        }
    }

    const recent = [...predictions]
        .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date))
        .slice(0, 5);

    if (recent.length === 0) {
        return (
            <div className="text-center py-6 text-sm" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No predictions yet.{' '}
                <Link to="/ProdePredictions" style={{ color: CU.blue, textDecoration: 'underline' }}>Make your first!</Link>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {recent.map(pred => {
                const match = matchesMap[pred.match_id];
                if (!match) return null;
                const home = teamsMap[match.home_team_id];
                const away = teamsMap[match.away_team_id];
                const homeName = home?.fifa_code || home?.name || '???';
                const awayName = away?.fifa_code || away?.name || '???';
                const kickoff = new Date(match.kickoff_at);
                const result = resultsByMatchId[pred.match_id];
                const pts = prodePointsByMatchId[pred.match_id];
                const isFinalized = match.status === 'FINAL' && result;

                let pointsColor = '#9ca3af';
                if (pts === 5) pointsColor = CU.green;
                else if (pts === 3) pointsColor = CU.orange;
                else if (isFinalized && (pts === 0 || pts === undefined)) pointsColor = '#ef4444';

                return (
                    <div key={pred.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: '#f9fafb' }}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', width: '50px', flexShrink: 0 }}>
                                {kickoff.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: '0.875rem', color: CU.charcoal }}>
                                    {home?.logo_url && <img src={home.logo_url} alt={homeName} className="w-4 h-4 object-contain" />}
                                    <span className="truncate">{homeName}</span>
                                    <span style={{ color: '#9ca3af', fontWeight: 400 }}>vs</span>
                                    {away?.logo_url && <img src={away.logo_url} alt={awayName} className="w-4 h-4 object-contain" />}
                                    <span className="truncate">{awayName}</span>
                                </div>
                                {isFinalized && (
                                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.72rem', color: '#6b7280', marginTop: '1px' }}>
                                        Resultado: <span style={{ fontWeight: 700, color: CU.charcoal }}>{result.home_goals} – {result.away_goals}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 ml-2 flex-shrink-0">
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, color: CU.charcoal, fontSize: '0.95rem' }}>
                                {pred.pred_home_goals} – {pred.pred_away_goals}
                            </div>
                            {isFinalized && (
                                <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.72rem', color: pointsColor }}>
                                    {pts !== undefined ? `+${pts} pts` : '+0 pts'}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SquadSummary({ currentUser, teams }) {
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const { data: squads = [], isLoading } = useQuery({
        queryKey: ['userSquadsDash', currentUser?.id],
        queryFn: () => base44.entities.FantasySquad.filter({ user_id: currentUser.id }),
        enabled: !!currentUser
    });

    // Pick most recently updated squad (FINAL preferred, otherwise latest DRAFT)
    const latestSquad = [...squads]
        .sort((a, b) => {
            if (a.status === 'FINAL' && b.status !== 'FINAL') return -1;
            if (b.status === 'FINAL' && a.status !== 'FINAL') return 1;
            return new Date(b.last_autosaved_at || b.updated_date || b.created_date) - new Date(a.last_autosaved_at || a.updated_date || a.created_date);
        })[0];

    const { data: squadPlayers = [] } = useQuery({
        queryKey: ['squadPlayersDash', latestSquad?.id],
        queryFn: () => base44.entities.FantasySquadPlayer.filter({ squad_id: latestSquad.id }),
        enabled: !!latestSquad
    });

    const { data: allPlayers = [] } = useQuery({
        queryKey: ['allPlayers'],
        queryFn: () => base44.entities.Player.list()
    });

    const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

    if (isLoading) {
        return <div className="text-sm flex items-center gap-2" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}><Loader2 className="w-4 h-4 animate-spin" /> Loading squad...</div>;
    }

    if (!latestSquad) {
        return (
            <div className="text-center py-6 text-sm" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No squad created yet.{' '}
                <Link to="/SquadManagement" style={{ color: CU.blue, textDecoration: 'underline' }}>Build your squad!</Link>
            </div>
        );
    }

    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    const captain = squadPlayers.find(sp => sp.is_captain);
    const captainPlayer = captain ? playersMap[captain.player_id] : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                        {latestSquad.phase}
                    </span>
                    <span style={{
                        fontFamily: "'Raleway', sans-serif", fontSize: '0.65rem', fontWeight: 700,
                        padding: '1px 7px', borderRadius: '999px',
                        background: latestSquad.status === 'FINAL' ? CU.green + '20' : CU.orange + '20',
                        color: latestSquad.status === 'FINAL' ? CU.green : CU.orange,
                        border: `1px solid ${latestSquad.status === 'FINAL' ? CU.green : CU.orange}50`
                    }}>
                        {latestSquad.status === 'FINAL' ? 'Finalizado' : 'Borrador'}
                    </span>
                </div>
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af' }}>{starters.length}/11 starters</div>
            </div>
            {captainPlayer && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: CU.orange + '15', border: `1px solid ${CU.orange}40` }}>
                    <span style={{ color: CU.orange, fontWeight: 700, fontSize: '0.75rem', fontFamily: "'Raleway', sans-serif" }}>C</span>
                    <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.875rem', color: CU.charcoal }}>{captainPlayer.full_name}</span>
                    <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af' }}>({captainPlayer.position})</span>
                    <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: CU.orange, marginLeft: 'auto' }}>2× points</span>
                </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
                {starters.slice(0, 6).map(sp => {
                    const player = playersMap[sp.player_id];
                    if (!player) return null;
                    return (
                        <div key={sp.id} className="text-xs py-1.5 px-2 rounded flex items-center justify-between" style={{ background: '#f9fafb' }}>
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, color: CU.charcoal }} className="truncate">{player.full_name}</span>
                            <span style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af', marginLeft: '4px' }}>{player.position}</span>
                        </div>
                    );
                })}
                {starters.length > 6 && (
                    <div className="text-xs py-1.5 px-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        +{starters.length - 6} more
                    </div>
                )}
            </div>
        </div>
    );
}

function NextActionBanner({ matches }) {
    // Only look at real API matches (have api_fixture_id)
    const realMatches = matches.filter(m => m.api_fixture_id);
    const now = new Date();

    // Find the latest completed fecha
    const finalMatches = realMatches.filter(m => m.status === 'FINAL');
    const venues = [...new Set(finalMatches.map(m => m.venue))].sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numB - numA;
    });
    const lastFecha = venues[0]; // e.g. "Fecha 16"
    const lastFechaNum = lastFecha ? parseInt(lastFecha.replace(/\D/g, '')) : 0;

    // Find next scheduled fecha
    const scheduledMatches = realMatches.filter(m => m.status === 'SCHEDULED' && new Date(m.kickoff_at) > now);
    const nextMatch = scheduledMatches.sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0];

    // How many final matches in last fecha have no prediction entered? (handled by Prode page)
    const lastFechaMatchCount = finalMatches.filter(m => m.venue === lastFecha).length;

    if (!lastFecha && !nextMatch) return null;

    // Compute time until next kickoff
    let urgencyColor = CU.blue;
    let icon = Clock;
    let title = '';
    let subtitle = '';
    let linkTo = '/ProdePredictions';
    let linkLabel = 'Ir al Prode →';

    if (nextMatch) {
        const diff = new Date(nextMatch.kickoff_at) - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        const timeStr = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;

        if (hours < 24) { urgencyColor = '#ef4444'; icon = AlertCircle; }
        else if (hours < 72) { urgencyColor = CU.orange; icon = Clock; }
        else { urgencyColor = CU.blue; icon = Clock; }

        title = `Próxima fecha en ${timeStr}`;
        subtitle = `${lastFecha} completada · ${lastFechaMatchCount} partidos. Registrá tus predicciones antes del próximo saque.`;
    } else if (lastFecha) {
        urgencyColor = CU.green;
        icon = CheckCircle2;
        title = `${lastFecha} completada`;
        subtitle = `Todos los partidos finalizados. Actualizá tus puntajes en el Prode.`;
    }

    const Icon = icon;

    return (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{
            background: urgencyColor + '10',
            border: `1px solid ${urgencyColor}30`,
        }}>
            <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: urgencyColor }} />
            <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: urgencyColor }}>{title}</div>
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{subtitle}</div>
            </div>
            <Link to={linkTo} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.8rem', color: urgencyColor, whiteSpace: 'nowrap' }}>
                    {linkLabel}
                </span>
            </Link>
        </div>
    );
}

function SectionCard({ title, icon: Icon, iconColor, linkTo, linkLabel, children }) {
    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: CU.charcoal }}>{title}</span>
                </div>
                <Link to={linkTo}>
                    <button className="flex items-center gap-1 text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {linkLabel} <ChevronRight className="w-3 h-3" />
                    </button>
                </Link>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

export default function Dashboard() {
    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: predictions = [] } = useQuery({
        queryKey: ['dashPredictions', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            const result = await base44.functions.invoke('prodeService', {
                action: 'get_user_predictions',
                target_user_id: currentUser.id
            });
            return result.data?.predictions || [];
        },
        enabled: !!currentUser
    });

    const { data: ledger = [] } = useQuery({
        queryKey: ['dashLedger', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            return base44.entities.PointsLedger.filter({ user_id: currentUser.id });
        },
        enabled: !!currentUser
    });

    const { data: badges = [] } = useQuery({
        queryKey: ['dashBadges', currentUser?.id],
        queryFn: () => base44.entities.BadgeAward.filter({ user_id: currentUser.id }),
        enabled: !!currentUser
    });

    const { data: matchResults = [] } = useQuery({
        queryKey: ['dashMatchResults'],
        queryFn: () => base44.entities.MatchResultFinal.list()
    });

    const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((sum, e) => sum + (e.points || 0), 0);
    const fantasyPoints = ledger.filter(e => e.mode === 'FANTASY').reduce((sum, e) => sum + (e.points || 0), 0);
    const totalPoints = prodePoints + fantasyPoints;

    const now = new Date();
    const upcomingMatches = matches.filter(m => new Date(m.kickoff_at) > now && m.api_fixture_id).length;
    const finalMatches = matches.filter(m => m.status === 'FINAL' && m.api_fixture_id).length;
    const totalRealMatches = matches.filter(m => m.api_fixture_id).length;

    if (userLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            <WorldCupBanner />

            {/* Header */}
            <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, margin: 0 }}>
                    Hola, {currentUser?.display_name || currentUser?.full_name || currentUser?.email || ''}
                </h1>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                    Liga Profesional AFA · Apertura 2025
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={TrendingUp} label="Total Points" value={totalPoints} sublabel="Prode + Fantasy" accentColor={CU.orange} />
                <StatCard icon={Trophy} label="Prode Points" value={prodePoints} sublabel={`${predictions.length} predictions`} accentColor={CU.green} />
                <StatCard icon={Users} label="Fantasy Points" value={fantasyPoints} accentColor={CU.blue} />
                <StatCard icon={Award} label="Badges" value={badges.length} sublabel={badges.length > 0 ? badges.map(b => {
                    const names = { UNBREAKABLE_XI: '🛡️ Unbreakable XI', THE_ORIGINALS: '👑 The Originals', PERFECT_MATCHDAY: '🎯 Perfect Matchday' };
                    return names[b.badge_type] || b.badge_type;
                }).join(', ') : 'None yet'} accentColor={CU.magenta} />
            </div>

            {/* Next action banner */}
            <NextActionBanner matches={matches} />

            {/* Two-column content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Recent Predictions" icon={Target} iconColor={CU.orange} linkTo="/ProdePredictions" linkLabel="All">
                    <RecentPredictions predictions={predictions} matches={matches} teams={teams} results={matchResults} ledger={ledger} />
                </SectionCard>
                <SectionCard title="My Squad" icon={Users} iconColor={CU.blue} linkTo="/SquadManagement" linkLabel="Manage">
                    <SquadSummary currentUser={currentUser} teams={teams} />
                </SectionCard>
            </div>

            {totalRealMatches > 0 && (
                <div className="text-center text-sm pt-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {finalMatches}/{totalRealMatches} partidos finalizados · {upcomingMatches > 0 ? `${upcomingMatches} por jugar` : 'Temporada completa'}
                </div>
            )}
        </div>
    );
}