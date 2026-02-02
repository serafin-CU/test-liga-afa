import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Loader2, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminSystemTestHarness() {
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState([]);
    const [testRunId, setTestRunId] = useState(null);
    const [devSetupRunning, setDevSetupRunning] = useState(false);
    const [devSetupResult, setDevSetupResult] = useState(null);
    const [selectedMatchId, setSelectedMatchId] = useState(null);
    const [scoringRunning, setScoringRunning] = useState(false);
    const [scoringResult, setScoringResult] = useState(null);
    const [matchDiagnostics, setMatchDiagnostics] = useState(null);
    const [buildingStats, setBuildingStats] = useState(false);

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = teams.reduce((acc, team) => {
        acc[team.id] = team;
        return acc;
    }, {});

    const getMatchLabel = (match) => {
        const homeTeam = teamsMap[match.home_team_id];
        const awayTeam = teamsMap[match.away_team_id];
        const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
        const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';
        const date = new Date(match.kickoff_at).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const shortId = match.id.slice(-8);
        return `${date}  ${homeName} vs ${awayName} (${match.phase}) · ${shortId}`;
    };

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    const runSingleTest = async (testNum) => {
        setRunning(true);
        setResults([]);
        const runId = `test_${Date.now()}`;
        setTestRunId(runId);
        const testResults = [];

        try {
            const testFunctions = [runTest1, runTest2, runTest3, runTest4, runTest5];
            testResults.push(await testFunctions[testNum - 1](runId));
        } catch (error) {
            testResults.push({
                name: `TEST ${testNum}`,
                status: 'FAIL',
                details: `Fatal error: ${error.message}`
            });
        }

        setResults(testResults);
        setRunning(false);
    };

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

            // TEST 4: Fantasy Stats Builder Idempotency
            testResults.push(await runTest4(runId));

            // TEST 5: Fantasy Scoring Idempotency + Re-score
            testResults.push(await runTest5(runId));

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

    const runTest4 = async (runId) => {
        const test = { name: 'TEST 4: Fantasy Stats Builder Idempotency', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create teams and players
            const team1 = await base44.entities.Team.create({
                name: `Test Team G ${runId}`,
                fifa_code: 'TG1'
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team H ${runId}`,
                fifa_code: 'TH1'
            });

            const player1 = await base44.entities.Player.create({
                full_name: `Test Scorer ${runId}`,
                team_id: team1.id,
                position: 'FWD',
                price: 12
            });
            const player2 = await base44.entities.Player.create({
                full_name: `Test Keeper ${runId}`,
                team_id: team2.id,
                position: 'GK',
                price: 8
            });

            // Create past match
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'FINAL'
            });

            // Create data source
            const promiedosSource = await base44.entities.DataSource.filter({ name: 'PROMIEDOS' });
            const sourceId = promiedosSource[0]?.id;

            if (!sourceId) {
                test.details = 'PROMIEDOS data source not found';
                return test;
            }

            // Create mock ingestion event with parsed data
            const mockParsedData = {
                status: 'FINAL',
                score: { home: 2, away: 1 },
                events: [
                    { type: 'GOAL', team: team1.name, player: player1.full_name, minute: 23 },
                    { type: 'GOAL', team: team2.name, player: 'Unknown Player', minute: 45 },
                    { type: 'GOAL', team: team1.name, player: player1.full_name, minute: 78 }
                ],
                lineups: [
                    { team_name: team1.name, starters: [player1.full_name], bench: [] },
                    { team_name: team2.name, starters: [player2.full_name], bench: [] }
                ]
            };

            const ingestionRun = await base44.entities.IngestionRun.create({
                started_at: new Date().toISOString(),
                status: 'SUCCESS',
                summary_json: JSON.stringify({ test: true })
            });

            await base44.entities.IngestionEvent.create({
                run_id: ingestionRun.id,
                match_id: match.id,
                source_id: sourceId,
                fetched_at: new Date().toISOString(),
                http_status: 200,
                parse_status: 'OK',
                content_hash: 'test_hash_' + runId,
                parsed_json: JSON.stringify(mockParsedData)
            });

            // Action: Run FANTASY_STATS job twice
            const result1 = await base44.functions.invoke('fantasyStatsService', {
                action: 'build_fantasy_stats',
                match_id: match.id,
                options: {}
            });

            const result2 = await base44.functions.invoke('fantasyStatsService', {
                action: 'build_fantasy_stats',
                match_id: match.id,
                options: {}
            });

            // Verify: FantasyMatchPlayerStats count stable
            const stats1 = await base44.entities.FantasyMatchPlayerStats.filter({ match_id: match.id });
            
            if (stats1.length === 0) {
                test.details = `No stats created. Result 1: ${JSON.stringify(result1.data)}`;
                return test;
            }

            // Check for duplicates (should be prevented by UNIQUE constraint)
            const playerIds = stats1.map(s => s.player_id);
            const uniquePlayerIds = [...new Set(playerIds)];
            if (playerIds.length !== uniquePlayerIds.length) {
                test.details = `Duplicate player stats found: ${playerIds.length} total, ${uniquePlayerIds.length} unique`;
                return test;
            }

            // Verify unresolved names logged
            if (result1.data.unresolved_names?.length === 0) {
                test.details = 'Expected at least 1 unresolved name (Unknown Player), got 0';
                return test;
            }

            // Verify player1 stats
            const player1Stats = stats1.find(s => s.player_id === player1.id);
            if (!player1Stats) {
                test.details = 'Player 1 stats not found';
                return test;
            }

            if (player1Stats.goals !== 2) {
                test.details = `Expected player 1 to have 2 goals, got ${player1Stats.goals}`;
                return test;
            }

            if (player1Stats.started !== true) {
                test.details = `Expected player 1 to have started=true, got ${player1Stats.started}`;
                return test;
            }

            test.status = 'PASS';
            test.details = `✓ ${stats1.length} stats created, ✓ No duplicates, ✓ Player 1: 2 goals, started=true, ✓ ${result1.data.unresolved_names.length} unresolved names logged`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runTest5 = async (runId) => {
        const test = { name: 'TEST 5: Fantasy Scoring Idempotency + Re-score', status: 'FAIL', details: '' };
        
        try {
            // Setup: Create teams, players, match, stats, and squad
            const team1 = await base44.entities.Team.create({
                name: `Test Team I ${runId}`,
                fifa_code: 'TI1'
            });
            const team2 = await base44.entities.Team.create({
                name: `Test Team J ${runId}`,
                fifa_code: 'TJ1'
            });

            // Create 11 players for squad
            const players = [];
            const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
            for (let i = 0; i < 11; i++) {
                const player = await base44.entities.Player.create({
                    full_name: `Test Player ${i} ${runId}`,
                    team_id: i < 6 ? team1.id : team2.id,
                    position: positions[i],
                    price: 8
                });
                players.push(player);
            }

            // Create finalized match
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 3);
            
            const match = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: team1.id,
                away_team_id: team2.id,
                status: 'FINAL'
            });

            // Create MatchResultFinal (team1 wins 2-0, clean sheet)
            await base44.entities.MatchResultFinal.create({
                match_id: match.id,
                home_goals: 2,
                away_goals: 0,
                finalized_at: new Date().toISOString()
            });

            // Create FantasyMatchPlayerStats
            for (let i = 0; i < 11; i++) {
                await base44.entities.FantasyMatchPlayerStats.create({
                    match_id: match.id,
                    player_id: players[i].id,
                    team_id: players[i].team_id,
                    started: true,
                    substituted_in: false,
                    substituted_out: false,
                    minute_in: 0,
                    minute_out: 90,
                    minutes_played: 90,
                    goals: i === 8 ? 2 : 0, // FWD scores 2 goals
                    yellow_cards: i === 2 ? 1 : 0, // 1 DEF gets yellow
                    red_cards: 0,
                    source: 'MANUAL'
                });
            }

            // Create user and finalized squad
            const currentUser = await base44.auth.me();
            
            const squad = await base44.entities.FantasySquad.create({
                user_id: currentUser.id,
                phase: 'GROUP_MD1',
                status: 'FINAL',
                budget_cap: 150,
                total_cost: 88,
                finalized_at: new Date().toISOString()
            });

            // Add all 11 players as starters
            for (const player of players) {
                await base44.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: player.id,
                    slot_type: 'STARTER',
                    starter_position: player.position
                });
            }

            // Action 1: Run fantasy scoring twice
            const score1 = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            const score2 = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            // Verify: Second run should NOT create new awards (idempotent via ScoringJob)
            const ledgerAfterFirst = await base44.entities.PointsLedger.filter({
                mode: 'FANTASY',
                user_id: currentUser.id
            });

            const matchLedgerEntries = ledgerAfterFirst.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === match.id && breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            if (matchLedgerEntries.length !== 1) {
                test.details = `Expected 1 AWARD entry after 2 runs, got ${matchLedgerEntries.length}`;
                return test;
            }

            const firstPoints = matchLedgerEntries[0].points;

            // Action 2: Modify one stat (simulate correction)
            const fwdPlayer = players.find(p => p.position === 'FWD');
            const fwdStats = await base44.entities.FantasyMatchPlayerStats.filter({
                match_id: match.id,
                player_id: fwdPlayer.id
            });

            // Update FWD to have 3 goals instead of 2
            await base44.entities.FantasyMatchPlayerStats.update(fwdStats[0].id, {
                goals: 3
            });

            // Delete the ScoringJob to allow re-score
            const scoringJobs = await base44.entities.ScoringJob.filter({
                dedupe_key: `FANTASY:MATCH:${match.id}:v1`
            });
            for (const job of scoringJobs) {
                await base44.entities.ScoringJob.delete(job.id);
            }

            // Action 3: Run fantasy scoring again (re-score)
            const score3 = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: match.id
            });

            // Verify: VOID + new AWARD entries created
            const ledgerAfterRescore = await base44.entities.PointsLedger.filter({
                mode: 'FANTASY',
                user_id: currentUser.id
            });

            const matchEntriesAfterRescore = ledgerAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === match.id;
                } catch {
                    return false;
                }
            });

            const voidEntries = matchEntriesAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type === 'VOID';
                } catch {
                    return false;
                }
            });

            const awardEntries = matchEntriesAfterRescore.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            if (voidEntries.length !== 1) {
                test.details = `Expected 1 VOID entry, got ${voidEntries.length}`;
                return test;
            }

            if (awardEntries.length !== 2) {
                test.details = `Expected 2 AWARD entries (original + re-score), got ${awardEntries.length}`;
                return test;
            }

            // Verify net total (should be higher due to extra goal)
            const netTotal = matchEntriesAfterRescore.reduce((sum, e) => sum + e.points, 0);
            const expectedIncrease = 5; // 1 extra goal by FWD = 5 points

            if (netTotal !== firstPoints + expectedIncrease) {
                test.details = `Expected net total ${firstPoints + expectedIncrease}, got ${netTotal}`;
                return test;
            }

            test.status = 'PASS';
            test.details = `✓ Idempotency: 1 award after 2 runs, ✓ Re-score: 1 VOID + 2 AWARD entries, ✓ Net increase: ${expectedIncrease} points`;

        } catch (error) {
            test.details = error.message;
        }

        return test;
    };

    const runDevFantasySetup = async () => {
        setDevSetupRunning(true);
        setDevSetupResult(null);

        try {
            const response = await base44.functions.invoke('devFantasyTestSetup', {});
            setDevSetupResult(response.data);
        } catch (error) {
            setDevSetupResult({ error: error.message });
        }

        setDevSetupRunning(false);
    };

    const runFantasyScoring = async (force = false) => {
        if (!selectedMatchId) {
            alert('Please select a match first');
            return;
        }

        setScoringRunning(true);
        setScoringResult(null);

        try {
            const response = await base44.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: selectedMatchId,
                force: force
            });
            setScoringResult(response.data);
        } catch (error) {
            setScoringResult({ 
                status: 'ERROR',
                code: 'REQUEST_FAILED',
                message: error.message,
                details: error
            });
        }

        setScoringRunning(false);
    };

    const loadMatchDiagnostics = async (matchId) => {
        if (!matchId) {
            setMatchDiagnostics(null);
            return;
        }

        try {
            const match = matches.find(m => m.id === matchId);
            const matchResults = await base44.entities.MatchResultFinal.filter({ match_id: matchId });
            const stats = await base44.entities.FantasyMatchPlayerStats.filter({ match_id: matchId });
            
            // Get finalized squads for this phase
            const allSquads = await base44.entities.FantasySquad.filter({ 
                phase: match.phase,
                status: 'FINAL'
            });
            
            // Get starters for first squad (for display)
            let startersCount = 0;
            let benchCount = 0;
            if (allSquads.length > 0) {
                const squadPlayers = await base44.entities.FantasySquadPlayer.filter({ 
                    squad_id: allSquads[0].id 
                });
                startersCount = squadPlayers.filter(sp => sp.slot_type === 'STARTER').length;
                benchCount = squadPlayers.filter(sp => sp.slot_type === 'BENCH').length;
            }
            
            const allLedger = await base44.entities.PointsLedger.list();
            const matchLedger = allLedger.filter(e => {
                if (e.mode !== 'FANTASY') return false;
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === matchId && breakdown.type === 'AWARD';
                } catch {
                    return false;
                }
            });

            setMatchDiagnostics({
                match_id: matchId,
                match_label: getMatchLabel(match),
                status: match?.status,
                phase: match?.phase,
                finalized: matchResults.length > 0,
                stats_count: stats.length,
                squads_count: allSquads.length,
                starters_count: startersCount,
                bench_count: benchCount,
                scored_users: matchLedger.length,
                last_scored_at: matchLedger.length > 0 ? matchLedger[0].created_date : null
            });
        } catch (error) {
            setMatchDiagnostics({ error: error.message });
        }
    };

    const buildStatsForMatch = async () => {
        if (!selectedMatchId) return;

        setBuildingStats(true);
        try {
            const response = await base44.functions.invoke('fantasyStatsService', {
                action: 'build_fantasy_stats',
                match_id: selectedMatchId,
                options: {}
            });
            
            alert(`Stats built: ${JSON.stringify(response.data)}`);
            await loadMatchDiagnostics(selectedMatchId);
        } catch (error) {
            alert(`Error building stats: ${error.message}`);
        }
        setBuildingStats(false);
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
                    <Button onClick={runDevFantasySetup} disabled={devSetupRunning} variant="outline">
                        {devSetupRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running...
                            </>
                        ) : (
                            'Run Dev Fantasy Setup'
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
                    <CardTitle>Fantasy Scoring Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Select Match</label>
                        <Select value={selectedMatchId || ''} onValueChange={(val) => {
                            setSelectedMatchId(val);
                            loadMatchDiagnostics(val);
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a finalized match" />
                            </SelectTrigger>
                            <SelectContent>
                                {finalizedMatches.map(match => (
                                    <SelectItem key={match.id} value={match.id}>
                                        {getMatchLabel(match)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {matchDiagnostics && (
                        <div className="p-4 bg-gray-50 rounded border space-y-3 text-sm">
                            <div className="font-semibold text-base">Match Diagnostics</div>
                            {matchDiagnostics.error ? (
                                <div className="text-red-600">{matchDiagnostics.error}</div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <div>
                                            <strong className="text-gray-700">Match:</strong>
                                            <div className="text-xs text-gray-600 mt-1">{matchDiagnostics.match_label}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <strong className="text-gray-700">Match ID:</strong>
                                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{matchDiagnostics.match_id?.slice(-12)}</code>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(matchDiagnostics.match_id);
                                                    alert('Match ID copied!');
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                        <div><strong>Status:</strong> {matchDiagnostics.status}</div>
                                        <div><strong>Phase:</strong> {matchDiagnostics.phase}</div>
                                        <div><strong>Stats Count:</strong> {matchDiagnostics.stats_count} 
                                            <span className="text-xs text-gray-500 ml-1">(from FantasyMatchPlayerStats)</span>
                                        </div>
                                        <div><strong>Finalized?:</strong> {matchDiagnostics.finalized ? '✓ Yes' : '✗ No'}</div>
                                        <div><strong>Squads Count:</strong> {matchDiagnostics.squads_count}</div>
                                        <div><strong>Starters Count:</strong> {matchDiagnostics.starters_count}
                                            <span className="text-xs text-gray-500 ml-1">(slot_type=STARTER, must be 11)</span>
                                        </div>
                                        <div><strong>Users Scored:</strong> {matchDiagnostics.scored_users}</div>
                                        <div className="col-span-2">
                                            <strong>Last Scored:</strong> 
                                            {matchDiagnostics.last_scored_at ? (
                                                <span className="text-xs block text-gray-600">
                                                    {new Date(matchDiagnostics.last_scored_at).toLocaleString()}
                                                </span>
                                            ) : (
                                                ' Never'
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-2 border-t">
                                        {matchDiagnostics.stats_count === 0 && (
                                            <Button 
                                                size="sm" 
                                                onClick={buildStatsForMatch}
                                                disabled={buildingStats}
                                                variant="outline"
                                            >
                                                {buildingStats ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Build Stats for Match
                                            </Button>
                                        )}
                                        <Link to={`${createPageUrl('AdminFantasyLedgerViewer')}?match=${matchDiagnostics.match_id}`}>
                                            <Button size="sm" variant="outline">
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open Ledger
                                            </Button>
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button 
                            onClick={() => runFantasyScoring(false)} 
                            disabled={scoringRunning || !selectedMatchId}
                        >
                            {scoringRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Run Fantasy Scoring
                        </Button>
                        <Button 
                            onClick={() => runFantasyScoring(true)} 
                            disabled={scoringRunning || !selectedMatchId}
                            variant="destructive"
                        >
                            {scoringRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Force Re-Score
                        </Button>
                    </div>

                    {scoringResult && (
                        <div className="mt-4 p-4 bg-gray-50 rounded border">
                            {scoringResult.ok === false ? (
                                <div className="space-y-2">
                                    <div className="text-red-600 font-bold text-lg">
                                        {scoringResult.code || 'ERROR'}
                                    </div>
                                    <div className="text-sm font-medium">{scoringResult.message}</div>
                                    {scoringResult.hint && (
                                        <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                                            💡 {scoringResult.hint}
                                        </div>
                                    )}
                                    {scoringResult.details && (
                                        <details className="text-xs">
                                            <summary className="cursor-pointer text-gray-600">Show details</summary>
                                            <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-64">
                                                {JSON.stringify(scoringResult.details, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div className="text-green-600 font-semibold">✓ {scoringResult.status}</div>
                                    {scoringResult.message && <div><strong>Message:</strong> {scoringResult.message}</div>}
                                    {scoringResult.users_scored_count !== undefined && (
                                        <>
                                            <div><strong>Users Scored:</strong> {scoringResult.users_scored_count}</div>
                                            <div><strong>Awards:</strong> {scoringResult.ledger_awards}</div>
                                            <div><strong>Voids:</strong> {scoringResult.ledger_voids}</div>
                                            <div><strong>Total Points:</strong> {scoringResult.total_points_awarded}</div>
                                        </>
                                    )}
                                    {scoringResult.diagnostics && (
                                        <details className="mt-3">
                                            <summary className="cursor-pointer font-semibold text-gray-700">Scoring Diagnostics</summary>
                                            <div className="mt-2 p-3 bg-white rounded border space-y-2">
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <strong>Stats Count:</strong> {scoringResult.diagnostics.stats_count}
                                                        <div className="text-gray-500">FantasyMatchPlayerStats rows</div>
                                                    </div>
                                                    <div><strong>Squads Count:</strong> {scoringResult.diagnostics.squads_count}</div>
                                                    <div>
                                                        <strong>Starters Count:</strong> {scoringResult.diagnostics.starters_count}
                                                        {scoringResult.diagnostics.starters_count !== 11 && (
                                                            <span className="text-red-600 ml-1">⚠️ Must be 11</span>
                                                        )}
                                                        <div className="text-gray-500">slot_type=STARTER across all squads</div>
                                                    </div>
                                                    <div><strong>Goals Sum:</strong> {scoringResult.diagnostics.goals_sum}</div>
                                                    <div>
                                                        <strong>Goal Scorers in Starters:</strong> {scoringResult.diagnostics.goal_scorers_in_starters_count}
                                                        {scoringResult.diagnostics.goals_sum > 0 && scoringResult.diagnostics.goal_scorers_in_starters_count === 0 && (
                                                            <span className="text-red-600 ml-1">⚠️ Should be &gt; 0</span>
                                                        )}
                                                    </div>
                                                    <div><strong>Computed Total Points:</strong> {scoringResult.diagnostics.computed_total_points}</div>
                                                </div>
                                                {scoringResult.diagnostics.excluded_goal_scorer_player_ids?.length > 0 && (
                                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                        <strong className="text-yellow-800">⚠️ Excluded Goal Scorers:</strong>
                                                        <div className="mt-1 text-yellow-700">
                                                            {scoringResult.diagnostics.excluded_goal_scorer_player_ids.length} player(s) scored goals but are not in any squad's starters
                                                        </div>
                                                        <code className="text-xs">
                                                            {scoringResult.diagnostics.excluded_goal_scorer_player_ids.join(', ')}
                                                        </code>
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Individual Tests</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map(testNum => (
                            <Button 
                                key={testNum}
                                onClick={() => runSingleTest(testNum)} 
                                disabled={running}
                                variant="outline"
                                size="sm"
                            >
                                Run TEST {testNum}
                            </Button>
                        ))}
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
                    </div>
                </CardContent>
            </Card>

            {devSetupResult && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Dev Fantasy Setup Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {devSetupResult.ok === false ? (
                            <div className="space-y-2">
                                <div className="text-red-600 font-bold text-lg">
                                    {devSetupResult.code || 'ERROR'}
                                </div>
                                <div className="text-sm font-medium">{devSetupResult.message}</div>
                                {devSetupResult.hint && (
                                    <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                                        💡 {devSetupResult.hint}
                                    </div>
                                )}
                                {devSetupResult.details && (
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-gray-600">Show details</summary>
                                        <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-64">
                                            {JSON.stringify(devSetupResult.details, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <div>
                                        <strong className="text-gray-700">Match:</strong>
                                        <div className="text-xs text-gray-600 mt-1">{devSetupResult.match_label}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><strong>Match ID:</strong> <code className="text-xs">{devSetupResult.match_id?.slice(-12)}</code></div>
                                        <div><strong>Stats Count:</strong> {devSetupResult.stats_count}</div>
                                        <div><strong>Starters Count:</strong> {devSetupResult.starters_count}
                                            {devSetupResult.starters_count !== 11 && (
                                                <span className="text-red-600 ml-1">⚠️ Must be 11</span>
                                            )}
                                        </div>
                                        <div><strong>Goal Scorers Count:</strong> {devSetupResult.goal_scorers_count}</div>
                                        <div><strong>Goal Scorers in Starters:</strong> {devSetupResult.goal_scorers_in_starters_count}
                                            {devSetupResult.goal_scorers_count > 0 && devSetupResult.goal_scorers_in_starters_count === 0 && (
                                                <span className="text-red-600 ml-1">⚠️ Should be &gt; 0</span>
                                            )}
                                        </div>
                                        <div><strong>Squad ID:</strong> <code className="text-xs">{devSetupResult.squad_id?.slice(-12)}</code></div>
                                        <div><strong>User:</strong> {devSetupResult.user_email}</div>
                                        <div><strong>Total Points:</strong> {devSetupResult.total_points}</div>
                                        </div>
                                </div>
                                
                                <div className="flex gap-2 pt-3 border-t">
                                    <Link to={`${createPageUrl('AdminFantasyStatsViewer')}?match_id=${devSetupResult.match_id}`}>
                                        <Button size="sm" variant="outline">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Stats Viewer
                                        </Button>
                                    </Link>
                                    <Link to={`${createPageUrl('AdminFantasyLedgerViewer')}?match=${devSetupResult.match_id}`}>
                                        <Button size="sm" variant="outline">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Ledger Viewer
                                        </Button>
                                    </Link>
                                </div>
                                
                                <div className="pt-2 text-green-600 font-semibold">{devSetupResult.message}</div>
                                
                                {devSetupResult.match_result_final_created && (
                                    <div className="text-blue-600 text-sm">
                                        ℹ️ MatchResultFinal auto-created for dev/test match
                                    </div>
                                )}

                                {devSetupResult.sample_ledger_rows?.length > 0 && (
                                    <div className="mt-3">
                                        <div className="font-semibold text-sm mb-2">Sample Ledger Rows:</div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mode</TableHead>
                                                    <TableHead>Source Type</TableHead>
                                                    <TableHead>Source ID</TableHead>
                                                    <TableHead>Points</TableHead>
                                                    <TableHead>Created</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {devSetupResult.sample_ledger_rows.map((row, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-xs">{row.mode}</TableCell>
                                                        <TableCell className="text-xs">{row.source_type}</TableCell>
                                                        <TableCell className="text-xs truncate max-w-[100px]">{row.source_id}</TableCell>
                                                        <TableCell className={`font-semibold ${row.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {row.points > 0 ? '+' : ''}{row.points}
                                                        </TableCell>
                                                        <TableCell className="text-xs">{new Date(row.created_date).toLocaleTimeString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                
                                {devSetupResult.scoring_result && (
                                    <details className="mt-3">
                                        <summary className="text-sm font-medium cursor-pointer">Scoring Result JSON</summary>
                                        <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-auto">
                                            {JSON.stringify(devSetupResult.scoring_result, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Test Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div><strong>TEST 1:</strong> Verifies Finalizer and scoring are idempotent (no duplicate results/points)</div>
                    <div><strong>TEST 2:</strong> Verifies matches with confidence &lt; 70 are NOT auto-finalized</div>
                    <div><strong>TEST 3:</strong> Verifies URL whitelist blocks non-matching URLs</div>
                    <div><strong>TEST 4:</strong> Verifies Fantasy Stats Builder is idempotent and resolves players correctly</div>
                    <div><strong>TEST 5:</strong> Verifies Fantasy Scoring is idempotent and handles re-scoring with void entries</div>
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