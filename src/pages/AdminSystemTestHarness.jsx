import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

export default function AdminSystemTestHarness() {
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState([]);
    const [testRunId, setTestRunId] = useState(null);

    const runTests = async () => {
        setRunning(true);
        setResults([]);
        const runId = `test_${Date.now()}`;
        setTestRunId(runId);
        const testResults = [];

        try {
            // TEST 1: Prode idempotency
            testResults.push(await runTest1(runId));

            // TEST 2: Finalization safety
            testResults.push(await runTest2(runId));

            // TEST 3: URL whitelist blocking
            testResults.push(await runTest3(runId));

        } catch (error) {
            testResults.push({
                name: 'Test Suite',
                status: 'FAIL',
                details: `Fatal error: ${error.message}`
            });
        }

        setResults(testResults);
        setRunning(false);
    };

    const runTest1 = async (runId) => {
        const test = { name: 'TEST 1: Prode Idempotency', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create teams
            const team1 = await base44.entities.Team.create({
                name: `Test Team A ${runId}`,
                fifa_code: 'TA1',
                details_json: JSON.stringify({ test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team B ${runId}`,
                fifa_code: 'TB1',
                details_json: JSON.stringify({ test_run_id: runId })
            });

            // Create players
            const player1 = await base44.entities.Player.create({
                full_name: `Test Player 1 ${runId}`,
                team_id: team1.id,
                position: 'FWD',
                price: 10
            });

            // Create match (past kickoff)
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED'
            });

            // Create test users via invite (will use system users instead)
            const currentUser = await base44.auth.me();
            
            // Create predictions
            const pred1 = await base44.entities.ProdePrediction.create({
                match_id: match.id,
                user_id: currentUser.id,
                pred_home_goals: 2,
                pred_away_goals: 1,
                submitted_at: new Date().toISOString()
            });

            // Create MatchValidation
            await base44.entities.MatchValidation.create({
                match_id: match.id,
                status_candidate: 'FINAL',
                score_candidate_home: 2,
                score_candidate_away: 1,
                confidence_score: 100,
                reasons_json: JSON.stringify(['Test setup']),
                locked_final: false
            });

            // Action: Run Finalizer twice
            const finalize1 = await base44.functions.invoke('finalizer', {});
            const finalize2 = await base44.functions.invoke('finalizer', {});

            // Verify: Only 1 MatchResultFinal
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: match.id });
            if (matchResults.length !== 1) {
                test.details = `Expected 1 MatchResultFinal, got ${matchResults.length}`;
                return test;
            }

            // Verify: Only 1 PRODE ScoringJob
            const dedupeKey = `PRODE:MATCH:${match.id}:v1`;
            const scoringJobs = await base44.entities.ScoringJob.filter({ dedupe_key: dedupeKey });
            if (scoringJobs.length !== 1) {
                test.details = `Expected 1 ScoringJob, got ${scoringJobs.length}`;
                return test;
            }

            // Run the scoring job
            await base44.functions.invoke('prodeService', {
                action: 'score_match',
                match_id: match.id,
                version: 1
            });

            // Verify: PointsLedger entries written exactly once per user
            const sourceId = `MATCH:${match.id}:v1`;
            const ledgerEntries = await base44.entities.PointsLedger.filter({ source_id: sourceId });
            
            // Group by user_id
            const entriesByUser = {};
            for (const entry of ledgerEntries) {
                entriesByUser[entry.user_id] = (entriesByUser[entry.user_id] || 0) + 1;
            }

            // Each user should have exactly 1 entry
            for (const [userId, count] of Object.entries(entriesByUser)) {
                if (count !== 1) {
                    test.details = `User ${userId} has ${count} ledger entries, expected 1`;
                    return test;
                }
            }

            test.status = 'PASS';
            test.details = `✓ 1 MatchResultFinal, ✓ 1 ScoringJob, ✓ ${Object.keys(entriesByUser).length} user(s) with 1 ledger entry each`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest2 = async (runId) => {
        const test = { name: 'TEST 2: Finalization Safety', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create match with low confidence
            const team1 = await base44.entities.Team.create({
                name: `Test Team C ${runId}`,
                fifa_code: 'TC1',
                details_json: JSON.stringify({ test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team D ${runId}`,
                fifa_code: 'TD1',
                details_json: JSON.stringify({ test_run_id: runId })
            });

            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED'
            });

            // Create MatchValidation with confidence=60 (below threshold)
            await base44.entities.MatchValidation.create({
                match_id: match.id,
                status_candidate: 'FINAL',
                score_candidate_home: 1,
                score_candidate_away: 1,
                confidence_score: 60,
                reasons_json: JSON.stringify(['Low confidence test']),
                locked_final: false
            });

            // Action: Run Finalizer
            await base44.functions.invoke('finalizer', {});

            // Verify: MatchResultFinal NOT created
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: match.id });
            if (matchResults.length !== 0) {
                test.details = `Expected 0 MatchResultFinal (confidence too low), got ${matchResults.length}`;
                return test;
            }

            // Verify: No scoring jobs created
            const dedupeKey = `PRODE:MATCH:${match.id}:v1`;
            const scoringJobs = await base44.entities.ScoringJob.filter({ dedupe_key: dedupeKey });
            if (scoringJobs.length !== 0) {
                test.details = `Expected 0 ScoringJob, got ${scoringJobs.length}`;
                return test;
            }

            test.status = 'PASS';
            test.details = '✓ Match not finalized (confidence=60 < 70), ✓ No scoring jobs created';

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest3 = async (runId) => {
        const test = { name: 'TEST 3: URL Whitelist Blocking', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create DataSource with strict whitelist
            const dataSource = await base44.entities.DataSource.create({
                name: `Test Source ${runId}`,
                base_url: 'https://example.com',
                allowed_paths_regex: '/allowed/.*',
                enabled: true,
                rate_limit_seconds: 30
            });

            // Create a test match
            const team1 = await base44.entities.Team.create({
                name: `Test Team E ${runId}`,
                fifa_code: 'TE1',
                details_json: JSON.stringify({ test_run_id: runId })
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team F ${runId}`,
                fifa_code: 'TF1',
                details_json: JSON.stringify({ test_run_id: runId })
            });

            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: new Date().toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'SCHEDULED'
            });

            // Create a valid link first
            const validLink = await base44.entities.MatchSourceLink.create({
                match_id: match.id,
                source_id: dataSource.id,
                url: 'https://example.com/allowed/match123',
                is_primary: true
            });

            // Attempt to update with blocked URL
            let blocked = false;
            let errorMessage = '';

            try {
                // Validate the URL
                const validation = await base44.functions.invoke('adminValidationService', {
                    action: 'validate_match_source_link',
                    url: 'https://example.com/blocked',
                    source_id: dataSource.id
                });

                if (!validation.data.valid) {
                    blocked = true;
                    errorMessage = validation.data.errors.join(', ');
                }
            } catch (error) {
                blocked = true;
                errorMessage = error.message;
            }

            if (!blocked) {
                test.details = 'Expected blocked URL to fail validation';
                return test;
            }

            test.status = 'PASS';
            test.details = `✓ Blocked URL rejected: ${errorMessage}`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const resetTestData = async () => {
        if (!testRunId) {
            alert('No test run to clean up');
            return;
        }

        if (!confirm('Delete all test data for run ' + testRunId + '?')) {
            return;
        }

        try {
            // Delete test teams (cascading will help with related data)
            const allTeams = await base44.entities.Team.list();
            for (const team of allTeams) {
                if (team.name?.includes(testRunId)) {
                    await base44.entities.Team.delete(team.id);
                }
            }

            // Delete test data sources
            const allSources = await base44.entities.DataSource.list();
            for (const source of allSources) {
                if (source.name?.includes(testRunId)) {
                    await base44.entities.DataSource.delete(source.id);
                }
            }

            alert('Test data cleaned up successfully');
            setTestRunId(null);
            setResults([]);

        } catch (error) {
            alert('Cleanup error: ' + error.message);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">System Test Harness</h1>
                <div className="flex gap-2">
                    <Button onClick={runTests} disabled={running}>
                        {running ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running...
                            </>
                        ) : (
                            'Run All Tests'
                        )}
                    </Button>
                    {testRunId && (
                        <Button variant="outline" onClick={resetTestData}>
                            Reset Test Data
                        </Button>
                    )}
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Test Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div><strong>TEST 1:</strong> Verifies Finalizer and scoring are idempotent (no duplicate results/points)</div>
                    <div><strong>TEST 2:</strong> Verifies matches with confidence &lt; 70 are NOT auto-finalized</div>
                    <div><strong>TEST 3:</strong> Verifies URL whitelist blocks non-matching URLs</div>
                    <div className="text-yellow-800 bg-yellow-50 p-3 rounded mt-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <span>Tests create temporary data tagged with test_run_id. Use "Reset Test Data" to clean up.</span>
                    </div>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Test Results</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Test</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((result, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{result.name}</TableCell>
                                        <TableCell>
                                            {result.status === 'PASS' ? (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="w-5 h-5" />
                                                    <span className="font-semibold">PASS</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-red-600">
                                                    <XCircle className="w-5 h-5" />
                                                    <span className="font-semibold">FAIL</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">{result.details}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}