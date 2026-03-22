import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Lock, Loader2, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/* ── CookUnity Brand Tokens ─────────────────────────────── */
const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    orangeRed: '#F96F15',
    green: '#218848',
    pink: '#DB1984',
    sage: '#B8CDC2',
    sand: '#C7B273',
};

const PHASE_LABELS = {
    GROUP_MD1: 'Group Stage — Matchday 1',
    GROUP_MD2: 'Group Stage — Matchday 2',
    GROUP_MD3: 'Group Stage — Matchday 3',
    ROUND_OF_32: 'Round of 32',
    ROUND_OF_16: 'Round of 16',
    QUARTERFINALS: 'Quarterfinals',
    SEMIFINALS: 'Semifinals',
    FINAL: 'Final'
};

const PHASE_ORDER = ['GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];

/* ── Google Fonts loader ─────────────────────────────────── */
function FontLoader() {
    useEffect(() => {
        if (!document.getElementById('cu-fonts')) {
            const link = document.createElement('link');
            link.id = 'cu-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Raleway:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
    }, []);
    return null;
}

/* ── Score stepper component ─────────────────────────────── */
function ScoreStepper({ value, onChange, disabled }) {
    const numVal = value === '' || value === null || value === undefined ? null : Number(value);
    
    const decrement = () => {
        if (disabled) return;
        if (numVal === null || numVal <= 0) return;
        onChange(numVal - 1);
    };
    
    const increment = () => {
        if (disabled) return;
        if (numVal === null) { onChange(0); return; }
        if (numVal >= 15) return;
        onChange(numVal + 1);
    };

    return (
        <div className="flex items-center gap-0" style={{ opacity: disabled ? 0.4 : 1 }}>
            <button
                onClick={decrement}
                disabled={disabled || numVal === null || numVal <= 0}
                className="w-8 h-10 flex items-center justify-center rounded-l-lg text-lg font-bold transition-colors"
                style={{ 
                    background: disabled ? '#e5e7eb' : CU.charcoal, 
                    color: 'white',
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            >
                −
            </button>
            <div 
                className="w-12 h-10 flex items-center justify-center text-xl font-bold border-t border-b"
                style={{ 
                    fontFamily: "'DM Serif Display', serif",
                    borderColor: '#e5e7eb',
                    color: numVal !== null ? CU.charcoal : '#ccc',
                    background: 'white'
                }}
            >
                {numVal !== null ? numVal : '–'}
            </div>
            <button
                onClick={increment}
                disabled={disabled}
                className="w-8 h-10 flex items-center justify-center rounded-r-lg text-lg font-bold transition-colors"
                style={{ 
                    background: disabled ? '#e5e7eb' : CU.charcoal, 
                    color: 'white',
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            >
                +
            </button>
        </div>
    );
}

/* ── Match row component ─────────────────────────────────── */
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
    const hasLocal = localPrediction?.home !== '' && localPrediction?.away !== '' && 
                     localPrediction?.home !== null && localPrediction?.away !== null &&
                     localPrediction?.home !== undefined && localPrediction?.away !== undefined;
    
    const isChanged = hasLocal && hasSaved && 
        (Number(localPrediction.home) !== savedPrediction.pred_home_goals || 
         Number(localPrediction.away) !== savedPrediction.pred_away_goals);
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
        <div 
            className="rounded-xl border transition-all"
            style={{ 
                borderColor: showUnsaved ? CU.orange : hasSaved ? CU.green + '40' : '#e5e7eb',
                background: isFinal ? '#f9fafb' : showUnsaved ? CU.orange + '08' : hasSaved ? CU.green + '06' : 'white',
                borderWidth: showUnsaved ? '2px' : '1px'
            }}
        >
            {/* Date / Status bar */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {kickoff.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                    {showUnsaved && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" 
                              style={{ background: CU.orange + '20', color: CU.orangeRed, fontFamily: "'Raleway', sans-serif" }}>
                            Unsaved
                        </span>
                    )}
                    {isFinal && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500"
                              style={{ fontFamily: "'Raleway', sans-serif" }}>
                            Final
                        </span>
                    )}
                    {isLocked && !isFinal && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: CU.magenta, fontFamily: "'Raleway', sans-serif" }}>
                            <Lock className="w-3 h-3" /> Locked
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

            {/* Teams + Score */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                {/* Home team */}
                <div className="flex-1 text-right pr-2">
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {homeName}
                    </div>
                    <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        {homeFullName}
                    </div>
                </div>

                {/* Score input */}
                <div className="flex items-center gap-2 shrink-0">
                    <ScoreStepper
                        value={localPrediction?.home ?? ''}
                        onChange={v => onUpdate(match.id, 'home', v)}
                        disabled={isLocked}
                    />
                    <span className="text-xl font-light" style={{ color: '#d1d5db', fontFamily: "'DM Serif Display', serif" }}>×</span>
                    <ScoreStepper
                        value={localPrediction?.away ?? ''}
                        onChange={v => onUpdate(match.id, 'away', v)}
                        disabled={isLocked}
                    />
                </div>

                {/* Away team */}
                <div className="flex-1 pl-2">
                    <div className="text-lg font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        {awayName}
                    </div>
                    <div className="text-xs truncate" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        {awayFullName}
                    </div>
                </div>
            </div>

            {/* Locked prediction readout */}
            {isLocked && hasSaved && (
                <div className="px-4 pb-3 -mt-1 text-center text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                    Your prediction: {savedPrediction.pred_home_goals} – {savedPrediction.pred_away_goals}
                </div>
            )}
        </div>
    );
}

/* ── Main page ───────────────────────────────────────────── */
export default function ProdePredictions() {
    const [selectedPhase, setSelectedPhase] = useState(null);
    const [localEdits, setLocalEdits] = useState({});      // { match_id: { home: N, away: N } }
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: predictions = [] } = useQuery({
        queryKey: ['prodePredictions', currentUser?.id],
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

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const predictionsMap = Object.fromEntries(predictions.map(p => [p.match_id, p]));

    // Group matches by phase
    const phases = {};
    for (const match of matches) {
        if (!phases[match.phase]) phases[match.phase] = [];
        phases[match.phase].push(match);
    }
    for (const phase in phases) {
        phases[phase].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
    }

    const availablePhases = PHASE_ORDER.filter(p => phases[p]?.length > 0);

    // Auto-select first phase with upcoming matches
    useEffect(() => {
        if (!selectedPhase && availablePhases.length > 0) {
            const now = new Date();
            const upcoming = availablePhases.find(p =>
                phases[p].some(m => new Date(m.kickoff_at) > now)
            );
            setSelectedPhase(upcoming || availablePhases[0]);
        }
    }, [availablePhases.length]);

    // Initialize local edits from saved predictions when phase changes
    useEffect(() => {
        if (!selectedPhase || !phases[selectedPhase]) return;
        const initial = {};
        for (const match of phases[selectedPhase]) {
            const pred = predictionsMap[match.id];
            if (pred) {
                initial[match.id] = { home: pred.pred_home_goals, away: pred.pred_away_goals };
            }
        }
        setLocalEdits(initial);
    }, [selectedPhase, predictions.length]);

    const currentMatches = phases[selectedPhase] || [];
    const now = new Date();

    // Count unsaved changes
    const unsavedChanges = currentMatches.filter(match => {
        const local = localEdits[match.id];
        const saved = predictionsMap[match.id];
        if (!local || local.home === '' || local.home === null || local.home === undefined) return false;
        if (local.away === '' || local.away === null || local.away === undefined) return false;
        if (new Date(match.kickoff_at) <= now) return false; // locked
        if (!saved) return true; // new prediction
        return Number(local.home) !== saved.pred_home_goals || Number(local.away) !== saved.pred_away_goals;
    }).length;

    // Stats
    const totalMatches = matches.length;
    const predictedCount = predictions.length;
    const upcomingUnpredicted = matches.filter(m =>
        new Date(m.kickoff_at) > now && !predictionsMap[m.id]
    ).length;

    const handleUpdate = useCallback((matchId, side, value) => {
        setLocalEdits(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [side]: value
            }
        }));
    }, []);

    const handleSaveAll = async () => {
        setSaving(true);
        let saved = 0;
        let errors = 0;

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
                    action: 'submit_prediction',
                    match_id: match.id,
                    pred_home_goals: Number(local.home),
                    pred_away_goals: Number(local.away)
                });
                saved++;
            } catch (err) {
                errors++;
                console.error(`Failed to save prediction for match ${match.id}:`, err);
            }
        }

        if (saved > 0) {
            toast.success(`${saved} prediction${saved > 1 ? 's' : ''} saved!`);
        }
        if (errors > 0) {
            toast.error(`${errors} prediction${errors > 1 ? 's' : ''} failed to save`);
        }

        queryClient.invalidateQueries(['prodePredictions']);
        setSaving(false);
    };

    if (matchesLoading) {
        return (
            <div className="max-w-3xl mx-auto p-6 flex items-center gap-3" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading matches...
            </div>
        );
    }

    return (
        <>
            <FontLoader />
            <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-32" style={{ fontFamily: "'Raleway', sans-serif" }}>

                {/* ── Header ──────────────────────────────── */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: CU.orange }}>
                            <span className="text-xl">⚽</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                            Prode
                        </h1>
                    </div>
                    <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
                        Predict the score for each match. 
                        <span style={{ color: CU.green, fontWeight: 600 }}> Exact score = 5 pts</span> · 
                        <span style={{ color: CU.blue, fontWeight: 600 }}> Correct winner = 3 pts</span> · 
                        <span style={{ color: CU.magenta, fontWeight: 600 }}> MVP = 2 pts</span>
                    </p>
                </div>

                {/* ── Stats bar ────────────────────────────── */}
                <div className="flex gap-4 text-sm mb-5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" style={{ color: CU.green }} />
                        <span style={{ color: '#6b7280' }}>{predictedCount} predicted</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" style={{ color: CU.orange }} />
                        <span style={{ color: '#6b7280' }}>{upcomingUnpredicted} to go</span>
                    </div>
                    <span style={{ color: '#d1d5db' }}>{totalMatches} total</span>
                </div>

                {/* ── Phase selector ───────────────────────── */}
                {availablePhases.length > 0 ? (
                    <>
                        <Select value={selectedPhase || ''} onValueChange={(val) => { setSelectedPhase(val); setLocalEdits({}); }}>
                            <SelectTrigger 
                                className="w-full mb-5 h-12 text-base font-semibold rounded-xl border-2"
                                style={{ borderColor: CU.charcoal + '20', fontFamily: "'Raleway', sans-serif" }}
                            >
                                <SelectValue placeholder="Select phase" />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePhases.map(phase => {
                                    const phaseMatches = phases[phase] || [];
                                    const predicted = phaseMatches.filter(m => predictionsMap[m.id]).length;
                                    return (
                                        <SelectItem key={phase} value={phase}>
                                            {PHASE_LABELS[phase] || phase} ({predicted}/{phaseMatches.length})
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>

                        {/* ── Match list ───────────────────────── */}
                        <div className="space-y-3">
                            {currentMatches.map(match => {
                                const isLocked = new Date(match.kickoff_at) <= now || match.status === 'FINAL';
                                return (
                                    <MatchRow
                                        key={match.id}
                                        match={match}
                                        teams={teamsMap}
                                        localPrediction={localEdits[match.id]}
                                        savedPrediction={predictionsMap[match.id]}
                                        onUpdate={handleUpdate}
                                        isLocked={isLocked}
                                    />
                                );
                            })}
                            {currentMatches.length === 0 && (
                                <div className="text-center py-16" style={{ color: '#d1d5db' }}>
                                    No matches in this phase yet.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 rounded-2xl border" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
                        No matches scheduled yet. Check back soon!
                    </div>
                )}
            </div>

            {/* ── Sticky Save Bar ──────────────────────────── */}
            {unsavedChanges > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4 pt-3">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="w-full h-14 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{ 
                                background: saving ? '#9ca3af' : CU.magenta,
                                fontFamily: "'Raleway', sans-serif",
                                cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {saving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {saving 
                                ? 'Saving...' 
                                : `Save ${unsavedChanges} Prediction${unsavedChanges > 1 ? 's' : ''}`
                            }
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}