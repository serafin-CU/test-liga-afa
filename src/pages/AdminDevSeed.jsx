import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Trash2, Database, ArrowRight, AlertCircle, RotateCcw, Loader2, Shield } from 'lucide-react';

export default function AdminDevSeed() {
    const [seeding, setSeeding] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [hasDevSeed, setHasDevSeed] = useState(false);
    const [summary, setSummary] = useState(null);

    // Liga AFA Seed state
    const [ligaSeeding, setLigaSeeding] = useState(false);
    const [ligaSummary, setLigaSummary] = useState(null);
    const [seedingPromiedos, setSeedingPromiedos] = useState(false);
    const [promiedosSummary, setPromiedosSummary] = useState(null);

    useEffect(() => {
        checkDevSeed();
    }, []);

    const checkDevSeed = async () => {
        try {
            const teams = await base44.entities.Team.list();
            const hasDevData = teams.some(t => t.name && t.name.includes('[DEV-'));
            setHasDevSeed(hasDevData);
        } catch (error) {
            console.error('Failed to check dev seed:', error);
        }
    };

    const seedDevData = async () => {
        setSeeding(true);
        setSummary(null);
        
        try {
            const response = await base44.functions.invoke('devSeedService', {
                action: 'seed'
            });

            setSummary({
                success: response.data.success,
                message: response.data.message,
                counts: response.data.counts
            });

            if (response.data.success) {
                setHasDevSeed(true);
            }

        } catch (error) {
            setSummary({
                success: false,
                message: 'Seeding failed: ' + error.message,
                counts: { created: 0, reused: 0, skipped: 0 }
            });
        }

        setSeeding(false);
    };

    const deleteDevSeed = async () => {
        if (!hasDevSeed) {
            alert('No dev seed data to delete');
            return;
        }

        if (!confirm('Delete all dev seed data? This cannot be undone.')) {
            return;
        }

        setDeleting(true);
        setSummary(null);

        try {
            const response = await base44.functions.invoke('devSeedService', {
                action: 'delete'
            });

            setSummary({
                success: response.data.success,
                message: response.data.message,
                counts: response.data.counts
            });

            if (response.data.success) {
                setHasDevSeed(false);
            }

        } catch (error) {
            setSummary({
                success: false,
                message: 'Deletion failed: ' + error.message,
                counts: { deleted: 0 }
            });
        }

        setDeleting(false);
    };

    const resetTestData = async () => {
        if (!confirm('This will delete all scores, squads, badges, and match results. Predictions will be kept. Are you sure?')) {
            return;
        }

        setResetting(true);
        setSummary(null);

        try {
            const response = await base44.functions.invoke('wcSeedService', {
                action: 'reset_test_data'
            });

            setSummary({
                success: response.data.success,
                message: response.data.message,
                resetSummary: response.data.summary,
            });
        } catch (error) {
            setSummary({
                success: false,
                message: 'Reset failed: ' + error.message,
            });
        }

        setResetting(false);
    };

    const seedLigaAfa = async () => {
        if (!confirm('This will delete all existing teams, players and matches, and create 30 Liga AFA teams with 420 players and 30 matches. Continue?')) return;
        setLigaSeeding(true);
        setLigaSummary(null);
        try {
            const response = await base44.functions.invoke('ligaAfaSeedService', { action: 'seed_teams_and_matches' });
            setLigaSummary({ success: response.data.success, message: response.data.message, counts: response.data.counts });
        } catch (error) {
            setLigaSummary({ success: false, message: 'Seed failed: ' + error.message });
        }
        setLigaSeeding(false);
    };

    const seedPromiedos = async () => {
        setSeedingPromiedos(true);
        setPromiedosSummary(null);
        try {
            await base44.entities.DataSource.create({
                name: 'Promiedos',
                base_url: 'https://www.promiedos.com.ar',
                allowed_paths_regex: '.*',
                enabled: true,
                notes: 'Primary source for Liga AFA live match data. source_type: PROMIEDOS, priority: PRIMARY'
            });
            setPromiedosSummary({ success: true, message: 'Promiedos DataSource created successfully.' });
        } catch (error) {
            setPromiedosSummary({ success: false, message: 'Failed: ' + error.message });
        }
        setSeedingPromiedos(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Dev Seed Data</h1>

            {/* Liga AFA Setup */}
            <Card className="mb-6 border-blue-200 bg-blue-50">
                <CardHeader>
                    <CardTitle className="text-blue-800 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Liga AFA Setup
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Button onClick={seedLigaAfa} disabled={ligaSeeding} className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white">
                            {ligaSeeding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Seeding Liga AFA...</> : <><Database className="w-4 h-4 mr-2" />Seed Liga AFA Data</>}
                        </Button>
                        <p className="text-sm text-blue-700 mt-1">Creates 30 teams, 420 players, and 30 matches for Torneo Apertura 2026.</p>
                        {ligaSummary && (
                            <div className={`mt-3 p-3 rounded text-sm flex items-start gap-2 ${ligaSummary.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {ligaSummary.success ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                                <div>
                                    <div className="font-semibold">{ligaSummary.message}</div>
                                    {ligaSummary.counts && (
                                        <div className="mt-1 space-y-0.5">
                                            {ligaSummary.counts.teams_created !== undefined && <div>• Teams: {ligaSummary.counts.teams_created}</div>}
                                            {ligaSummary.counts.players_created !== undefined && <div>• Players: {ligaSummary.counts.players_created}</div>}
                                            {ligaSummary.counts.matches_created !== undefined && <div>• Matches: {ligaSummary.counts.matches_created}</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <Button onClick={seedPromiedos} disabled={seedingPromiedos} variant="outline" className="w-full sm:w-auto border-blue-400 text-blue-800 hover:bg-blue-100">
                            {seedingPromiedos ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : <><Database className="w-4 h-4 mr-2" />Seed Promiedos Data Source</>}
                        </Button>
                        <p className="text-sm text-blue-700 mt-1">Creates a Promiedos DataSource record for live match ingestion.</p>
                        {promiedosSummary && (
                            <div className={`mt-3 p-3 rounded text-sm flex items-center gap-2 ${promiedosSummary.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {promiedosSummary.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                {promiedosSummary.message}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-6 border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-800 flex items-center gap-2">
                        <RotateCcw className="w-5 h-5" />
                        Reset Test Data
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-red-700">
                        Wipes all scores, squads, badges, and match results. Resets all match statuses to SCHEDULED. <strong>Predictions, teams, players, and matches are preserved.</strong>
                    </p>
                    <Button
                        onClick={resetTestData}
                        disabled={resetting}
                        variant="destructive"
                        className="w-full sm:w-auto"
                    >
                        {resetting ? (
                            <>Resetting...</>
                        ) : (
                            <>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset Test Data
                            </>
                        )}
                    </Button>
                    {summary?.resetSummary && (
                        <div className="text-sm text-red-800 space-y-1 mt-2">
                            {Object.entries(summary.resetSummary).map(([key, val]) => (
                                <div key={key}>• {key.replace(/_/g, ' ')}: <strong>{val}</strong></div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Seed Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Button 
                                onClick={seedDevData} 
                                disabled={seeding}
                                className="w-full"
                            >
                                {seeding ? (
                                    <>Seeding...</>
                                ) : (
                                    <>
                                        <Database className="w-4 h-4 mr-2" />
                                        Seed Dev Data
                                    </>
                                )}
                            </Button>
                            <p className="text-sm text-gray-500 mt-2">
                                Creates minimal dataset: 2 teams, 8 players, 2 matches, 2 data sources, 4 source links
                            </p>
                        </div>

                        {hasDevSeed && (
                            <div>
                                <Button 
                                    onClick={deleteDevSeed} 
                                    disabled={deleting}
                                    variant="destructive"
                                    className="w-full"
                                >
                                    {deleting ? (
                                        <>Deleting...</>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete Dev Seed Data
                                        </>
                                    )}
                                </Button>
                                <p className="text-sm text-gray-500 mt-2">
                                    Only deletes records created by the seed action
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>What Gets Seeded</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <div><strong>AppConfig:</strong> Ensures config row exists (tournament +60 days)</div>
                        <div><strong>DataSources:</strong> FIFA and WIKIPEDIA (with permissive regex for dev)</div>
                        <div><strong>Teams:</strong> USA (fifa_code=USA) and ARG (fifa_code=ARG)</div>
                        <div><strong>Players:</strong> 4 per team (GK, DEF, MID, FWD) with valid prices</div>
                        <div><strong>Matches:</strong> 2 matches (one +4h future, one -6h past for testing)</div>
                        <div><strong>Source Links:</strong> Placeholder links (url=null) for each match</div>
                    </CardContent>
                </Card>
            </div>

            {summary && (
                <Alert className={summary.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <AlertDescription>
                        <div className="flex items-start gap-2">
                            {summary.success ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}
                            <div>
                                <div className="font-semibold mb-2">{summary.message}</div>
                                {summary.counts && (
                                    <div className="text-sm space-y-1">
                                        {summary.counts.created !== undefined && <div>• Created: {summary.counts.created}</div>}
                                        {summary.counts.reused !== undefined && <div>• Reused: {summary.counts.reused}</div>}
                                        {summary.counts.skipped !== undefined && summary.counts.skipped > 0 && <div>• Skipped: {summary.counts.skipped}</div>}
                                        {summary.counts.deleted !== undefined && <div>• Deleted: {summary.counts.deleted}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {hasDevSeed && summary?.success && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">1. Add Source URLs</div>
                                <div className="text-sm text-gray-600">
                                    Go to <strong>Admin → Match Source Links</strong> and fill in at least one valid URL for FIFA or Wikipedia
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">2. Run MatchWatcher</div>
                                <div className="text-sm text-gray-600">
                                    Trigger MatchWatcher manually or wait for scheduled run (every 10 min)
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">3. Monitor Results</div>
                                <div className="text-sm text-gray-600">
                                    Check <strong>Admin → Ingestion Monitor</strong> and <strong>Match Validation</strong> for results
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">4. Test Finalization</div>
                                <div className="text-sm text-gray-600">
                                    For the past match, manually set <strong>MatchValidation</strong> with confidence=100, then run Finalizer
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}