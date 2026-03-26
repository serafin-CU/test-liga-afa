import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Plus, X, Check, Loader2, Star, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const CU = {
    orange: '#FFB81C', charcoal: '#2C2B2B', magenta: '#AA0061',
    blue: '#475CC7', green: '#218848', orangeRed: '#F96F15',
};

const POS_MAP = {
    GK:  { label: 'ARQ', color: '#3b82f6', bg: '#dbeafe' },
    DEF: { label: 'DEF', color: '#16a34a', bg: '#dcfce7' },
    MID: { label: 'VOL', color: '#ca8a04', bg: '#fef9c3' },
    FWD: { label: 'DEL', color: '#dc2626', bg: '#fecaca' },
};

const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
const BENCH_SIZE = 4; // 1 ARQ + 1 DEF + 1 VOL + 1 DEL
const BUDGET_CAP = 150;
const TOTAL_STARTERS = 11;

/* ═══════════════════════════════════════════════════
   PITCH SLOT — a positioned card on the pitch
   ═══════════════════════════════════════════════════ */
function PitchSlot({ position, player, team, isCaptain, onClick, onRemove, onSetCaptain, style }) {
    const pm = POS_MAP[position];
    
    if (!player) {
        return (
            <div onClick={onClick} className="absolute flex flex-col items-center cursor-pointer group" style={style}>
                <div className="w-12 h-14 sm:w-14 sm:h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all group-hover:scale-110"
                     style={{ borderColor: pm.color + '60', background: 'rgba(255,255,255,0.15)' }}>
                    <Plus className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </div>
                <span className="text-xs mt-0.5 font-bold" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Raleway', sans-serif", fontSize: '10px' }}>
                    {pm.label}
                </span>
            </div>
        );
    }

    const lastName = player.full_name?.split(',')[0] || player.full_name?.split(' ').pop() || '?';
    const shortName = lastName.length > 10 ? lastName.substring(0, 9) + '.' : lastName;

    return (
        <div className="absolute flex flex-col items-center group" style={style}>
            {/* Shirt / card */}
            <div className="relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg flex flex-col items-center justify-center shadow-md transition-all group-hover:scale-105"
                 style={{ background: isCaptain ? CU.orange : 'white', color: isCaptain ? 'white' : CU.charcoal }}>
                {/* Captain badge */}
                {isCaptain && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                         style={{ background: CU.magenta, color: 'white', fontSize: '9px' }}>C</div>
                )}
                {/* Remove button */}
                <button onClick={(e) => { e.stopPropagation(); onRemove(player.id); }}
                    className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: '#ef4444', color: 'white', fontSize: '8px' }}>
                    <X className="w-2.5 h-2.5" />
                </button>
                {/* Captain star */}
                {!isCaptain && (
                    <button onClick={(e) => { e.stopPropagation(); onSetCaptain(player.id); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: CU.orange, color: 'white' }}>
                        <Star className="w-2.5 h-2.5" />
                    </button>
                )}
                {/* Position badge */}
                <span className="text-xs font-bold rounded px-1" style={{ 
                    background: pm.bg, color: pm.color, fontSize: '9px', fontFamily: "'Raleway', sans-serif"
                }}>{pm.label}</span>
                {/* Price */}
                <span className="text-xs font-bold mt-0.5" style={{ fontSize: '11px', fontFamily: "'DM Serif Display', serif" }}>
                    ${player.price}M
                </span>
            </div>
            {/* Name label */}
            <span className="text-xs font-semibold mt-0.5 px-1 rounded text-center leading-tight"
                  style={{ color: 'white', fontFamily: "'Raleway', sans-serif", fontSize: '10px', textShadow: '0 1px 3px rgba(0,0,0,0.8)', maxWidth: '70px' }}>
                {shortName}
            </span>
            {/* Team */}
            <span className="text-center leading-tight" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '8px', fontFamily: "'Raleway', sans-serif" }}>
                {team?.fifa_code || ''}
            </span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   PITCH LAYOUT — the green field with positioned slots
   Formation: 4-3-3
   ═══════════════════════════════════════════════════ */
function PitchLayout({ starters, benchPlayers, captainId, playersMap, teamsMap, onClickSlot, onRemove, onSetCaptain }) {
    // Slot positions on the pitch (percentage-based for responsive)
    // Each slot: { pos, idx, top%, left% }
    const SLOTS = [
        // GK
        { pos: 'GK', idx: 0, top: '82%', left: '50%' },
        // DEF (4)
        { pos: 'DEF', idx: 0, top: '64%', left: '12%' },
        { pos: 'DEF', idx: 1, top: '64%', left: '35%' },
        { pos: 'DEF', idx: 2, top: '64%', left: '65%' },
        { pos: 'DEF', idx: 3, top: '64%', left: '88%' },
        // MID (3)
        { pos: 'MID', idx: 0, top: '42%', left: '20%' },
        { pos: 'MID', idx: 1, top: '38%', left: '50%' },
        { pos: 'MID', idx: 2, top: '42%', left: '80%' },
        // FWD (3)
        { pos: 'FWD', idx: 0, top: '16%', left: '20%' },
        { pos: 'FWD', idx: 1, top: '12%', left: '50%' },
        { pos: 'FWD', idx: 2, top: '16%', left: '80%' },
    ];

    // Map starters by position
    const startersByPos = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const s of starters) {
        const pos = playersMap[s.player_id]?.position || s.position;
        startersByPos[pos]?.push(s);
    }

    return (
        <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: '130%', background: 'linear-gradient(180deg, #1a6b30 0%, #1e7a38 30%, #22863e 50%, #1e7a38 70%, #1a6b30 100%)' }}>
            {/* Pitch lines */}
            <div className="absolute inset-0">
                {/* Border */}
                <div className="absolute" style={{ top: '3%', left: '4%', right: '4%', bottom: '3%', border: '2px solid rgba(255,255,255,0.25)', borderRadius: '4px' }} />
                {/* Center line */}
                <div className="absolute" style={{ top: '50%', left: '4%', right: '4%', height: '2px', background: 'rgba(255,255,255,0.2)' }} />
                {/* Center circle */}
                <div className="absolute" style={{ top: '50%', left: '50%', width: '18%', height: '14%', transform: 'translate(-50%, -50%)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '50%' }} />
                {/* Penalty area top */}
                <div className="absolute" style={{ top: '3%', left: '22%', right: '22%', height: '14%', borderBottom: '2px solid rgba(255,255,255,0.2)', borderLeft: '2px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)' }} />
                {/* Penalty area bottom */}
                <div className="absolute" style={{ bottom: '3%', left: '22%', right: '22%', height: '14%', borderTop: '2px solid rgba(255,255,255,0.2)', borderLeft: '2px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)' }} />
                {/* Goal area top */}
                <div className="absolute" style={{ top: '3%', left: '35%', right: '35%', height: '6%', borderBottom: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />
                {/* Goal area bottom */}
                <div className="absolute" style={{ bottom: '3%', left: '35%', right: '35%', height: '6%', borderTop: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />
            </div>

            {/* Formation label */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full"
                 style={{ background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '11px', fontFamily: "'Raleway', sans-serif", fontWeight: 700 }}>
                4-3-3
            </div>

            {/* Player slots */}
            {SLOTS.map((slot, i) => {
                const posStarters = startersByPos[slot.pos];
                const starter = posStarters[slot.idx];
                const player = starter ? playersMap[starter.player_id] : null;
                const team = player ? teamsMap[player.team_id] : null;

                return (
                    <PitchSlot
                        key={i}
                        position={slot.pos}
                        player={player}
                        team={team}
                        isCaptain={player && captainId === player.id}
                        onClick={() => onClickSlot(slot.pos)}
                        onRemove={onRemove}
                        onSetCaptain={onSetCaptain}
                        style={{ top: slot.top, left: slot.left, transform: 'translate(-50%, -50%)' }}
                    />
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   BENCH — horizontal row below pitch
   ═══════════════════════════════════════════════════ */
function BenchRow({ benchPlayers, playersMap, teamsMap, onRemove }) {
    const slots = ['ARQ', 'DEF', 'VOL', 'DEL'];
    return (
        <div className="mt-3">
            <div className="text-xs font-bold mb-2 text-center" style={{ color: '#6b7280', fontFamily: "'Raleway', sans-serif", letterSpacing: '0.05em' }}>
                SUPLENTES ({benchPlayers.length}/{BENCH_SIZE})
            </div>
            <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(i => {
                    const pid = benchPlayers[i];
                    const player = pid ? playersMap[pid] : null;
                    const team = player ? teamsMap[player.team_id] : null;
                    const pm = player ? POS_MAP[player.position] : null;

                    if (!player) {
                        return (
                            <div key={i} className="flex flex-col items-center py-2 rounded-lg border-2 border-dashed"
                                 style={{ borderColor: '#d1d5db40', background: '#f9fafb' }}>
                                <span className="text-xs" style={{ color: '#d1d5db', fontFamily: "'Raleway', sans-serif" }}>{slots[i]}</span>
                            </div>
                        );
                    }

                    const lastName = player.full_name?.split(',')[0] || player.full_name?.split(' ').pop() || '?';
                    return (
                        <div key={i} className="relative flex flex-col items-center py-1.5 rounded-lg group"
                             style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                            <button onClick={() => onRemove(pid)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                                style={{ background: '#ef4444', color: 'white' }}>
                                <X className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs font-bold px-1 rounded" style={{ background: pm?.bg, color: pm?.color, fontSize: '9px' }}>{pm?.label}</span>
                            <span className="text-xs font-semibold truncate w-full text-center px-1" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal, fontSize: '10px' }}>
                                {lastName.length > 8 ? lastName.substring(0, 7) + '.' : lastName}
                            </span>
                            <span className="text-xs" style={{ color: '#9ca3af', fontSize: '9px' }}>${player.price}M</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   PLAYER POOL — right panel list
   ═══════════════════════════════════════════════════ */
function PoolPlayer({ player, team, onAdd, disabled, alreadyIn, cantAfford }) {
    const pm = POS_MAP[player.position];
    const isDisabled = disabled || alreadyIn || cantAfford;
    const lastName = player.full_name?.split(',')[0] || player.full_name;

    return (
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
             style={{ borderBottom: '1px solid #f3f4f6', opacity: isDisabled ? 0.4 : 1 }}>
            <span className="w-6 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: pm.bg, color: pm.color, fontSize: '9px', fontFamily: "'Raleway', sans-serif" }}>{pm.label}</span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>{lastName}</div>
                <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>{team?.name || ''}</div>
            </div>
            <span className="text-xs font-bold shrink-0" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>${player.price}M</span>
            <button onClick={() => onAdd(player)} disabled={isDisabled}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: alreadyIn ? CU.green + '15' : isDisabled ? '#f3f4f6' : CU.magenta, color: alreadyIn ? CU.green : isDisabled ? '#d1d5db' : 'white', cursor: isDisabled ? 'default' : 'pointer' }}>
                {alreadyIn ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function SquadBuilder() {
    const queryClient = useQueryClient();

    const [phase] = useState('APERTURA_ZONE');
    const [starters, setStarters] = useState([]);
    const [benchPlayers, setBench] = useState([]);
    const [captainId, setCaptainId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [posFilter, setPosFilter] = useState('ALL');
    const [saving, setSaving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [existingSquadId, setExistingSquadId] = useState(null);

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

    // Load existing squad
    useEffect(() => {
        const existing = existingSquads.find(s => s.phase === phase);
        if (existing) {
            setExistingSquadId(existing.id);
            base44.entities.FantasySquadPlayer.filter({ squad_id: existing.id }).then(players => {
                setStarters(players.filter(sp => sp.slot_type === 'STARTER').map(sp => ({ player_id: sp.player_id, position: playersMap[sp.player_id]?.position || sp.starter_position })));
                setBench(players.filter(sp => sp.slot_type === 'BENCH').sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0)).map(sp => sp.player_id));
                const cap = players.find(sp => sp.is_captain);
                if (cap) setCaptainId(cap.player_id);
            });
        }
    }, [existingSquads, playersMap]);

    // Computed
    const squadPlayerIds = useMemo(() => {
        const ids = new Set(starters.map(s => s.player_id));
        benchPlayers.forEach(id => ids.add(id));
        return ids;
    }, [starters, benchPlayers]);

    const totalCost = useMemo(() => {
        let cost = 0;
        for (const s of starters) cost += playersMap[s.player_id]?.price || 0;
        for (const id of benchPlayers) cost += playersMap[id]?.price || 0;
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

    const startersComplete = starters.length === TOTAL_STARTERS;
    const benchComplete = benchPlayers.length === BENCH_SIZE;
    const hasCaptain = captainId !== null;
    const isSquadComplete = startersComplete && benchComplete && hasCaptain;

    // Auto-filter pool to the position you need
    const nextNeededPos = useMemo(() => {
        for (const [pos, req] of Object.entries(FORMATION)) {
            if ((positionCounts[pos] || 0) < req) return pos;
        }
        return null;
    }, [positionCounts]);

    // Which bench positions are still needed
    const neededBenchPositions = useMemo(() => {
        // Bench must have exactly 1 of each: GK, DEF, MID, FWD
        const covered = new Set(benchPlayers.map(id => playersMap[id]?.position).filter(Boolean));
        return ['GK', 'DEF', 'MID', 'FWD'].filter(pos => !covered.has(pos));
    }, [benchPlayers, playersMap]);

    // Player pool
    const filteredPlayers = useMemo(() => {
        let pool = allPlayers.filter(p => p.is_active !== false);

        // Position filter
        if (startersComplete) {
            // Bench mode: only show needed bench positions (or user's manual filter)
            const activeFilter = posFilter !== 'ALL' ? posFilter : null;
            if (activeFilter) {
                pool = pool.filter(p => p.position === activeFilter);
            } else {
                pool = pool.filter(p => neededBenchPositions.includes(p.position));
            }
        } else {
            const activeFilter = posFilter !== 'ALL' ? posFilter : nextNeededPos;
            if (activeFilter) pool = pool.filter(p => p.position === activeFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            pool = pool.filter(p => p.full_name?.toLowerCase().includes(q) || teamsMap[p.team_id]?.name?.toLowerCase().includes(q));
        }

        // In bench mode: sort affordable first, unaffordable greyed at bottom
        if (startersComplete) {
            const affordable = pool.filter(p => p.price <= remainingBudget || squadPlayerIds.has(p.id));
            const unaffordable = pool.filter(p => p.price > remainingBudget && !squadPlayerIds.has(p.id));
            affordable.sort((a, b) => (b.price || 0) - (a.price || 0));
            unaffordable.sort((a, b) => (b.price || 0) - (a.price || 0));
            return [...affordable, ...unaffordable];
        }

        pool.sort((a, b) => (b.price || 0) - (a.price || 0));
        return pool;
    }, [allPlayers, posFilter, searchQuery, teamsMap, nextNeededPos, startersComplete, remainingBudget, squadPlayerIds, neededBenchPositions]);

    // Add player
    const handleAddPlayer = useCallback((player) => {
        if (squadPlayerIds.has(player.id)) return;
        if (player.price > remainingBudget) { toast.error("Presupuesto insuficiente"); return; }
        const pos = player.position;

        if (!startersComplete && (positionCounts[pos] || 0) < FORMATION[pos]) {
            setStarters(prev => [...prev, { player_id: player.id, position: pos }]);
            return;
        }
        if (!benchComplete) {
            setBench(prev => [...prev, player.id]);
            return;
        }
        toast.error('Equipo completo (11 titulares + 4 suplentes)');
    }, [squadPlayerIds, remainingBudget, startersComplete, benchComplete, positionCounts]);

    const handleRemovePlayer = useCallback((playerId) => {
        if (captainId === playerId) setCaptainId(null);
        setStarters(prev => prev.filter(s => s.player_id !== playerId));
        setBench(prev => prev.filter(id => id !== playerId));
    }, [captainId]);

    const handleSetCaptain = useCallback((playerId) => {
        setCaptainId(playerId);
        toast.success('¡Capitán asignado!');
    }, []);

    const handleClickSlot = useCallback((pos) => {
        setPosFilter(pos);
    }, []);

    // Finalize
    const handleFinalize = async () => {
        setSaving(true);
        try {
            let squadId = existingSquadId;
            if (!squadId) {
                const res = await base44.functions.invoke('fantasyService', { action: 'create_squad', phase, budget_cap: BUDGET_CAP });
                if (res.data?.error && res.data.existing_squad) squadId = res.data.existing_squad.id;
                else squadId = res.data.squad.id;
            }

            const existing = await base44.entities.FantasySquadPlayer.filter({ squad_id: squadId });
            for (const sp of existing) await base44.entities.FantasySquadPlayer.delete(sp.id);

            for (const starter of starters) {
                await base44.functions.invoke('fantasyService', { action: 'add_player_to_squad', squad_id: squadId, player_id: starter.player_id, slot_type: 'STARTER', starter_position: starter.position });
            }
            for (let i = 0; i < benchPlayers.length; i++) {
                const res = await base44.functions.invoke('fantasyService', { action: 'add_player_to_squad', squad_id: squadId, player_id: benchPlayers[i], slot_type: 'BENCH' });
                if (res.data?.squad_player?.id) await base44.entities.FantasySquadPlayer.update(res.data.squad_player.id, { bench_order: i + 1 });
            }
            if (captainId) await base44.functions.invoke('squadCaptainService', { action: 'set_captain', squad_id: squadId, player_id: captainId });
            await base44.functions.invoke('fantasyService', { action: 'finalize_squad', squad_id: squadId });

            toast.success('¡Equipo guardado! 🎉');
            setExistingSquadId(squadId);
            setShowConfirm(false);
            queryClient.invalidateQueries(['userSquads']);
        } catch (error) {
            toast.error(error.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!allPlayers.length || !allTeams.length) {
        return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: CU.orange }} /></div>;
    }

    return (
        <>
            <div className="max-w-6xl mx-auto p-3 sm:p-5 pb-44">
                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>⚽ Armá tu equipo</h1>
                    <p className="text-sm mt-1" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                        11 titulares + 4 suplentes · Presupuesto: ${BUDGET_CAP}M · Formación: 4-3-3
                    </p>
                </div>

                {/* Captain reminder banner — prominent, at top */}
                {startersComplete && !hasCaptain && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
                         style={{ background: CU.orange, fontFamily: "'Raleway', sans-serif" }}>
                        <Star className="w-5 h-5 text-white shrink-0" />
                        <span className="text-sm font-bold text-white">
                            ¡No olvidés elegir capitán! Pasá el mouse sobre un titular y tocá ☆ (el capitán suma el doble de puntos)
                        </span>
                    </div>
                )}

                {/* Budget bar */}
                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: CU.charcoal }}>Presupuesto</span>
                            <span style={{ fontFamily: "'DM Serif Display', serif", color: remainingBudget < 10 ? CU.orangeRed : CU.charcoal }}>${totalCost}M / ${BUDGET_CAP}M</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (totalCost / BUDGET_CAP) * 100)}%`, background: totalCost > BUDGET_CAP ? '#ef4444' : CU.orange }} />
                        </div>
                    </div>
                    <div className="text-center px-3" style={{ borderLeft: '1px solid #e5e7eb' }}>
                        <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.green }}>{starters.length + benchPlayers.length}</div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>/{TOTAL_STARTERS + BENCH_SIZE}</div>
                    </div>
                </div>

                {/* Two columns: Pitch + Pool */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* LEFT: Pitch (3/5 width) */}
                    <div className="lg:col-span-3">
                        <PitchLayout
                            starters={starters}
                            benchPlayers={benchPlayers}
                            captainId={captainId}
                            playersMap={playersMap}
                            teamsMap={teamsMap}
                            onClickSlot={handleClickSlot}
                            onRemove={handleRemovePlayer}
                            onSetCaptain={handleSetCaptain}
                        />
                        <BenchRow benchPlayers={benchPlayers} playersMap={playersMap} teamsMap={teamsMap} onRemove={handleRemovePlayer} />


                    </div>

                    {/* RIGHT: Player pool (2/5 width) */}
                    <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', background: 'white' }}>
                        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #f3f4f6' }}>
                            {startersComplete && !benchComplete && (
                                <div className="mb-2.5 px-3 py-2 rounded-lg text-xs font-semibold"
                                     style={{ background: CU.blue + '12', border: `1px solid ${CU.blue}30`, color: CU.blue, fontFamily: "'Raleway', sans-serif", lineHeight: '1.4' }}>
                                    Elegí {neededBenchPositions.map(p => POS_MAP[p].label).join(', ')} para suplentes
                                    {' · '}
                                    <span style={{ fontWeight: 800 }}>${remainingBudget}M disponible</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>Jugadores</span>
                                <span className="text-xs" style={{ color: '#9ca3af' }}>{filteredPlayers.length}</span>
                            </div>
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <Input placeholder="Buscar jugador o equipo..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }} />
                            </div>
                            <div className="flex gap-1">
                                {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(pos => {
                                    const active = posFilter === pos;
                                    const pm = pos !== 'ALL' ? POS_MAP[pos] : null;
                                    const label = pos === 'ALL' ? 'Todos' : pm.label;
                                    return (
                                        <button key={pos} onClick={() => setPosFilter(pos)}
                                            className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                                            style={{ fontFamily: "'Raleway', sans-serif", background: active ? (pm?.color || CU.charcoal) : '#f3f4f6', color: active ? 'white' : (pm?.color || '#6b7280') }}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: 'min(600px, 50vh)' }}>
                            {filteredPlayers.length === 0 ? (
                                <div className="p-6 text-center text-sm" style={{ color: '#9ca3af' }}>No hay jugadores con ese filtro</div>
                            ) : filteredPlayers.map(player => (
                                <PoolPlayer key={player.id} player={player} team={teamsMap[player.team_id]} onAdd={handleAddPlayer}
                                    disabled={false} alreadyIn={squadPlayerIds.has(player.id)} cantAfford={player.price > remainingBudget && !squadPlayerIds.has(player.id)} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky finalize bar */}
            {isSquadComplete && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-6xl mx-auto px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)' }}>
                        <button onClick={() => setShowConfirm(true)}
                            className="w-full h-14 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
                            style={{ background: CU.magenta, fontFamily: "'Raleway', sans-serif" }}>
                            <Check className="w-5 h-5" /> Confirmar Equipo
                        </button>
                    </div>
                </div>
            )}

            {!isSquadComplete && (starters.length > 0 || benchPlayers.length > 0) && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-6xl mx-auto px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)' }}>
                        <div className="w-full h-11 rounded-xl flex items-center justify-center gap-3 text-sm"
                             style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif", color: 'white' }}>
                            {!startersComplete && <span>⚽ {starters.length}/{TOTAL_STARTERS} titulares</span>}
                            {startersComplete && !benchComplete && <span>📋 {benchPlayers.length}/{BENCH_SIZE} suplentes</span>}
                            {startersComplete && benchComplete && !hasCaptain && <span>⭐ Elegí un capitán</span>}
                            <span style={{ color: CU.orange }}>· ${remainingBudget}M disponible</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader><DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>¿Confirmar equipo?</DialogTitle></DialogHeader>
                    <div className="space-y-2 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        <p>Tu equipo quedará guardado para el <strong>Apertura — Fase de Zonas</strong>.</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-gray-50"><strong>Titulares:</strong> {starters.length}/11</div>
                            <div className="p-2 rounded bg-gray-50"><strong>Suplentes:</strong> {benchPlayers.length}/{BENCH_SIZE}</div>
                            <div className="p-2 rounded bg-gray-50"><strong>Presupuesto:</strong> ${totalCost}M</div>
                            <div className="p-2 rounded" style={{ background: CU.orange + '10' }}>
                                <strong>Capitán:</strong> {playersMap[captainId]?.full_name || '—'}
                            </div>
                        </div>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>Podés editar tu equipo hasta que se bloquee la fecha.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={handleFinalize} disabled={saving} style={{ background: CU.magenta, color: 'white', fontWeight: 700 }}>
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...</> : 'Confirmar ✓'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}