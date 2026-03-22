import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Lock, Loader2, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

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

function PredictionCard({ match, teams, prediction, onSubmit, submitting }) {
    const [homeGoals, setHomeGoals] = useState(prediction?.pred_home_goals ?? '');
    const [awayGoals, setAwayGoals] = useState(prediction?.pred_away_goals ?? '');

    const homeTeam = teams[match.home_team_id];
    const awayTeam = teams[match.away_team_id];
    const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
    const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';

    const kickoff = new Date(match.kickoff_at);
    const now = new Date();
    const isLocked = now >= kickoff;
    const isFinal = match.status === 'FINAL';
    const hasPrediction = prediction != null;

    const canSubmit = !isLocked && homeGoals !== '' && awayGoals !== '' &&
        Number(homeGoals) >= 0 && Number(awayGoals) >= 0;

    const hasChanged = hasPrediction
        ? (Number(homeGoals) !== prediction.pred_home_goals || Number(awayGoals) !== prediction.pred_away_goals)
        : (homeGoals !== '' || awayGoals !== '');

    const handleSubmit = () => {
        onSubmit({
            match_id: match.id,
            pred_home_goals: Number(homeGoals),
            pred_away_goals: Number(awayGoals)
        });
    };

    const timeUntil = () => {
        const diff = kickoff - now;
        if (diff <= 0) return null;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <Card className={`transition-all ${isFinal ? 'border-gray-200 bg-gray-50' : hasPrediction ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
            <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-gray-500">
                        {kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {kickoff.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isFinal && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                Final
                            </span>
                        )}
                        {isLocked && !isFinal && (
                            <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                            </span>
                        )}
                        {!isLocked && timeUntil() && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {timeUntil()}
                            </span>
                        )}
                        {hasPrediction && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Home team */}
                    <div className="flex-1 text-right">
                        <div className="font-semibold text-sm">{homeName}</div>
                        <div className="text-xs text-gray-400">{homeTeam?.name || ''}</div>
                    </div>

                    {/* Score input */}
                    <div className="flex items-center gap-1.5">
                        <Input
                            type="number"
                            min="0"
                            max="20"
                            value={homeGoals}
                            onChange={e => setHomeGoals(e.target.value)}
                            disabled={isLocked}
                            className="w-12 h-10 text-center text-lg font-bold p-0"
                            placeholder="–"
                        />
                        <span className="text-gray-300 font-light text-lg">:</span>
                        <Input
                            type="number"
                            min="0"
                            max="20"
                            value={awayGoals}
                            onChange={e => setAwayGoals(e.target.value)}
                            disabled={isLocked}
                            className="w-12 h-10 text-center text-lg font-bold p-0"
                            placeholder="–"
                        />
                    </div>

                    {/* Away team */}
                    <div className="flex-1">
                        <div className="font-semibold text-sm">{awayName}</div>
                        <div className="text-xs text-gray-400">{awayTeam?.name || ''}</div>
                    </div>
                </div>

                {/* Submit button */}
                {!isLocked && hasChanged && (
                    <div className="mt-3 flex justify-center">
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={!canSubmit || submitting}
                            className="w-full max-w-[200px]"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : null}
                            {hasPrediction ? 'Update Prediction' : 'Submit Prediction'}
                        </Button>
                    </div>
                )}

                {/* Show submitted prediction if locked */}
                {isLocked && hasPrediction && (
                    <div className="mt-2 text-center text-xs text-gray-500">
                        Your prediction: {prediction.pred_home_goals} – {prediction.pred_away_goals}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function ProdePredictions() {
    const [selectedPhase, setSelectedPhase] = useState(null);
    const [submittingMatch, setSubmittingMatch] = useState(null);
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

    const { data: predictions = [], isLoading: predsLoading } = useQuery({
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
    // Sort matches within each phase by kickoff
    for (const phase in phases) {
        phases[phase].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
    }

    // Determine which phases exist
    const PHASE_ORDER = ['GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];
    const availablePhases = PHASE_ORDER.filter(p => phases[p]?.length > 0);

    // Auto-select: first phase with an unlockable match, or the first phase
    if (!selectedPhase && availablePhases.length > 0) {
        const now = new Date();
        const upcoming = availablePhases.find(p =>
            phases[p].some(m => new Date(m.kickoff_at) > now)
        );
        setSelectedPhase(upcoming || availablePhases[0]);
    }

    const currentMatches = phases[selectedPhase] || [];

    // Prediction counts
    const totalMatches = matches.length;
    const predictedCount = predictions.length;
    const now = new Date();
    const upcomingUnpredicted = matches.filter(m =>
        new Date(m.kickoff_at) > now && !predictionsMap[m.id]
    ).length;

    const handleSubmitPrediction = async (data) => {
        setSubmittingMatch(data.match_id);
        try {
            await base44.functions.invoke('prodeService', {
                action: 'submit_prediction',
                ...data
            });
            toast.success('Prediction saved!');
            queryClient.invalidateQueries(['prodePredictions']);
        } catch (error) {
            toast.error(error.message || 'Failed to save prediction');
        } finally {
            setSubmittingMatch(null);
        }
    };

    if (matchesLoading) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading matches...
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    Prode Predictions
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Predict the score for each match. Exact score = 5 pts, correct winner = 3 pts, correct MVP = 2 pts.
                </p>
            </div>

            {/* Stats bar */}
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-600">{predictedCount} predicted</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-600">{upcomingUnpredicted} to go</span>
                </div>
                <div className="text-gray-400">
                    {totalMatches} total matches
                </div>
            </div>

            {/* Phase selector */}
            {availablePhases.length > 0 ? (
                <>
                    <Select value={selectedPhase || ''} onValueChange={setSelectedPhase}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select phase" />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePhases.map(phase => {
                                const phaseMatches = phases[phase];
                                const predicted = phaseMatches.filter(m => predictionsMap[m.id]).length;
                                return (
                                    <SelectItem key={phase} value={phase}>
                                        {PHASE_LABELS[phase] || phase} ({predicted}/{phaseMatches.length})
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>

                    {/* Match cards */}
                    <div className="space-y-3">
                        {currentMatches.map(match => (
                            <PredictionCard
                                key={match.id}
                                match={match}
                                teams={teamsMap}
                                prediction={predictionsMap[match.id]}
                                onSubmit={handleSubmitPrediction}
                                submitting={submittingMatch === match.id}
                            />
                        ))}
                        {currentMatches.length === 0 && (
                            <div className="text-center text-gray-400 py-12">
                                No matches in this phase yet.
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <Card>
                    <CardContent className="pt-6 text-center text-gray-500">
                        No matches have been scheduled yet. Check back soon!
                    </CardContent>
                </Card>
            )}
        </div>
    );
}