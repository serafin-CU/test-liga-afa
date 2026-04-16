import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Database, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminDataSync() {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showLog, setShowLog] = useState(false);

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