import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, Users, AlertCircle, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';

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
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-sm font-semibold">
                    🛡️ Core Keeper ✓
                </span>
            )}
            {hasLoyalCore && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-sm font-semibold">
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
        CORE_KEEPER: {
            title: '🛡️ Core Keeper',
            description: 'Kept 8 or more of your 11 starters from the previous knockout phase.',
            color: 'blue'
        },
        LOYAL_CORE: {
            title: '⭐ Loyal Core',
            description: 'Kept 9 or more of your original Round of 32 starters all the way to the Final.',
            color: 'amber'
        }
    };

    const BadgeCard = ({ info, earned, badge, earnedCount }) => {
        const [expanded, setExpanded] = useState(false);
        const colorMap = {
            blue: { header: 'bg-blue-50 border-blue-200', tag: 'bg-blue-100 text-blue-800', count: 'text-blue-600' },
            amber: { header: 'bg-amber-50 border-amber-200', tag: 'bg-amber-100 text-amber-800', count: 'text-amber-600' }
        };
        const colors = colorMap[info.color];

        return (
            <Card className={`border-2 ${earned ? colors.header : 'border-gray-200'}`}>
                <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between">
                        <div className="font-semibold text-base">{info.title}</div>
                        {earned ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors.tag}`}>Earned</span>
                        ) : (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not earned</span>
                        )}
                    </div>
                    {earned && badge && (
                        <div className="text-sm text-gray-600 space-y-0.5">
                            <div><strong>Phase:</strong> {badge.phase || '—'}</div>
                            <div><strong>When:</strong> {badge.awarded_at ? new Date(badge.awarded_at).toLocaleString() : '—'}</div>
                            {earnedCount > 1 && (
                                <div className={`text-xs ${colors.count}`}>+{earnedCount - 1} more phase(s)</div>
                            )}
                        </div>
                    )}
                    <button
                        className="text-xs text-gray-400 underline hover:text-gray-600"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? 'Hide' : 'How it\'s earned'}
                    </button>
                    {expanded && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{info.description}</p>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    My Badges
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading badges...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <BadgeCard
                            info={BADGE_INFO.CORE_KEEPER}
                            earned={coreKeeperBadges.length > 0}
                            badge={latestCoreKeeper}
                            earnedCount={coreKeeperBadges.length}
                        />
                        <BadgeCard
                            info={BADGE_INFO.LOYAL_CORE}
                            earned={!!loyalCore}
                            badge={loyalCore}
                            earnedCount={loyalCore ? 1 : 0}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
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

    // Load user's active squad
    const { data: userSquads = [], isLoading: squadsLoading } = useQuery({
        queryKey: ['userSquads', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            return await base44.entities.FantasySquad.filter({ 
                user_id: currentUser.id,
                status: 'FINAL'
            });
        },
        enabled: !!currentUser
    });

    const activeSquad = userSquads.length > 0 ? userSquads[0] : null;

    // Load squad players
    const { data: squadPlayers = [], isLoading: playersLoading } = useQuery({
        queryKey: ['squadPlayers', activeSquad?.id],
        queryFn: async () => {
            if (!activeSquad) return [];
            return await base44.entities.FantasySquadPlayer.filter({ 
                squad_id: activeSquad.id 
            });
        },
        enabled: !!activeSquad
    });

    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    const bench = squadPlayers.filter(sp => sp.slot_type === 'BENCH');
    const captain = squadPlayers.find(sp => sp.is_captain === true);

    // Validate formation
    const getFormationValidation = () => {
        if (starters.length !== 11) {
            return {
                valid: false,
                message: `Invalid formation: ${starters.length} starters (must be exactly 11)`
            };
        }

        const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const sp of starters) {
            const player = playersMap[sp.player_id];
            if (player) {
                positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
            }
        }

        const errors = [];
        if (positionCounts.GK !== 1) errors.push(`GK: ${positionCounts.GK} (must be 1)`);
        if (positionCounts.DEF !== 4) errors.push(`DEF: ${positionCounts.DEF} (must be 4)`);
        if (positionCounts.MID !== 3) errors.push(`MID: ${positionCounts.MID} (must be 3)`);
        if (positionCounts.FWD !== 3) errors.push(`FWD: ${positionCounts.FWD} (must be 3)`);

        if (errors.length > 0) {
            return {
                valid: false,
                message: `Invalid formation. Starters must be 1 GK, 4 DEF, 3 MID, 3 FWD.`,
                details: errors
            };
        }

        return { valid: true };
    };

    const formationValidation = getFormationValidation();

    // Set captain mutation
    const setCaptainMutation = useMutation({
        mutationFn: async ({ playerId, squadId }) => {
            const response = await base44.functions.invoke('squadCaptainService', {
                action: 'set_captain',
                squad_id: squadId,
                player_id: playerId
            });

            if (response.data.status === 'ERROR') {
                throw new Error(response.data.message || 'Failed to set captain');
            }

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

            const message = errorMessages[error.message] || error.message || 'Failed to set captain';
            toast.error(message);
            setConfirmCaptainDialog(null);
        }
    });

    const handleSetCaptainClick = (playerId) => {
        if (!activeSquad) {
            toast.error('No active squad found');
            return;
        }

        // Check phase lock
        if (isPhaseLocked) {
            toast.error('Squad is locked - cannot change captain after phase cutoff');
            return;
        }

        const player = playersMap[playerId];
        const squadPlayer = squadPlayers.find(sp => sp.player_id === playerId);

        // Client-side validation
        if (!squadPlayer || squadPlayer.slot_type !== 'STARTER') {
            toast.error('Only starters can be set as captain');
            return;
        }

        setConfirmCaptainDialog({
            playerId,
            playerName: player?.full_name || 'Unknown Player'
        });
    };

    const confirmSetCaptain = () => {
        if (!confirmCaptainDialog || !activeSquad) return;

        setCaptainMutation.mutate({
            playerId: confirmCaptainDialog.playerId,
            squadId: activeSquad.id
        });
    };

    const PlayerRow = ({ squadPlayer, showCaptainControls }) => {
        const player = playersMap[squadPlayer.player_id];
        const team = teamsMap[player?.team_id];
        const isCaptain = squadPlayer.is_captain === true;

        if (!player) return null;

        return (
            <div className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2 min-w-[120px]">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
                            player.position === 'GK' ? 'bg-yellow-100 text-yellow-800' :
                            player.position === 'DEF' ? 'bg-blue-100 text-blue-800' :
                            player.position === 'MID' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                            {player.position}
                        </span>
                        {isCaptain && (
                            <span 
                                className="inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold"
                                aria-label="Captain"
                                title="Captain (2x points multiplier)"
                            >
                                C
                            </span>
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold text-gray-900">{player.full_name}</div>
                        <div className="text-sm text-gray-600">{team?.name || 'Unknown Team'}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                        Price: ${player.price}M
                    </div>
                </div>
                {showCaptainControls && !isCaptain && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetCaptainClick(squadPlayer.player_id)}
                        disabled={setCaptainMutation.isPending || isPhaseLocked}
                        className="ml-4"
                    >
                        {isPhaseLocked ? 'Locked' : 'Set C'}
                    </Button>
                )}
            </div>
        );
    };

    // Check phase lock
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

    if (userLoading || squadsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-gray-600">
                            Please log in to view your squad
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!activeSquad) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">My Squad</h1>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <Users className="w-16 h-16 text-gray-400 mx-auto" />
                            <div className="text-gray-600">
                                You don't have an active squad yet
                            </div>
                            <p className="text-sm text-gray-500">
                                Contact an administrator to set up your fantasy squad
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">My Squad</h1>
                <p className="text-gray-600 mt-1">Manage your fantasy football team</p>
                <BadgePills userId={currentUser.id} currentPhase={activeSquad?.phase} />
            </div>

            {/* Phase lock warning */}
            {isPhaseLocked && (
                <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-300 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                        <strong>Squad Locked:</strong> This phase is locked. No changes can be made to your squad, captain, or bench.
                    </div>
                </div>
            )}

            {/* Helper text */}
            <div className="mb-6 flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                    <strong>Captain Info:</strong> Only starters can be Captain. Captain earns 2x points. Set one captain among your 11 starters.
                    {phaseLockData && !isPhaseLocked && phaseLockData.hours_until_lock > 0 && (
                        <span className="block mt-1 text-blue-700">
                            Squad locks in {phaseLockData.hours_until_lock} hours ({new Date(phaseLockData.lock_time).toLocaleString()})
                        </span>
                    )}
                </div>
            </div>

            {/* Formation validation */}
            {!formationValidation.valid && (
                <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-300 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <div className="font-semibold text-red-800">{formationValidation.message}</div>
                        {formationValidation.details && (
                            <div className="mt-1 text-red-700">
                                {formationValidation.details.join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Squad info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Budget Used</div>
                        <div className="text-2xl font-bold">${activeSquad.total_cost}M / ${activeSquad.budget_cap}M</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Starters</div>
                        <div className="text-2xl font-bold">{starters.length} / 11</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600">Captain</div>
                        <div className="text-2xl font-bold">
                            {captain ? playersMap[captain.player_id]?.full_name || 'Unknown' : 'Not Set'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Starters */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Starting XI (1 GK, 4 DEF, 3 MID, 3 FWD)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {playersLoading ? (
                        <div className="p-8 text-center text-gray-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading starters...
                        </div>
                    ) : starters.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No starters in your squad yet
                        </div>
                    ) : (
                        <div className="divide-y">
                            {starters.map(sp => (
                                <PlayerRow 
                                    key={sp.id} 
                                    squadPlayer={sp} 
                                    showCaptainControls={true}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bench */}
            {bench.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Bench
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {bench.map(sp => (
                                <PlayerRow 
                                    key={sp.id} 
                                    squadPlayer={sp} 
                                    showCaptainControls={false}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Badges Section */}
            <BadgesSection userId={currentUser.id} currentPhase={activeSquad?.phase} />

            {/* Confirm captain dialog */}
            <Dialog open={!!confirmCaptainDialog} onOpenChange={(open) => !open && setConfirmCaptainDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Captain Selection</DialogTitle>
                    </DialogHeader>

                    {confirmCaptainDialog && (
                        <div className="space-y-4">
                            <div className="text-sm">
                                Set <strong className="text-blue-600">{confirmCaptainDialog.playerName}</strong> as Captain?
                            </div>
                            <div className="text-sm text-gray-600">
                                Captain points are doubled (2x). This will replace any current captain.
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmCaptainDialog(null)}
                            disabled={setCaptainMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmSetCaptain}
                            disabled={setCaptainMutation.isPending}
                        >
                            {setCaptainMutation.isPending ? 'Setting...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}