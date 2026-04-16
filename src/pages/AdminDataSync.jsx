import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Database, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function AdminDataSync() {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showLog, setShowLog] = useState(false);

    const [cleaning, setCleaning] = useState(false);
    const [cleanResult, setCleanResult] = useState(null);
    const [cleanError, setCleanError] = useState(null);

    const handleCleanupSeeds = async () => {
        if (!window.confirm('This will delete all manually-seeded matches (no api_fixture_id), their predictions, and orphan teams (no api_team_id). Continue?')) return;

        setCleaning(true);
        setCleanResult(null);
        setCleanError(null);

        try {
            // Step 1: Find manual matches
            const allMatches = await base44.entities.Match.list();
            const manualMatches = allMatches.filter(m => !m.api_fixture_id);
            const manualMatchIds = new Set(manualMatches.map(m => m.id));

            // Step 2: Find predictions tied to those matches
            const allPredictions = await base44.entities.ProdePrediction.list();
            const linkedPredictions = allPredictions.filter(p => manualMatchIds.has(p.match_id));

            // Step 3: Delete predictions
            for (const pred of linkedPredictions) {
                await base44.entities.ProdePrediction.delete(pred.id);
            }

            // Step 4: Delete manual matches
            for (const match of manualMatches) {
                await base44.entities.Match.delete(match.id);
            }

            // Step 5: Find teams with no api_team_id
            const allTeams = await base44.entities.Team.list();
            const manualTeams = allTeams.filter(t => !t.api_team_id);

            // Step 6: Check if any remaining API matches reference those teams
            const remainingMatches = await base44.entities.Match.list();
            const referencedTeamIds = new Set([
                ...remainingMatches.map(m => m.home_team_id),
                ...remainingMatches.map(m => m.away_team_id),
            ]);

            const teamsToDelete = manualTeams.filter(t => !referencedTeamIds.has(t.id));
            const teamsSkipped = manualTeams.filter(t => referencedTeamIds.has(t.id));

            // Step 7: Delete safe teams
            for (const team of teamsToDelete) {
                await base44.entities.Team.delete(team.id);
            }

            setCleanResult({
                matchesDeleted: manualMatches.length,
                predictionsDeleted: linkedPredictions.length,
                teamsDeleted: teamsToDelete.length,
                teamsSkipped: teamsSkipped.map(t => t.name),
            });
        } catch (err) {
            setCleanError(err.message || 'Unknown error');
        } finally {
            setCleaning(false);
        }
    };

    const handleRebuild = async () => {
        if (!window.confirm('This will DELETE all Match, Team, Player, and Result data and re-import from API-Football.\n\nUser predictions, squad data, and points are preserved.\n\nContinue?')) return;

        setRunning(true);
        setResult(null);
        setError(null);

        try {
            const res = await base44.functions.invoke('rebuildFromApi', { action: 'full_rebuild' });
            setResult(res.data);
        } catch (err) {
            setError(err.message || 'Unknown error');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Database className="w-7 h-7 text-blue-500" />
                    Data Sync
                </h1>
                <p className="text-gray-500 mt-1">Rebuild fixture data from API-Football</p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Full Rebuild from API-Football</CardTitle>
                    <CardDescription>
                        Fetches all rounds of AFA Liga Profesional 2026 season. Creates teams, matches, and results for all finalized fixtures.
                        <br />
                        <span className="text-amber-600 font-medium">⚠ Deletes: Teams, Matches, Results, Stats, IngestionEvents.</span>
                        <br />
                        <span className="text-green-600 font-medium">✓ Preserves: User predictions, fantasy squads, points, badges.</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleRebuild}
                        disabled={running}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {running ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Rebuilding... (may take 1-2 min)</>
                        ) : (
                            <><RefreshCw className="w-4 h-4" /> Run Full Rebuild</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {running && (
                <Card className="mb-4 border-blue-200 bg-blue-50">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3 text-blue-700">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <div>
                                <div className="font-semibold">Rebuilding data...</div>
                                <div className="text-sm text-blue-600">Fetching up to 27 rounds from API-Football. Please wait.</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {error && (
                <Card className="mb-4 border-red-200 bg-red-50">
                    <CardContent className="pt-4">
                        <div className="flex items-start gap-3 text-red-700">
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Error</div>
                                <div className="text-sm">{error}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cleanup Manual Seeds */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Cleanup Manual Seeds</CardTitle>
                    <CardDescription>
                        Removes manually-seeded matches (no <code>api_fixture_id</code>), their linked predictions, and orphan teams (no <code>api_team_id</code>) that aren't referenced by any API fixture.
                        <br />
                        <span className="text-amber-600 font-medium">⚠ Deletes: Manual matches, linked predictions, orphan teams.</span>
                        <br />
                        <span className="text-green-600 font-medium">✓ Preserves: API-synced data, fantasy squads, points, badges.</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={handleCleanupSeeds}
                        disabled={cleaning}
                        variant="destructive"
                        className="gap-2"
                    >
                        {cleaning ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Cleaning up...</>
                        ) : (
                            <><Trash2 className="w-4 h-4" /> Run Cleanup</>
                        )}
                    </Button>

                    {cleanError && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Error</div>
                                <div className="text-sm">{cleanError}</div>
                            </div>
                        </div>
                    )}

                    {cleanResult && (
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                            <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                                <CheckCircle2 className="w-5 h-5" /> Cleanup Complete
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                {[
                                    { label: 'Matches Deleted', value: cleanResult.matchesDeleted },
                                    { label: 'Predictions Deleted', value: cleanResult.predictionsDeleted },
                                    { label: 'Teams Deleted', value: cleanResult.teamsDeleted },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-white rounded-lg p-3 text-center border border-green-100">
                                        <div className="text-2xl font-bold text-green-800">{stat.value}</div>
                                        <div className="text-xs text-green-600 mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            {cleanResult.teamsSkipped.length > 0 && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <span className="font-semibold">⚠ Teams skipped</span> (still referenced by API matches):{' '}
                                    {cleanResult.teamsSkipped.join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {result && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4">
                        <div className="flex items-start gap-3 text-green-700 mb-4">
                            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-lg">Rebuild Complete!</div>
                            </div>
                        </div>

                        {result.summary && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: 'Fixtures Fetched', value: result.summary.fixtures_fetched },
                                    { label: 'Teams Created', value: result.summary.teams_created },
                                    { label: 'Matches Created', value: result.summary.matches_created },
                                    { label: 'Results Created', value: result.summary.results_created },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-white rounded-lg p-3 text-center border border-green-100">
                                        <div className="text-2xl font-bold text-green-800">{stat.value ?? '—'}</div>
                                        <div className="text-xs text-green-600 mt-0.5">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.log && result.log.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setShowLog(!showLog)}
                                    className="flex items-center gap-1 text-sm text-green-700 font-medium mb-2"
                                >
                                    {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    {showLog ? 'Hide' : 'Show'} log ({result.log.length} entries)
                                </button>
                                {showLog && (
                                    <div className="bg-white border border-green-100 rounded-lg p-3 max-h-64 overflow-y-auto">
                                        {result.log.map((line, i) => (
                                            <div key={i} className="text-xs text-gray-600 font-mono py-0.5 border-b border-gray-50 last:border-0">
                                                {line}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}