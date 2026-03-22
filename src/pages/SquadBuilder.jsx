import React, { useState, useEffect, useMemo, useCallback } from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, X, Shield, Users, Loader2, Check, AlertCircle, ChevronDown, Star, Lock } from 'lucide-react';
import { toast } from 'sonner';

const CU = {
    orange: '#FFB81C', charcoal: '#2C2B2B', magenta: '#AA0061',
    blue: '#475CC7', green: '#218848', orangeRed: '#F96F15',
    pink: '#DB1984', sage: '#B8CDC2', sand: '#C7B273',
};

const POS_STYLE = {
    GK:  { bg: CU.blue + '18', color: CU.blue, label: 'GK' },
    DEF: { bg: CU.green + '18', color: CU.green, label: 'DEF' },
    MID: { bg: CU.orange + '20', color: '#9a6e00', label: 'MID' },
    FWD: { bg: CU.magenta + '18', color: CU.magenta, label: 'FWD' },
};

const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
const BENCH_SIZE = 3;
const BUDGET_CAP = 150;
const TOTAL_STARTERS = 11;

const PHASE_OPTIONS = [
    { value: 'GROUP_MD1', label: 'Group Stage — Matchday 1' },
    { value: 'GROUP_MD2', label: 'Group Stage — Matchday 2' },
    { value: 'GROUP_MD3', label: 'Group Stage — Matchday 3' },
    { value: 'ROUND_OF_32', label: 'Round of 32' },
    { value: 'ROUND_OF_16', label: 'Round of 16' },
    { value: 'QUARTERFINALS', label: 'Quarterfinals' },
    { value: 'SEMIFINALS', label: 'Semifinals' },
    { value: 'FINAL', label: 'The Final 🏆' },
];

/* ── Slot component (empty or filled) ── */
function FormationSlot({ position, player, team, isCaptain, onRemove, onSetCaptain, disabled }) {
    const ps = POS_STYLE[position];
    if (!player) {
        return (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed"
                 style={{ borderColor: ps.color + '40', background: ps.bg, minHeight: 48 }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: ps.color + '20', color: ps.color, fontFamily: "'Raleway', sans-serif" }}>{ps.label}</span>
                <span className="text-sm" style={{ color: ps.color + '80', fontFamily: "'Raleway', sans-serif" }}>
                    Select {position}
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
             style={{ borderColor: isCaptain ? CU.orange : '#e5e7eb', background: isCaptain ? CU.orange + '08' : 'white' }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: ps.bg, color: ps.color, fontFamily: "'Raleway', sans-serif" }}>{ps.label}</span>
            {isCaptain && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: CU.orange, color: 'white' }}>C</span>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                    {player.full_name}
                </div>
                <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {team?.name || '—'} · ${player.price}M
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {!isCaptain && !disabled && (
                    <button onClick={() => onSetCaptain(player.id)} className="p-1 rounded hover:bg-gray-100" title="Set Captain">
                        <Star className="w-4 h-4" style={{ color: '#d1d5db' }} />
                    </button>
                )}
                {!disabled && (
                    <button onClick={() => onRemove(player.id)} className="p-1 rounded hover:bg-red-50" title="Remove">
                        <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Player pool row ── */
function PoolPlayer({ player, team, onAdd, disabled, alreadyIn, cantAfford }) {
    const ps = POS_STYLE[player.position];
    const isDisabled = disabled || alreadyIn || cantAfford;

    return (
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
             style={{ borderBottom: '1px solid #f3f4f6', opacity: isDisabled ? 0.4 : 1 }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: ps.bg, color: ps.color, fontFamily: "'Raleway', sans-serif" }}>{ps.label}</span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                    {player.full_name}
                </div>
                <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {team?.name || '—'}
                </div>
            </div>
            <span className="text-sm font-semibold shrink-0" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                ${player.price}M
            </span>
            <button
                onClick={() => onAdd(player)}
                disabled={isDisabled}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                    background: alreadyIn ? CU.green + '15' : isDisabled ? '#f3f4f6' : CU.magenta,
                    color: alreadyIn ? CU.green : isDisabled ? '#d1d5db' : 'white',
                    cursor: isDisabled ? 'default' : 'pointer'
                }}
            >
                {alreadyIn ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
        </div>
    );
}

/* ── Countdown hook ── */
function useCountdownText(isoTime) {
    const [text, setText] = useState('');
    useEffect(() => {
        if (!isoTime) return;
        const update = () => {
            const diff = new Date(isoTime) - new Date();
            if (diff <= 0) { setText('now'); return; }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            if (days > 0) setText(`${days}d ${hours}h`);
            else if (hours > 0) setText(`${hours}h ${mins}m`);
            else setText(`${mins}m`);
        };
        update();
        const t = setInterval(update, 60000);
        return () => clearInterval(t);
    }, [isoTime]);
    return text;
}

/* ── Main Squad Builder ── */
export default function SquadBuilder() {
    const queryClient = useQueryClient();

    // State
    const [phase, setPhase] = useState('GROUP_MD1');
    const [starters, setStarters] = useState([]);
    const [benchPlayers, setBench] = useState([]);
    const [captainId, setCaptainId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [posFilter, setPosFilter] = useState('ALL');
    const [teamFilter, setTeamFilter] = useState('ALL');
    const [saving, setSaving] = useState(false);
    const [showConfirmFinalize, setShowConfirmFinalize] = useState(false);
    const [existingSquadId, setExistingSquadId] = useState(null);
    const [initialized, setInitialized] = useState(false);
    // Phase lock state
    const [phaseLock, setPhaseLock] = useState(null); // { is_locked, lock_time }
    const [lockLoading, setLockLoading] = useState(false);

    // Data queries
    const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
    const { data: allPlayers = [] } = useQuery({ queryKey: ['allPlayers'], queryFn: () => base44.entities.Player.list() });
    const { data: allTeams = [] } = useQuery({ queryKey: ['allTeams'], queryFn: () => base44.entities.Team.list() });

    const { data: existingSquads = [] } = useQuery({
        queryKey: ['userSquads', currentUser?.id],
        queryFn: () => base44.entities.FantasySquad.filter({ user_id: currentUser.id }),
        enabled: !!currentUser
    });

    const playersMap = useMemo(() => Object.fromEntries(allPlayers.map(p => [p.id, p])), [allPlayers]);
    const teamsMap = useMemo(() => Object.fromEntries(allTeams.map(t => [t.id, t])), [allTeams]);

    // Fetch phase lock whenever phase changes
    useEffect(() => {
        setLockLoading(true);
        setPhaseLock(null);
        base44.functions.invoke('fantasyTransferService', {
            action: 'check_phase_lock',
            target_phase: phase
        }).then(res => {
            setPhaseLock(res.data);
        }).finally(() => setLockLoading(false));
    }, [phase]);

    // Load existing squad for selected phase
    useEffect(() => {
        if (initialized) return;
        // Wait until we know the lock status and squads are loaded
        if (lockLoading || phaseLock === null) return;

        const existing = existingSquads.find(s => s.phase === phase);
        if (existing) {
            setExistingSquadId(existing.id);
            base44.entities.FantasySquadPlayer.filter({ squad_id: existing.id }).then(players => {
                const starterList = players.filter(sp => sp.slot_type === 'STARTER').map(sp => ({
                    player_id: sp.player_id,
                    position: playersMap[sp.player_id]?.position || sp.starter_position
                }));
                const benchList = players.filter(sp => sp.slot_type === 'BENCH')
                    .sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0))
                    .map(sp => sp.player_id);
                const cap = players.find(sp => sp.is_captain);
                setStarters(starterList);
                setBench(benchList);
                if (cap) setCaptainId(cap.player_id);
                setInitialized(true);
            });
        } else {
            setExistingSquadId(null);
            setStarters([]);
            setBench([]);
            setCaptainId(null);
            setInitialized(true);
        }
    }, [existingSquads, phase, playersMap, initialized, lockLoading, phaseLock]);

    // Reset when phase changes
    const handlePhaseChange = (newPhase) => {
        setPhase(newPhase);
        setInitialized(false);
        setStarters([]);
        setBench([]);
        setCaptainId(null);
        setExistingSquadId(null);
        setPhaseLock(null);
    };

    // Computed
    const squadPlayerIds = useMemo(() => {
        const ids = new Set(starters.map(s => s.player_id));
        benchPlayers.forEach(id => ids.add(id));
        return ids;
    }, [starters, benchPlayers]);

    const totalCost = useMemo(() => {
        let cost = 0;
        for (const s of starters) { cost += playersMap[s.player_id]?.price || 0; }
        for (const id of benchPlayers) { cost += playersMap[id]?.price || 0; }
        return cost;
    }, [starters, benchPlayers, playersMap]);

    const remainingBudget = BUDGET_CAP - totalCost;

    const positionCounts = useMemo(() => {
        const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const s of starters) {
            const pos = playersMap[s.player_id]?.position || s.position;
            if (counts[pos] !== undefined) counts[pos]++;
        }
        return counts;
    }, [starters, playersMap]);

    const positionNeeds = useMemo(() => {
        const needs = {};
        for (const [pos, required] of Object.entries(FORMATION)) {
            const have = positionCounts[pos] || 0;
            if (have < required) needs[pos] = required - have;
        }
        return needs;
    }, [positionCounts]);

    const nextNeededPosition = Object.keys(positionNeeds)[0] || null;
    const startersComplete = starters.length === TOTAL_STARTERS;
    const benchComplete = benchPlayers.length === BENCH_SIZE;
    const hasCaptain = captainId !== null;
    const isSquadComplete = startersComplete && benchComplete && hasCaptain;

    const existingSquadForPhase = existingSquads.find(s => s.phase === phase);
    const hasFinalSquad = existingSquadForPhase?.status === 'FINAL';
    const isPhaseLocked = phaseLock?.is_locked === true;
    // View-only if locked (regardless of squad status) OR if no phase lock data yet
    const isViewOnly = hasFinalSquad && isPhaseLocked;
    // Allow editing a FINAL squad if phase is NOT locked
    const isEditable = hasFinalSquad && !isPhaseLocked;
    // For backwards compat: disable pool/slots when truly view-only
    const isFinalized = isViewOnly;

    // Smart auto-filter: show the position you need next
    useEffect(() => {
        if (!startersComplete && nextNeededPosition && posFilter === 'ALL') {
            setPosFilter(nextNeededPosition);
        }
        if (startersComplete && !benchComplete && posFilter !== 'ALL') {
            setPosFilter('ALL');
        }
    }, [startersComplete, nextNeededPosition, benchComplete]);

    // Filtered player pool
    const filteredPlayers = useMemo(() => {
        let pool = allPlayers.filter(p => p.is_active !== false);

        if (posFilter !== 'ALL') pool = pool.filter(p => p.position === posFilter);
        if (teamFilter !== 'ALL') pool = pool.filter(p => p.team_id === teamFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            pool = pool.filter(p =>
                p.full_name?.toLowerCase().includes(q) ||
                teamsMap[p.team_id]?.name?.toLowerCase().includes(q) ||
                teamsMap[p.team_id]?.fifa_code?.toLowerCase().includes(q)
            );
        }

        pool.sort((a, b) => (b.price || 0) - (a.price || 0));
        return pool;
    }, [allPlayers, posFilter, teamFilter, searchQuery, teamsMap]);

    // Add player
    const handleAddPlayer = useCallback((player) => {
        if (squadPlayerIds.has(player.id)) return;
        if (player.price > remainingBudget) { toast.error("Can't afford this player"); return; }

        const pos = player.position;

        // Try starter first
        if (!startersComplete && (positionCounts[pos] || 0) < FORMATION[pos]) {
            setStarters(prev => [...prev, { player_id: player.id, position: pos }]);
            // Auto-advance position filter
            const newCounts = { ...positionCounts, [pos]: (positionCounts[pos] || 0) + 1 };
            const nextPos = Object.entries(FORMATION).find(([p, req]) => (newCounts[p] || 0) < req);
            if (nextPos) setPosFilter(nextPos[0]);
            return;
        }

        // Try bench
        if (!benchComplete) {
            setBench(prev => [...prev, player.id]);
            if (benchPlayers.length + 1 >= BENCH_SIZE) {
                setPosFilter('ALL');
            }
            return;
        }

        toast.error('Squad is full (11 starters + 3 bench)');
    }, [squadPlayerIds, remainingBudget, startersComplete, benchComplete, positionCounts, benchPlayers.length]);

    // Remove player
    const handleRemovePlayer = useCallback((playerId) => {
        if (captainId === playerId) setCaptainId(null);
        setStarters(prev => prev.filter(s => s.player_id !== playerId));
        setBench(prev => prev.filter(id => id !== playerId));
    }, [captainId]);

    // Set captain
    const handleSetCaptain = useCallback((playerId) => {
        setCaptainId(playerId);
        toast.success('Captain set!');
    }, []);

    // Finalize squad
    const handleFinalize = async () => {
        setSaving(true);
        try {
            let squadId = existingSquadId;

            // Step 1: Get or create squad record
            if (!squadId) {
                const createRes = await base44.functions.invoke('fantasyService', {
                    action: 'create_squad',
                    phase,
                    budget_cap: BUDGET_CAP
                });
                if (createRes.data?.error) {
                    if (createRes.data.existing_squad) {
                        squadId = createRes.data.existing_squad.id;
                    } else {
                        throw new Error(createRes.data.error);
                    }
                } else {
                    squadId = createRes.data.squad.id;
                }
            }

            // Step 2: Clear ALL existing squad players for THIS squad only
            const existingPlayers = await base44.entities.FantasySquadPlayer.filter({ squad_id: squadId });
            for (const sp of existingPlayers) {
                await base44.entities.FantasySquadPlayer.delete(sp.id);
            }

            // Step 3: Add all starters
            for (const starter of starters) {
                await base44.functions.invoke('fantasyService', {
                    action: 'add_player_to_squad',
                    squad_id: squadId,
                    player_id: starter.player_id,
                    slot_type: 'STARTER',
                    starter_position: starter.position
                });
            }

            // Step 4: Add bench with bench_order
            for (let i = 0; i < benchPlayers.length; i++) {
                const spResult = await base44.functions.invoke('fantasyService', {
                    action: 'add_player_to_squad',
                    squad_id: squadId,
                    player_id: benchPlayers[i],
                    slot_type: 'BENCH'
                });
                if (spResult.data?.squad_player?.id) {
                    await base44.entities.FantasySquadPlayer.update(spResult.data.squad_player.id, {
                        bench_order: i + 1
                    });
                }
            }

            // Step 5: Set captain
            if (captainId) {
                await base44.functions.invoke('squadCaptainService', {
                    action: 'set_captain',
                    squad_id: squadId,
                    player_id: captainId
                });
            }

            // Step 6: Mark squad as FINAL (reuse existing or finalize fresh)
            if (isEditable) {
                // Re-finalize existing squad record with updated timestamp
                await base44.entities.FantasySquad.update(squadId, {
                    status: 'FINAL',
                    finalized_at: new Date().toISOString(),
                    total_cost: totalCost
                });
            } else {
                await base44.functions.invoke('fantasyService', {
                    action: 'finalize_squad',
                    squad_id: squadId
                });
            }

            toast.success(isEditable ? 'Squad updated! ✓' : 'Squad finalized! 🎉');
            setExistingSquadId(squadId);
            queryClient.invalidateQueries(['userSquads']);
            setShowConfirmFinalize(false);

        } catch (error) {
            toast.error(error.message || 'Failed to save squad');
        } finally {
            setSaving(false);
        }
    };

    // Countdown to lock
    const lockCountdown = useCountdownText(phaseLock?.lock_time);

    // Loading
    if (!allPlayers.length || !allTeams.length) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: CU.orange }} />
            </div>
        );
    }

    return (
        <>
            <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28">
                <WorldCupBanner compact />

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: CU.charcoal }}>
                            🏟️ Squad Builder
                        </h1>
                        <p style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280', marginTop: '4px' }}>
                            Pick 11 starters + 3 bench · Budget: ${BUDGET_CAP}M · Formation: 4-3-3
                        </p>
                    </div>
                    <Select value={phase} onValueChange={handlePhaseChange}>
                        <SelectTrigger className="w-[220px]" style={{ fontFamily: "'Raleway', sans-serif" }}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PHASE_OPTIONS.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Finalized banner */}
                {isFinalized && (
                    <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl"
                         style={{ background: CU.green + '10', border: `1px solid ${CU.green}30` }}>
                        <Check className="w-5 h-5" style={{ color: CU.green }} />
                        <span style={{ fontFamily: "'Raleway', sans-serif", color: CU.green, fontWeight: 600 }}>
                            Squad finalized for this phase
                        </span>
                    </div>
                )}

                {/* Budget + Formation status bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {/* Budget */}
                    <div className="rounded-xl p-3" style={{ background: 'white', border: '1px solid #e5e7eb', borderTop: `3px solid ${remainingBudget < 10 ? CU.orangeRed : CU.orange}` }}>
                        <div className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>Budget</div>
                        <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            ${totalCost}M <span className="text-sm font-normal" style={{ color: '#9ca3af' }}>/ ${BUDGET_CAP}M</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                                width: `${Math.min(100, (totalCost / BUDGET_CAP) * 100)}%`,
                                background: totalCost > BUDGET_CAP ? '#ef4444' : totalCost > BUDGET_CAP * 0.85 ? CU.orangeRed : CU.orange
                            }} />
                        </div>
                    </div>

                    {/* Formation slots */}
                    {Object.entries(FORMATION).map(([pos, required]) => {
                        const have = positionCounts[pos] || 0;
                        const ps = POS_STYLE[pos];
                        const complete = have >= required;
                        return (
                            <div key={pos} className="rounded-xl p-3" style={{
                                background: 'white', border: '1px solid #e5e7eb',
                                borderTop: `3px solid ${complete ? CU.green : ps.color}`
                            }}>
                                <div className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>{pos}</div>
                                <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: complete ? CU.green : CU.charcoal }}>
                                    {have}/{required} {complete && <Check className="inline w-4 h-4" />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Two panel layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* LEFT: My Squad */}
                    <div className="space-y-4">
                        {/* Starters */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <span className="font-semibold flex items-center gap-2" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                                    <Users className="w-4 h-4" style={{ color: CU.blue }} /> Starting XI
                                </span>
                                <span className="text-xs font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: startersComplete ? CU.green : '#9ca3af' }}>
                                    {starters.length}/{TOTAL_STARTERS}
                                </span>
                            </div>
                            <div className="p-3 space-y-2">
                                {/* Render by position group */}
                                {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
                                    const posStarters = starters.filter(s => (playersMap[s.player_id]?.position || s.position) === pos);
                                    const slots = [];
                                    for (let i = 0; i < FORMATION[pos]; i++) {
                                        const starter = posStarters[i];
                                        const player = starter ? playersMap[starter.player_id] : null;
                                        const team = player ? teamsMap[player.team_id] : null;
                                        slots.push(
                                            <FormationSlot
                                                key={`${pos}-${i}`}
                                                position={pos}
                                                player={player}
                                                team={team}
                                                isCaptain={player && captainId === player.id}
                                                onRemove={handleRemovePlayer}
                                                onSetCaptain={handleSetCaptain}
                                                disabled={isFinalized}
                                            />
                                        );
                                    }
                                    return <div key={pos} className="space-y-1.5">{slots}</div>;
                                })}
                            </div>
                        </div>

                        {/* Bench */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <span className="font-semibold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                                    Bench
                                </span>
                                <span className="text-xs font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: benchComplete ? CU.green : '#9ca3af' }}>
                                    {benchPlayers.length}/{BENCH_SIZE}
                                </span>
                            </div>
                            <div className="p-3 space-y-2">
                                {[0, 1, 2].map(i => {
                                    const playerId = benchPlayers[i];
                                    const player = playerId ? playersMap[playerId] : null;
                                    const team = player ? teamsMap[player.team_id] : null;
                                    if (!player) {
                                        return (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed"
                                                 style={{ borderColor: '#d1d5db40', background: '#f9fafb', minHeight: 48 }}>
                                                <span className="text-sm" style={{ color: '#d1d5db', fontFamily: "'Raleway', sans-serif" }}>
                                                    Bench slot {i + 1}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border" style={{ borderColor: '#e5e7eb' }}>
                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                                                  style={{ background: '#f3f4f6', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>{i + 1}</span>
                                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                  style={{ background: POS_STYLE[player.position]?.bg, color: POS_STYLE[player.position]?.color, fontFamily: "'Raleway', sans-serif" }}>
                                                {player.position}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>{player.full_name}</div>
                                            </div>
                                            <span className="text-xs" style={{ color: '#9ca3af' }}>${player.price}M</span>
                                            {!isFinalized && (
                                                <button onClick={() => handleRemovePlayer(playerId)} className="p-1 rounded hover:bg-red-50">
                                                    <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Captain reminder */}
                        {startersComplete && !hasCaptain && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                                 style={{ background: CU.orange + '10', border: `1px solid ${CU.orange}30` }}>
                                <Star className="w-5 h-5" style={{ color: CU.orange }} />
                                <span className="text-sm font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: '#9a6e00' }}>
                                    Tap the ☆ next to a starter to set your Captain (2× points)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Player Pool */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                        {/* Pool header */}
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                                    Player Pool
                                </span>
                                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                    {filteredPlayers.length} players
                                </span>
                            </div>

                            {/* Search */}
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search players or teams..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                    style={{ fontFamily: "'Raleway', sans-serif" }}
                                />
                            </div>

                            {/* Position filter pills */}
                            <div className="flex gap-1.5 flex-wrap">
                                {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(pos => {
                                    const active = posFilter === pos;
                                    const ps = pos !== 'ALL' ? POS_STYLE[pos] : null;
                                    const need = pos !== 'ALL' ? (FORMATION[pos] - (positionCounts[pos] || 0)) : null;
                                    return (
                                        <button
                                            key={pos}
                                            onClick={() => setPosFilter(pos)}
                                            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                                            style={{
                                                fontFamily: "'Raleway', sans-serif",
                                                background: active ? (ps?.color || CU.charcoal) : '#f3f4f6',
                                                color: active ? 'white' : (ps?.color || '#6b7280'),
                                                border: active ? 'none' : `1px solid #e5e7eb`
                                            }}
                                        >
                                            {pos === 'ALL' ? 'All' : pos}
                                            {need != null && need > 0 && !active && (
                                                <span className="ml-1 text-xs opacity-60">({need})</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Player list */}
                        <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                            {filteredPlayers.length === 0 ? (
                                <div className="p-8 text-center text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                    No players match your filters
                                </div>
                            ) : (
                                filteredPlayers.map(player => (
                                    <PoolPlayer
                                        key={player.id}
                                        player={player}
                                        team={teamsMap[player.team_id]}
                                        onAdd={handleAddPlayer}
                                        disabled={isFinalized}
                                        alreadyIn={squadPlayerIds.has(player.id)}
                                        cantAfford={player.price > remainingBudget && !squadPlayerIds.has(player.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Finalize Bar */}
            {isSquadComplete && !isFinalized && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-3">
                        <button
                            onClick={() => setShowConfirmFinalize(true)}
                            className="w-full h-14 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: CU.magenta, fontFamily: "'Raleway', sans-serif", cursor: 'pointer' }}
                        >
                            <Check className="w-5 h-5" />
                            Finalize Squad · {starters.length} starters · {benchPlayers.length} bench · Captain: {playersMap[captainId]?.full_name || '—'}
                        </button>
                    </div>
                </div>
            )}

            {/* Not-ready indicator */}
            {!isSquadComplete && !isFinalized && (starters.length > 0 || benchPlayers.length > 0) && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-3">
                        <div className="w-full h-12 rounded-xl flex items-center justify-center gap-3 text-sm"
                             style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif", color: 'white' }}>
                            {!startersComplete && <span>⚽ {starters.length}/{TOTAL_STARTERS} starters</span>}
                            {startersComplete && !benchComplete && <span>📋 {benchPlayers.length}/{BENCH_SIZE} bench</span>}
                            {startersComplete && benchComplete && !hasCaptain && <span>⭐ Select a captain</span>}
                            <span style={{ color: CU.orange }}>· ${remainingBudget}M remaining</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm finalize dialog */}
            <Dialog open={showConfirmFinalize} onOpenChange={setShowConfirmFinalize}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>Finalize Your Squad?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3" style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.875rem' }}>
                        <p>This will lock your squad for <strong>{PHASE_OPTIONS.find(p => p.value === phase)?.label}</strong>.</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-gray-50"><strong>Starters:</strong> {starters.length}/11</div>
                            <div className="p-2 rounded bg-gray-50"><strong>Bench:</strong> {benchPlayers.length}/3</div>
                            <div className="p-2 rounded bg-gray-50"><strong>Budget:</strong> ${totalCost}M / ${BUDGET_CAP}M</div>
                            <div className="p-2 rounded" style={{ background: CU.orange + '10' }}>
                                <strong>Captain:</strong> {playersMap[captainId]?.full_name || '—'}
                            </div>
                        </div>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                            After finalizing, you won't be able to edit this squad (until the next transfer window).
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmFinalize(false)} disabled={saving}>Cancel</Button>
                        <Button
                            onClick={handleFinalize}
                            disabled={saving}
                            style={{ background: CU.magenta, color: 'white', fontFamily: "'Raleway', sans-serif", fontWeight: 700 }}
                        >
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Finalize Squad ✓'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}