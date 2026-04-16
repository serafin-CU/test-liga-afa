import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, BarChart2, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    blue: '#475CC7',
    green: '#218848',
};

export default function ImportAFAData() {
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);

    const [checking, setChecking] = useState(false);
    const [statusResult, setStatusResult] = useState(null);
    const [checkError, setCheckError] = useState(null);

    const handleImport = async () => {
        if (!window.confirm('This will delete existing Match, Team, and Result data and re-import from API-Football.\n\nUser predictions, squads, and points are preserved.\n\nContinue?')) return;

        setImporting(true);
        setImportResult(null);
        setImportError(null);

        try {
            // Preview first
            await base44.functions.invoke('rebuildFromApi', { action: 'preview' });
            // Full rebuild
            const res = await base44.functions.invoke('rebuildFromApi', { action: 'full_rebuild' });
            setImportResult(res.data);
        } catch (err) {
            setImportError(err.message || 'Unknown error');
        } finally {
            setImporting(false);
        }
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        setStatusResult(null);
        setCheckError(null);

        try {
            const [teams, matches] = await Promise.all([
                base44.entities.Team.list(),
                base44.entities.Match.list(),
            ]);

            setStatusResult({
                totalTeams: teams.length,
                teamsWithApiId: teams.filter(t => t.api_team_id).length,
                teamsWithoutApiId: teams.filter(t => !t.api_team_id).length,
                totalMatches: matches.length,
                matchesWithApiId: matches.filter(m => m.api_fixture_id).length,
                matchesWithoutApiId: matches.filter(m => !m.api_fixture_id).length,
            });
        } catch (err) {
            setCheckError(err.message || 'Unknown error');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto" style={{ fontFamily: "'Raleway', sans-serif" }}>
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                    <Download className="w-7 h-7" style={{ color: CU.blue }} />
                    Import AFA Data
                </h1>
                <p className="mt-1" style={{ color: '#6b7280' }}>Import teams and fixtures from API-Football</p>
            </div>

            {/* Button 1: Import */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>Import Teams from API-Football</CardTitle>
                    <CardDescription>
                        Runs a preview check then performs a full rebuild of teams, matches, and finalized results from the 2026 AFA season.
                        <br />
                        <span className="font-medium" style={{ color: '#d97706' }}>⚠ Deletes: Teams, Matches, Results, Stats.</span>
                        <br />
                        <span className="font-medium" style={{ color: CU.green }}>✓ Preserves: Predictions, squads, points, badges.</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={handleImport}
                        disabled={importing}
                        className="gap-2 text-white"
                        style={{ background: importing ? '#9ca3af' : CU.blue, cursor: importing ? 'not-allowed' : 'pointer' }}
                    >
                        {importing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Importing... (may take 1–2 min)</>
                        ) : (
                            <><RefreshCw className="w-4 h-4" /> Import Teams from API-Football</>
                        )}
                    </Button>

                    {importError && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Error</div>
                                <div className="text-sm">{importError}</div>
                            </div>
                        </div>
                    )}

                    {importResult && (
                        <div className="p-4 rounded-lg border" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                            <div className="flex items-center gap-2 font-semibold mb-3" style={{ color: CU.green }}>
                                <CheckCircle2 className="w-5 h-5" /> Import Complete!
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Fixtures Fetched', value: importResult.summary?.fixtures_fetched },
                                    { label: 'Teams Created', value: importResult.summary?.teams_created },
                                    { label: 'Matches Created', value: importResult.summary?.matches_created },
                                    { label: 'Results Created', value: importResult.summary?.results_created },
                                ].map(stat => (
                                    <div key={stat.label} className="rounded-lg p-3 text-center border" style={{ background: 'white', borderColor: '#bbf7d0' }}>
                                        <div className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>{stat.value ?? '—'}</div>
                                        <div className="text-xs mt-0.5" style={{ color: '#16a34a' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Button 2: Check Status */}
            <Card>
                <CardHeader>
                    <CardTitle style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>Check Data Status</CardTitle>
                    <CardDescription>
                        Counts records in the database and identifies manually-seeded vs API-synced data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={handleCheckStatus}
                        disabled={checking}
                        variant="outline"
                        className="gap-2"
                        style={{ borderColor: CU.charcoal, color: CU.charcoal }}
                    >
                        {checking ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                        ) : (
                            <><BarChart2 className="w-4 h-4" /> Check Data Status</>
                        )}
                    </Button>

                    {checkError && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Error</div>
                                <div className="text-sm">{checkError}</div>
                            </div>
                        </div>
                    )}

                    {statusResult && (
                        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background: CU.charcoal, color: 'white' }}>
                                        <th className="px-4 py-2 text-left font-semibold">Entity</th>
                                        <th className="px-4 py-2 text-center font-semibold">Total</th>
                                        <th className="px-4 py-2 text-center font-semibold">With API ID</th>
                                        <th className="px-4 py-2 text-center font-semibold">Manual (no API ID)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td className="px-4 py-3 font-medium" style={{ color: CU.charcoal }}>Teams</td>
                                        <td className="px-4 py-3 text-center font-bold" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>{statusResult.totalTeams}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: CU.green + '20', color: CU.green }}>
                                                {statusResult.teamsWithApiId}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: statusResult.teamsWithoutApiId > 0 ? '#fef3c7' : '#f3f4f6', color: statusResult.teamsWithoutApiId > 0 ? '#d97706' : '#9ca3af' }}>
                                                {statusResult.teamsWithoutApiId}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium" style={{ color: CU.charcoal }}>Matches</td>
                                        <td className="px-4 py-3 text-center font-bold" style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>{statusResult.totalMatches}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: CU.green + '20', color: CU.green }}>
                                                {statusResult.matchesWithApiId}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: statusResult.matchesWithoutApiId > 0 ? '#fef3c7' : '#f3f4f6', color: statusResult.matchesWithoutApiId > 0 ? '#d97706' : '#9ca3af' }}>
                                                {statusResult.matchesWithoutApiId}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}