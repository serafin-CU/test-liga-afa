import React from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Trophy, Users, Target, TrendingUp, Loader2, ChevronRight, Award } from 'lucide-react';

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

function RecentPredictions({ predictions, matches, teams }) {
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

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

                return (
                    <div key={pred.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: '#f9fafb' }}>
                        <div className="flex items-center gap-3">
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af', width: '60px' }}>
                                {kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, fontSize: '0.875rem', color: CU.charcoal }}>
                                {homeName} vs {awayName}
                            </div>
                        </div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 700, color: CU.charcoal, fontSize: '0.95rem' }}>
                            {pred.pred_home_goals} – {pred.pred_away_goals}
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
        queryFn: () => base44.entities.FantasySquad.filter({ user_id: currentUser.id, status: 'FINAL' }),
        enabled: !!currentUser
    });

    const latestSquad = squads.sort((a, b) => new Date(b.finalized_at || b.created_date) - new Date(a.finalized_at || a.created_date))[0];

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
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.85rem', color: '#6b7280' }}>
                    Phase: <span style={{ fontWeight: 600, color: CU.charcoal }}>{latestSquad.phase}</span>
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

    const prodePoints = ledger.filter(e => e.mode === 'PRODE').reduce((sum, e) => sum + (e.points || 0), 0);
    const fantasyPoints = ledger.filter(e => e.mode === 'FANTASY').reduce((sum, e) => sum + (e.points || 0), 0);
    const totalPoints = prodePoints + fantasyPoints;

    const now = new Date();
    const upcomingMatches = matches.filter(m => new Date(m.kickoff_at) > now).length;

    if (userLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex items-center gap-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
        );
    }

    const kickoff = new Date('2026-06-11T00:00:00');
    const daysUntil = Math.max(0, Math.ceil((kickoff - new Date()) / (1000 * 60 * 60 * 24)));

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Hero Banner */}
            <div className="rounded-xl px-6 py-5 flex items-center justify-between" style={{ background: CU.charcoal }}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontSize: '1.4rem' }}>⚽</span>
                        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', color: 'white', margin: 0 }}>
                            FIFA World Cup 2026
                        </h2>
                    </div>
                    <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                        Canada · Mexico · United States — June 11 to July 19
                    </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.orange, lineHeight: 1 }}>{daysUntil}</div>
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>days to kickoff</div>
                </div>
            </div>

            {/* Header */}
            <div>
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, margin: 0 }}>
                    Welcome{currentUser?.full_name ? `, ${currentUser.full_name}` : ''}
                </h1>
                <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                    Your ScoreKeeper Pro overview
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={TrendingUp} label="Total Points" value={totalPoints} sublabel="Prode + Fantasy" accentColor={CU.orange} />
                <StatCard icon={Trophy} label="Prode Points" value={prodePoints} sublabel={`${predictions.length} predictions`} accentColor={CU.green} />
                <StatCard icon={Users} label="Fantasy Points" value={fantasyPoints} accentColor={CU.blue} />
                <StatCard icon={Award} label="Badges" value={badges.length} sublabel={badges.length > 0 ? badges.map(b => b.badge_type).join(', ') : 'None yet'} accentColor={CU.magenta} />
            </div>

            {/* Two-column content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Recent Predictions" icon={Target} iconColor={CU.orange} linkTo="/ProdePredictions" linkLabel="All">
                    <RecentPredictions predictions={predictions} matches={matches} teams={teams} />
                </SectionCard>
                <SectionCard title="My Squad" icon={Users} iconColor={CU.blue} linkTo="/SquadManagement" linkLabel="Manage">
                    <SquadSummary currentUser={currentUser} teams={teams} />
                </SectionCard>
            </div>

            {upcomingMatches > 0 && (
                <div className="text-center text-sm pt-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {upcomingMatches} upcoming match{upcomingMatches !== 1 ? 'es' : ''} to predict
                </div>
            )}
        </div>
    );
}