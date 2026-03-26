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
    const [ligaRunning, setLigaRunning] = useState(false);
    const [ligaProgress, setLigaProgress] = useState('');
    const [ligaSummary, setLigaSummary] = useState(null);
    const [stepResults, setStepResults] = useState({});
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

    const invoke = (action, extra = {}) =>
        base44.functions.invoke('ligaAfaSeedService', { action, ...extra });

    const seedLigaAfa = async () => {
        if (!confirm('Esto borrará todos los datos existentes y re-seedeará Liga AFA. Tarda ~2-3 minutos. ¿Continuar?')) return;
        setLigaRunning(true);
        setLigaSummary(null);
        setStepResults({});
        const results = {};
        try {
            // Step 1: Wipe
            setLigaProgress('Paso 1/4: Borrando datos existentes...');
            const wipeRes = await invoke('wipe_data');
            results.wipe = wipeRes.data;
            setStepResults({ ...results });

            // Step 2: Seed teams
            setLigaProgress('Paso 2/4: Creando 30 equipos...');
            const teamsRes = await invoke('seed_teams');
            results.teams = teamsRes.data;
            setStepResults({ ...results });

            // Step 3: Seed players (6 batches)
            let totalPlayers = 0;
            for (let b = 0; b <= 5; b++) {
                setLigaProgress(`Paso 3/4: Creando jugadores... (batch ${b + 1}/6)`);
                const pRes = await invoke('seed_players_batch', { batch: b });
                totalPlayers += pRes.data.players_created || 0;
            }
            results.players = { players_created: totalPlayers };
            setStepResults({ ...results });

            // Step 4: Seed matches
            setLigaProgress('Paso 4/4: Creando partidos...');
            const matchRes = await invoke('seed_matches');
            results.matches = matchRes.data;
            setStepResults({ ...results });

            setLigaProgress('');
            setLigaSummary({ success: true, results });
        } catch (error) {
            setLigaProgress('');
            setLigaSummary({ success: false, message: error.response?.data?.error || error.message, results });
        }
        setLigaRunning(false);
    };

    const runSingleStep = async (action, label, extra = {}) => {
        setLigaRunning(true);
        setLigaProgress(label);
        try {
            const res = await invoke(action, extra);
            setStepResults(prev => ({ ...prev, [action]: res.data }));
            setLigaSummary({ success: true, singleStep: label, results: res.data });
        } catch (error) {
            setLigaSummary({ success: false, message: error.response?.data?.error || error.message });
        }
        setLigaProgress('');
        setLigaRunning(false);
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
                    {/* Main "run all" button */}
                    <div className="space-y-3">
                        <Button
                            onClick={seedLigaAfa}
                            disabled={ligaRunning}
                            className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white"
                        >
                            {ligaRunning
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{ligaProgress || 'Corriendo...'}</>
                                : <><Database className="w-4 h-4 mr-2" />Seed Liga AFA Data (4 pasos)</>}
                        </Button>
                        <p className="text-sm text-blue-700">Corre 4 pasos automáticos: borra, crea equipos, jugadores (6 batches), partidos. ~2-3 min.</p>
                    </div>

                    {/* Individual step buttons */}
                    <div className="border border-blue-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Pasos individuales (si falla uno)</p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={ligaRunning} onClick={() => runSingleStep('wipe_data', 'Borrando...')} className="border-red-300 text-red-700 hover:bg-red-50 text-xs">
                                1. Borrar datos
                            </Button>
                            <Button size="sm" variant="outline" disabled={ligaRunning} onClick={() => runSingleStep('seed_teams', 'Creando equipos...')} className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs">
                                2. Crear equipos
                            </Button>
                            {[0,1,2,3,4,5].map(b => (
                                <Button key={b} size="sm" variant="outline" disabled={ligaRunning} onClick={() => runSingleStep('seed_players_batch', `Jugadores batch ${b+1}/6...`, { batch: b })} className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs">
                                    3.{b+1} Players B{b}
                                </Button>
                            ))}
                            <Button size="sm" variant="outline" disabled={ligaRunning} onClick={() => runSingleStep('seed_matches', 'Creando partidos...')} className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs">
                                4. Crear partidos
                            </Button>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    {ligaRunning && ligaProgress && (
                        <div className="p-3 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>{ligaProgress}</span>
                        </div>
                    )}

                    {/* Result summary */}
                    {ligaSummary && (
                        <div className={`p-3 rounded text-sm flex items-start gap-2 ${ligaSummary.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {ligaSummary.success ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                            <div className="space-y-1">
                                {ligaSummary.success ? (
                                    <>
                                        <div className="font-semibold">{ligaSummary.singleStep ? `✅ ${ligaSummary.singleStep} completado` : '✅ Seed completado!'}</div>
                                        {ligaSummary.results?.wipe && <div className="text-xs">Borrado — Teams: {ligaSummary.results.wipe.deleted?.teams} · Players: {ligaSummary.results.wipe.deleted?.players} · Matches: {ligaSummary.results.wipe.deleted?.matches}</div>}
                                        {ligaSummary.results?.teams && <div className="text-xs">Equipos creados: {ligaSummary.results.teams.teams_created}</div>}
                                        {ligaSummary.results?.players && <div className="text-xs">Jugadores creados: {ligaSummary.results.players.players_created}</div>}
                                        {ligaSummary.results?.matches && <div className="text-xs">Partidos creados: {ligaSummary.results.matches.matches_created}</div>}
                                        {ligaSummary.singleStep && <div className="text-xs mt-1">{JSON.stringify(ligaSummary.results)}</div>}
                                    </>
                                ) : (
                                    <>
                                        <div className="font-semibold">Error: {ligaSummary.message}</div>
                                        {ligaSummary.results && Object.keys(ligaSummary.results).length > 0 && (
                                            <div className="text-xs">Completado hasta: {Object.keys(ligaSummary.results).join(' → ')}</div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    
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
                        <div><strong>DataSources:</strong> Promiedos (with permissive regex for dev)</div>
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