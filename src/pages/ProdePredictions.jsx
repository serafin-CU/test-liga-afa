import React, { useState, useEffect, useCallback, useRef } from 'react';
import WorldCupBanner from '@/components/WorldCupBanner';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Lock, Loader2, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    orangeRed: '#F96F15',
    green: '#218848',
};

// Group matches by their venue field (e.g. "Fecha 10", "Fecha 11")
// Falls back to phase label if venue is missing
function getMatchdayLabel(match) {
    if (match.venue && match.venue.startsWith('Fecha')) return match.venue;
    const phaseLabels = {
        APERTURA_ZONE: 'Apertura — Zona',
        APERTURA_R16: 'Octavos de Final',
        APERTURA_QF: 'Cuartos de Final',
        APERTURA_SF: 'Semifinales',
        APERTURA_FINAL: 'Final',
        GROUP_MD1: 'Fecha 1', GROUP_MD2: 'Fecha 2', GROUP_MD3: 'Fecha 3',
        ROUND_OF_16: 'Round of 16', QUARTERFINALS: 'QF', SEMIFINALS: 'SF', FINAL: 'Final',
    };
    return phaseLabels[match.phase] || match.phase;
}

function ScoreStepper({ value, onChange, disabled }) {
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const inputRef = useRef(null);

    const numVal = value === '' || value === null || value === undefined ? null : Number(value);

    const decrement = () => { if (!disabled && numVal !== null && numVal > 0) onChange(numVal - 1); };
    const increment = () => { if (!disabled) onChange(numVal === null ? 0 : Math.min(15, numVal + 1)); };

    const startEditing = () => {
        if (disabled) return;
        setInputVal(numVal !== null ? String(numVal) : '');
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitEdit = () => {
        const parsed = parseInt(inputVal, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 15) onChange(parsed);
        else if (inputVal === '' && numVal === null) { /* keep null */ }
        setEditing(false);
    };

    return (
        <div className="flex items-center" style={{ opacity: disabled ? 0.4 : 1 }}>
            <button onClick={decrement} disabled={disabled || numVal === null || numVal <= 0}
                className="flex items-center justify-center rounded-l-lg text-lg font-bold"
                style={{ width: '44px', height: '44px', flexShrink: 0, ...(disabled ? { background: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed' } : { background: CU.charcoal, color: 'white', cursor: 'pointer' }) }}
                onMouseDown={e => e.preventDefault()}
                {...{ style: { width: '44px', height: '44px', flexShrink: 0, background: (disabled || numVal === null || numVal <= 0) ? '#e5e7eb' : CU.charcoal, color: (disabled || numVal === null || numVal <= 0) ? '#9ca3af' : 'white', cursor: (disabled || numVal === null || numVal <= 0) ? 'not-allowed' : 'pointer' } }}
                style={{ background: disabled ? '#e5e7eb' : CU.charcoal, color: 'white', cursor: disabled ? 'not-allowed' : 'pointer' }}>−</button>
            {editing ? (
                <input
                    ref={inputRef}
                    type="number" min={0} max={15}
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                    className="w-12 h-10 text-center text-xl font-bold border-t border-b outline-none"
                    style={{ fontFamily: "'DM Serif Display', serif", borderColor: CU.orange, color: CU.charcoal, background: 'white' }}
                />
            ) : (
                <div
                    onClick={startEditing}
                    className="w-12 h-10 flex items-center justify-center text-xl font-bold border-t border-b"
                    style={{ fontFamily: "'DM Serif Display', serif", borderColor: '#e5e7eb', color: numVal !== null ? CU.charcoal : '#ccc', background: 'white', cursor: disabled ? 'default' : 'text' }}
                    title={disabled ? '' : 'Click to type score'}>
                    {numVal !== null ? numVal : '–'}
                </div>
            )}
            <button onClick={increment} disabled={disabled}
                className="w-8 h-10 flex items-center justify-center rounded-r-lg text-lg font-bold"
                style={{ background: disabled ? '#e5e7eb' : CU.charcoal, color: 'white', cursor: disabled ? 'not-allowed' : 'pointer' }}>+</button>
        </div>
    );
}

function MatchRow({ match, teams, localPrediction, savedPrediction, onUpdate, isLocked }) {
    const homeTeam = teams[match.home_team_id];
    const awayTeam = teams[match.away_team_id];
    const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
    const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';
    const homeFullName = homeTeam?.name || '';
    const awayFullName = awayTeam?.name || '';
    const kickoff = new Date(match.kickoff_at);
    const isFinal = match.status === 'FINAL';

    const hasSaved = savedPrediction != null;
    const hasLocal = localPrediction?.home !== '' && localPrediction?.home !== null && localPrediction?.home !== undefined
        && localPrediction?.away !== '' && localPrediction?.away !== null && localPrediction?.away !== undefined;
    const isChanged = hasLocal && hasSaved &&
        (Number(localPrediction.home) !== savedPrediction.pred_home_goals || Number(localPrediction.away) !== savedPrediction.pred_away_goals);
    const isNew = hasLocal && !hasSaved;
    const showUnsaved = isChanged || isNew;

    const timeUntil = () => {
        const diff = kickoff - new Date();
        if (diff <= 0) return null;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    return (
        <div className="rounded-xl border transition-all"
            style={{
                borderColor: showUnsaved ? CU.orange : hasSaved ? CU.green + '40' : '#e5e7eb',
                background: isFinal ? '#f9fafb' : showUnsaved ? CU.orange + '08' : hasSaved ? CU.green + '06' : 'white',
                borderWidth: showUnsaved ? '2px' : '1px'
            }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {kickoff.toLocaleDateString('es-AR', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {kickoff.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                    {showUnsaved && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: CU.orange + '20', color: CU.orangeRed, fontFamily: "'Raleway', sans-serif" }}>
                            Sin guardar
                        </span>
                    )}
                    {isFinal && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500"
                            style={{ fontFamily: "'Raleway', sans-serif" }}>Final</span>
                    )}
                    {isLocked && !isFinal && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: CU.magenta, fontFamily: "'Raleway', sans-serif" }}>
                            <Lock className="w-3 h-3" /> Cerrado
                        </span>
                    )}
                    {!isLocked && timeUntil() && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                            <Clock className="w-3 h-3" /> {timeUntil()}
                        </span>
                    )}
                    {hasSaved && !showUnsaved && (
                        <CheckCircle className="w-4 h-4" style={{ color: CU.green }} />
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                <div className="flex-1 text-right pr-2">
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>{homeName}</div>
                    <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>{homeFullName}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <ScoreStepper value={localPrediction?.home ?? ''} onChange={v => onUpdate(match.id, 'home', v)} disabled={isLocked} />
                    <span className="text-xl font-light" style={{ color: '#d1d5db', fontFamily: "'DM Serif Display', serif" }}>×</span>
                    <ScoreStepper value={localPrediction?.away ?? ''} onChange={v => onUpdate(match.id, 'away', v)} disabled={isLocked} />
                </div>
                <div className="flex-1 pl-2">
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>{awayName}</div>
                    <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>{awayFullName}</div>
                </div>
            </div>

            {isLocked && hasSaved && (
                <div className="px-4 pb-3 -mt-1 text-center text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    Tu pronóstico: {savedPrediction.pred_home_goals} – {savedPrediction.pred_away_goals}
                </div>
            )}
        </div>
    );
}

export default function ProdePredictions() {
    const [selectedMatchday, setSelectedMatchday] = useState(null);
    const [localEdits, setLocalEdits] = useState({});
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
    const { data: matches = [], isLoading: matchesLoading } = useQuery({ queryKey: ['matches'], queryFn: () => base44.entities.Match.list() });
    const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
    const { data: predictions = [] } = useQuery({
        queryKey: ['prodePredictions', currentUser?.id],
        queryFn: async () => {
            if (!currentUser) return [];
            const result = await base44.functions.invoke('prodeService', { action: 'get_user_predictions', target_user_id: currentUser.id });
            return result.data?.predictions || [];
        },
        enabled: !!currentUser
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const predictionsMap = Object.fromEntries(predictions.map(p => [p.match_id, p]));

    // Group matches by matchday label (venue or phase)
    const matchdays = {};
    for (const match of matches) {
        const label = getMatchdayLabel(match);
        if (!matchdays[label]) matchdays[label] = [];
        matchdays[label].push(match);
    }
    // Sort matches within each matchday by kickoff
    for (const label in matchdays) {
        matchdays[label].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
    }
    // Sort matchday keys: put "Fecha N" in order, then others
    const sortedMatchdays = Object.keys(matchdays).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 999;
        const numB = parseInt(b.replace(/\D/g, '')) || 999;
        return numA - numB;
    });

    // Auto-select the first matchday with upcoming matches
    useEffect(() => {
        if (!selectedMatchday && sortedMatchdays.length > 0) {
            const now = new Date();
            const upcoming = sortedMatchdays.find(md => matchdays[md].some(m => new Date(m.kickoff_at) > now));
            setSelectedMatchday(upcoming || sortedMatchdays[0]);
        }
    }, [sortedMatchdays.length]);

    // Sync local edits from saved predictions when matchday or predictions change
    useEffect(() => {
        if (!selectedMatchday || !matchdays[selectedMatchday]) return;
        const initial = {};
        for (const match of matchdays[selectedMatchday]) {
            const pred = predictionsMap[match.id];
            if (pred) initial[match.id] = { home: pred.pred_home_goals, away: pred.pred_away_goals };
        }
        setLocalEdits(initial);
    }, [selectedMatchday, predictions.length]);

    const currentMatches = matchdays[selectedMatchday] || [];
    const now = new Date();

    const unsavedChanges = currentMatches.filter(match => {
        const local = localEdits[match.id];
        const saved = predictionsMap[match.id];
        if (!local || local.home === '' || local.home === null || local.home === undefined) return false;
        if (local.away === '' || local.away === null || local.away === undefined) return false;
        if (new Date(match.kickoff_at) <= now) return false;
        if (!saved) return true;
        return Number(local.home) !== saved.pred_home_goals || Number(local.away) !== saved.pred_away_goals;
    }).length;

    const totalMatches = matches.length;
    const predictedCount = predictions.length;
    const upcomingUnpredicted = matches.filter(m => new Date(m.kickoff_at) > now && !predictionsMap[m.id]).length;

    const handleUpdate = useCallback((matchId, side, value) => {
        setLocalEdits(prev => ({ ...prev, [matchId]: { ...prev[matchId], [side]: value } }));
    }, []);

    const handleSaveAll = async () => {
        setSaving(true);
        let saved = 0, errors = 0;
        for (const match of currentMatches) {
            const local = localEdits[match.id];
            const savedPred = predictionsMap[match.id];
            if (!local || local.home === '' || local.home === null || local.home === undefined) continue;
            if (local.away === '' || local.away === null || local.away === undefined) continue;
            if (new Date(match.kickoff_at) <= now) continue;
            const isNew = !savedPred;
            const isChanged = savedPred && (Number(local.home) !== savedPred.pred_home_goals || Number(local.away) !== savedPred.pred_away_goals);
            if (!isNew && !isChanged) continue;
            try {
                await base44.functions.invoke('prodeService', {
                    action: 'submit_prediction', match_id: match.id,
                    pred_home_goals: Number(local.home), pred_away_goals: Number(local.away)
                });
                saved++;
            } catch (err) {
                errors++;
                console.error(`Failed to save prediction for match ${match.id}:`, err);
            }
        }
        if (saved > 0) toast.success(`${saved} pronóstico${saved > 1 ? 's' : ''} guardado${saved > 1 ? 's' : ''}!`);
        if (errors > 0) toast.error(`${errors} pronóstico${errors > 1 ? 's' : ''} fallaron`);
        queryClient.invalidateQueries(['prodePredictions']);
        setSaving(false);
    };

    if (matchesLoading) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex items-center gap-3" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando partidos...
            </div>
        );
    }

    return (
        <>
            <div className="max-w-3xl mx-auto p-3 sm:p-6 pb-44" style={{ fontFamily: "'Raleway', sans-serif" }}>
                <WorldCupBanner compact />

                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.orange }}>
                            <span className="text-xl">⚽</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            Prode
                        </h1>
                    </div>
                    <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
                        Predecí el resultado de cada partido.
                        <span style={{ color: CU.green, fontWeight: 600 }}> Exacto = 5 pts</span> ·
                        <span style={{ color: CU.blue, fontWeight: 600 }}> Ganador = 3 pts</span>
                    </p>
                </div>

                {/* Stats bar */}
                <div className="flex gap-4 text-sm mb-5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" style={{ color: CU.green }} />
                        <span style={{ color: '#6b7280' }}>{predictedCount} pronosticados</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" style={{ color: CU.orange }} />
                        <span style={{ color: '#6b7280' }}>{upcomingUnpredicted} pendientes</span>
                    </div>
                    <span style={{ color: '#d1d5db' }}>{totalMatches} en total</span>
                </div>

                {sortedMatchdays.length > 0 ? (
                    <>
                        <Select value={selectedMatchday || ''} onValueChange={(val) => { setSelectedMatchday(val); setLocalEdits({}); }}>
                            <SelectTrigger className="w-full mb-5 h-12 text-base font-semibold rounded-xl border-2"
                                style={{ borderColor: CU.charcoal + '20', fontFamily: "'Raleway', sans-serif" }}>
                                <SelectValue placeholder="Seleccioná la fecha" />
                            </SelectTrigger>
                            <SelectContent>
                                {sortedMatchdays.map(md => {
                                    const mdMatches = matchdays[md] || [];
                                    const predicted = mdMatches.filter(m => predictionsMap[m.id]).length;
                                    return (
                                        <SelectItem key={md} value={md}>
                                            {md} ({predicted}/{mdMatches.length})
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>

                        <div className="space-y-3">
                            {currentMatches.map(match => {
                                // TEST MODE: Allow late predictions (7 day grace period)
                    const isLocked = match.status === 'FINAL' || new Date(match.kickoff_at).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now();
                                return (
                                    <MatchRow key={match.id} match={match} teams={teamsMap}
                                        localPrediction={localEdits[match.id]} savedPrediction={predictionsMap[match.id]}
                                        onUpdate={handleUpdate} isLocked={isLocked} />
                                );
                            })}
                            {currentMatches.length === 0 && (
                                <div className="text-center py-16" style={{ color: '#d1d5db' }}>No hay partidos en esta fecha.</div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
                        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No hay partidos cargados todavía.</p>
                        <p className="text-sm mt-1">Un administrador debe ejecutar "Seed Liga AFA Data" primero.</p>
                    </div>
                )}
            </div>

            {unsavedChanges > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)' }}>
                        <button onClick={handleSaveAll} disabled={saving}
                            className="w-full rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                            style={{ background: saving ? '#9ca3af' : CU.magenta, fontFamily: "'Raleway', sans-serif", cursor: saving ? 'not-allowed' : 'pointer', minHeight: '52px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {saving ? 'Guardando...' : `Guardar ${unsavedChanges} pronóstico${unsavedChanges > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}