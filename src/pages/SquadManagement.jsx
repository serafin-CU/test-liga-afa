import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, Users, AlertCircle, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
};

const POSITION_COLORS = {
    GK: { bg: CU.blue + '20', color: CU.blue },
    DEF: { bg: CU.green + '20', color: CU.green },
    MID: { bg: CU.orange + '25', color: '#9a6e00' },
    FWD: { bg: CU.magenta + '20', color: CU.magenta },
};

function BadgePills({ userId, currentPhase }) {
    const { data: badges = [] } = useQuery({
        queryKey: ['userBadges', userId],
        queryFn: () => base44.entities.BadgeAward.filter({ user_id: userId }),
        enabled: !!userId
    });

    const hasCoreKeeper = badges.some(b => b.badge_type === 'CORE_KEEPER' && b.phase === currentPhase);
    const hasLoyalCore = badges.some(b => b.badge_type === 'LOYAL_CORE');

    if (!hasCoreKeeper && !hasLoyalCore) return null;

    return (
        <div className="flex gap-2 mt-2 flex-wrap">
            {hasCoreKeeper && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold"
                      style={{ background: CU.blue + '18', color: CU.blue, border: `1px solid ${CU.blue}30`, fontFamily: "'Raleway', sans-serif" }}>
                    🛡️ Core Keeper ✓
                </span>
            )}
            {hasLoyalCore && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold"
                      style={{ background: CU.orange + '20', color: '#9a6e00', border: `1px solid ${CU.orange}40`, fontFamily: "'Raleway', sans-serif" }}>
                    ⭐ Loyal Core ✓
                </span>
            )}
        </div>
    );
}

function BadgesSection({ userId, currentPhase }) {
    const { data: badges = [], isLoading } = useQuery({
        queryKey: ['userBadges', userId],
        queryFn: () => base44.entities.BadgeAward.filter({ user_id: userId }),
        enabled: !!userId
    });

    const coreKeeperBadges = badges.filter(b => b.badge_type === 'CORE_KEEPER');
    const latestCoreKeeper = coreKeeperBadges.sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at))[0];
    const loyalCore = badges.find(b => b.badge_type === 'LOYAL_CORE');

    const BADGE_INFO = {
        CORE_KEEPER: { title: '🛡️ Core Keeper', description: 'Kept 8 or more of your 11 starters from the previous knockout phase.', accentColor: CU.blue },
        LOYAL_CORE: { title: '⭐ Loyal Core', description: 'Kept 9 or more of your original Round of 32 starters all the way to the Final.', accentColor: CU.orange },
    };

    const BadgeCard = ({ info, earned, badge, earnedCount }) => {
        const [expanded, setExpanded] = useState(false);
        return (
            <div className="rounded-xl p-4" style={{
                border: earned ? `2px solid ${info.accentColor}40` : '1px solid #e5e7eb',
                background: earned ? info.accentColor + '08' : 'white'
            }}>
                <div className="flex items-start justify-between mb-2">
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: CU.charcoal }}>{info.title}</div>
                    {earned ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full"
                              style={{ background: info.accentColor + '20', color: info.accentColor, fontFamily: "'Raleway', sans-serif" }}>Earned</span>
                    ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded-full"
                              style={{ background: '#f3f4f6', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>Not earned</span>
                    )}
                </div>
                {earned && badge && (
                    <div className="text-sm space-y-0.5 mb-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                        <div><strong>Phase:</strong> {badge.phase || '—'}</div>
                        <div><strong>When:</strong> {badge.awarded_at ? new Date(badge.awarded_at).toLocaleString() : '—'}</div>
                        {earnedCount > 1 && <div style={{ color: info.accentColor, fontSize: '0.75rem' }}>+{earnedCount - 1} more phase(s)</div>}
                    </div>
                )}
                <button
                    className="text-xs underline"
                    style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Hide' : "How it's earned"}
                </button>
                {expanded && (
                    <p className="text-xs mt-2 p-2 rounded-lg" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280', background: '#f9fafb' }}>{info.description}</p>
                )}
            </div>
        );
    };

    return (
        <div className="mt-6 rounded-xl" style={{ border: '1px solid #e5e7eb', background: 'white', overflow: 'hidden' }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <Award className="w-5 h-5" style={{ color: CU.orange }} />
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>My Badges</span>
            </div>
            <div className="p-4">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading badges...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <BadgeCard info={BADGE_INFO.CORE_KEEPER} earned={coreKeeperBadges.length > 0} badge={latestCoreKeeper} earnedCount={coreKeeperBadges.length} />
                        <BadgeCard info={BADGE_INFO.LOYAL_CORE} earned={!!loyalCore} badge={loyalCore} earnedCount={loyalCore ? 1 : 0} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SquadManagement() {
    const [confirmCaptainDialog, setConfirmCaptainDialog] = useState(null);
    const queryClient = useQueryClient();

    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: players = [] } = useQuery({
        queryKey: ['players'],
        queryFn: () => base44.entities.Player.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const playersMap = Object.fromEntries(players.map(p => [p.id, p]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const { data: userSquads = [], isLoading: squadsLoading } = useQuery({
        queryKey: ['userSquads', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            return await base44.entities.FantasySquad.filter({ user_id: currentUser.id, status: 'FINAL' });
        },
        enabled: !!currentUser
    });

    const activeSquad = userSquads.length > 0 ? userSquads[0] : null;

    const { data: squadPlayers = [], isLoading: playersLoading } = useQuery({
        queryKey: ['squadPlayers', activeSquad?.id],
        queryFn: async () => {
            if (!activeSquad) return [];
            return await base44.entities.FantasySquadPlayer.filter({ squad_id: activeSquad.id });
        },
        enabled: !!activeSquad
    });

    const { data: phaseLockData } = useQuery({
        queryKey: ['phaseLock', activeSquad?.phase],
        queryFn: async () => {
            if (!activeSquad) return null;
            const response = await base44.functions.invoke('fantasyTransferService', {
                action: 'check_phase_lock',
                target_phase: activeSquad.phase
            });
            return response.data;
        },
        enabled: !!activeSquad
    });

    const isPhaseLocked = phaseLockData?.is_locked || false;
    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    const bench = squadPlayers.filter(sp => sp.slot_type === 'BENCH');
    const captain = squadPlayers.find(sp => sp.is_captain === true);

    const getFormationValidation = () => {
        if (starters.length !== 11) return { valid: false, message: `Invalid formation: ${starters.length} starters (must be exactly 11)` };
        const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const sp of starters) {
            const player = playersMap[sp.player_id];
            if (player) positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
        }
        const errors = [];
        if (positionCounts.GK !== 1) errors.push(`GK: ${positionCounts.GK} (must be 1)`);
        if (positionCounts.DEF !== 4) errors.push(`DEF: ${positionCounts.DEF} (must be 4)`);
        if (positionCounts.MID !== 3) errors.push(`MID: ${positionCounts.MID} (must be 3)`);
        if (positionCounts.FWD !== 3) errors.push(`FWD: ${positionCounts.FWD} (must be 3)`);
        if (errors.length > 0) return { valid: false, message: 'Invalid formation. Starters must be 1 GK, 4 DEF, 3 MID, 3 FWD.', details: errors };
        return { valid: true };
    };

    const formationValidation = getFormationValidation();

    const setCaptainMutation = useMutation({
        mutationFn: async ({ playerId, squadId }) => {
            const response = await base44.functions.invoke('squadCaptainService', {
                action: 'set_captain',
                squad_id: squadId,
                player_id: playerId
            });
            if (response.data.status === 'ERROR') throw new Error(response.data.message || 'Failed to set captain');
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Captain set successfully');
            queryClient.invalidateQueries({ queryKey: ['squadPlayers'] });
            setConfirmCaptainDialog(null);
        },
        onError: (error) => {
            const errorMessages = {
                'NOT_A_STARTER': 'Only starters can be set as captain',
                'PLAYER_NOT_IN_SQUAD': 'Player is not in this squad',
                'INVALID_SQUAD': 'Squad not found',
                'FORBIDDEN': 'You do not have permission to modify this squad'
            };
            toast.error(errorMessages[error.message] || error.message || 'Failed to set captain');
            setConfirmCaptainDialog(null);
        }
    });

    const handleSetCaptainClick = (playerId) => {
        if (!activeSquad) { toast.error('No active squad found'); return; }
        if (isPhaseLocked) { toast.error('Squad is locked - cannot change captain after phase cutoff'); return; }
        const player = playersMap[playerId];
        const squadPlayer = squadPlayers.find(sp => sp.player_id === playerId);
        if (!squadPlayer || squadPlayer.slot_type !== 'STARTER') { toast.error('Only starters can be set as captain'); return; }
        setConfirmCaptainDialog({ playerId, playerName: player?.full_name || 'Unknown Player' });
    };

    const confirmSetCaptain = () => {
        if (!confirmCaptainDialog || !activeSquad) return;
        setCaptainMutation.mutate({ playerId: confirmCaptainDialog.playerId, squadId: activeSquad.id });
    };

    const PlayerRow = ({ squadPlayer, showCaptainControls }) => {
        const player = playersMap[squadPlayer.player_id];
        const team = teamsMap[player?.team_id];
        const isCaptain = squadPlayer.is_captain === true;
        if (!player) return null;
        const posStyle = POSITION_COLORS[player.position] || { bg: '#f3f4f6', color: '#6b7280' };

        return (
            <div className="flex items-center justify-between p-3"
                 style={{ borderBottom: '1px solid #f3f4f6', background: isCaptain ? CU.orange + '08' : 'white' }}>
                <div className="flex items-center gap-3 flex-1">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold"
                          style={{ background: posStyle.bg, color: posStyle.color, fontFamily: "'Raleway', sans-serif" }}>
                        {player.position}
                    </span>
                    {isCaptain && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: CU.orange, color: 'white', fontFamily: "'Raleway', sans-serif" }}>
                            C
                        </span>
                    )}
                    <div className="flex-1">
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: CU.charcoal }}>{player.full_name}</div>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.8rem', color: '#6b7280' }}>{team?.name || 'Unknown Team'}</div>
                    </div>
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.85rem', color: '#9ca3af' }}>
                        ${player.price}M
                    </div>
                </div>
                {showCaptainControls && !isCaptain && (
                    <button
                        onClick={() => handleSetCaptainClick(squadPlayer.player_id)}
                        disabled={setCaptainMutation.isPending || isPhaseLocked}
                        className="ml-4 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            background: isPhaseLocked ? '#f3f4f6' : 'white',
                            color: isPhaseLocked ? '#9ca3af' : CU.charcoal,
                            border: `1px solid ${isPhaseLocked ? '#e5e7eb' : CU.charcoal + '40'}`,
                            cursor: isPhaseLocked ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isPhaseLocked ? 'Locked' : 'Set C'}
                    </button>
                )}
            </div>
        );
    };

    if (userLoading || squadsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: CU.orange }} />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="rounded-xl p-6 text-center" style={{ border: '1px solid #e5e7eb', fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                    Please log in to view your squad
                </div>
            </div>
        );
    }

    if (!activeSquad) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal, marginBottom: '24px' }}>My Squad</h1>
                <div className="rounded-xl p-10 text-center space-y-4" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                    <Users className="w-16 h-16 mx-auto" style={{ color: '#d1d5db' }} />
                    <div style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>You don't have an active squad yet</div>
                    <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#9ca3af' }}>Contact an administrator to set up your fantasy squad</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal }}>My Squad</h1>
                <p style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280', marginTop: '4px' }}>Manage your fantasy football team</p>
                <BadgePills userId={currentUser.id} currentPhase={activeSquad?.phase} />
            </div>

            {/* Phase lock warning */}
            {isPhaseLocked && (
                <div className="mb-6 flex items-start gap-2 p-4 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#991b1b' }}>
                        <strong>Squad Locked:</strong> This phase is locked. No changes can be made to your squad, captain, or bench.
                    </div>
                </div>
            )}

            {/* Captain info */}
            <div className="mb-6 flex items-start gap-2 p-4 rounded-xl" style={{ background: CU.blue + '10', border: `1px solid ${CU.blue}30` }}>
                <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: CU.blue }} />
                <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: CU.blue }}>
                    <strong>Captain Info:</strong> Only starters can be Captain. Captain earns 2x points. Set one captain among your 11 starters.
                    {phaseLockData && !isPhaseLocked && phaseLockData.hours_until_lock > 0 && (
                        <span className="block mt-1">
                            Squad locks in {phaseLockData.hours_until_lock} hours ({new Date(phaseLockData.lock_time).toLocaleString()})
                        </span>
                    )}
                </div>
            </div>

            {/* Formation validation */}
            {!formationValidation.valid && (
                <div className="mb-6 flex items-start gap-2 p-4 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
                    <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem' }}>
                        <div style={{ fontWeight: 700, color: '#991b1b' }}>{formationValidation.message}</div>
                        {formationValidation.details && <div style={{ marginTop: '4px', color: '#b91c1c' }}>{formationValidation.details.join(', ')}</div>}
                    </div>
                </div>
            )}

            {/* Squad info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Budget Used', value: `$${activeSquad.total_cost}M / $${activeSquad.budget_cap}M`, accent: CU.orange },
                    { label: 'Starters', value: `${starters.length} / 11`, accent: CU.blue },
                    { label: 'Captain', value: captain ? (playersMap[captain.player_id]?.full_name || 'Unknown') : 'Not Set', accent: CU.magenta },
                ].map(({ label, value, accent }) => (
                    <div key={label} className="rounded-xl p-4" style={{ background: 'white', border: '1px solid #e5e7eb', borderTop: `3px solid ${accent}` }}>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', color: CU.charcoal, marginTop: '2px' }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Starters */}
            <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <Users className="w-5 h-5" style={{ color: CU.blue }} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>Starting XI (1 GK, 4 DEF, 3 MID, 3 FWD)</span>
                </div>
                {playersLoading ? (
                    <div className="p-8 text-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading starters...
                    </div>
                ) : starters.length === 0 ? (
                    <div className="p-8 text-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        No starters in your squad yet
                    </div>
                ) : (
                    <div>
                        {starters.map(sp => <PlayerRow key={sp.id} squadPlayer={sp} showCaptainControls={true} />)}
                    </div>
                )}
            </div>

            {/* Bench */}
            {bench.length > 0 && (
                <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                    <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>Bench</span>
                    </div>
                    <div>
                        {bench.map(sp => <PlayerRow key={sp.id} squadPlayer={sp} showCaptainControls={false} />)}
                    </div>
                </div>
            )}

            {/* Badges */}
            <BadgesSection userId={currentUser.id} currentPhase={activeSquad?.phase} />

            {/* Confirm captain dialog */}
            <Dialog open={!!confirmCaptainDialog} onOpenChange={(open) => !open && setConfirmCaptainDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>Confirm Captain Selection</DialogTitle>
                    </DialogHeader>
                    {confirmCaptainDialog && (
                        <div className="space-y-4">
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem' }}>
                                Set <strong style={{ color: CU.magenta }}>{confirmCaptainDialog.playerName}</strong> as Captain?
                            </div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem', color: '#6b7280' }}>
                                Captain points are doubled (2x). This will replace any current captain.
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmCaptainDialog(null)} disabled={setCaptainMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmSetCaptain}
                            disabled={setCaptainMutation.isPending}
                            style={{ background: CU.magenta, color: 'white', fontFamily: "'Raleway', sans-serif", fontWeight: 700 }}
                        >
                            {setCaptainMutation.isPending ? 'Setting...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}