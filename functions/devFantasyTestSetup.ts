import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEV Fantasy Test Setup
 * Creates a test user, squad, and runs fantasy scoring for validation
 */

Deno.serve(async (req) => {
    const testRunId = `dev_test_${Date.now()}`;
    
    try {
        const base44 = createClientFromRequest(req);
        
        // DEV-ONLY: Support test mode when auth is unavailable
        let currentUser = null;
        let isTestMode = false;
        
        try {
            currentUser = await base44.auth.me();
            
            // If auth is available, enforce admin role
            if (currentUser?.role !== 'admin') {
                return Response.json({ 
                    step: 'AUTH_CHECK',
                    error: 'Admin access required',
                    details: { role: currentUser?.role }
                }, { status: 403 });
            }
        } catch (authError) {
            // Auth unavailable - running in test mode
            console.warn('Running devFantasyTestSetup in unauthenticated test mode');
            isTestMode = true;
        }

        // Step 1: Find or create test user
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email: 'test.user@dev.local' });
        let testUser;
        
        if (existingUsers.length > 0) {
            testUser = existingUsers[0];
        } else if (currentUser) {
            // Use current admin user if authenticated
            testUser = currentUser;
        } else {
            // Test mode: use first admin user found
            const allUsers = await base44.asServiceRole.entities.User.list();
            testUser = allUsers.find(u => u.role === 'admin');
            
            if (!testUser) {
                return Response.json({
                    step: 'TEST_USER_LOOKUP',
                    error: 'No admin user found for test mode',
                    details: { isTestMode, total_users: allUsers.length }
                }, { status: 500 });
            }
        }

        // Step 2: Find most recent finalized match with stats
        const allMatches = await base44.asServiceRole.entities.Match.filter({ status: 'FINAL' });
        const sortedMatches = allMatches.sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

        let targetMatch = null;
        let matchStats = [];

        for (const match of sortedMatches) {
            const stats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
                match_id: match.id 
            });
            if (stats.length > 0) {
                targetMatch = match;
                matchStats = stats;
                break;
            }
        }

        if (!targetMatch) {
            return Response.json({ 
                step: 'MATCH_LOOKUP',
                error: 'No finalized matches with FantasyMatchPlayerStats found',
                suggestion: 'Run test harness or create match data first',
                details: { total_matches: allMatches.length }
            }, { status: 404 });
        }

        const matchId = targetMatch.id;
        const phase = targetMatch.phase;

        // Step 3: Check if squad already exists
        const existingSquads = await base44.asServiceRole.entities.FantasySquad.filter({
            user_id: testUser.id,
            phase
        });

        let squad;
        if (existingSquads.length > 0 && existingSquads[0].status === 'FINAL') {
            squad = existingSquads[0];
        } else {
            // Delete draft squads if any
            for (const s of existingSquads) {
                if (s.status === 'DRAFT') {
                    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
                        squad_id: s.id 
                    });
                    for (const sp of squadPlayers) {
                        await base44.asServiceRole.entities.FantasySquadPlayer.delete(sp.id);
                    }
                    await base44.asServiceRole.entities.FantasySquad.delete(s.id);
                }
            }

            // Create new squad
            squad = await base44.asServiceRole.entities.FantasySquad.create({
                user_id: testUser.id,
                phase,
                status: 'FINAL',
                budget_cap: 150,
                total_cost: 0,
                finalized_at: new Date().toISOString()
            });
        }

        // Step 4: Populate squad players (if not already done)
        const existingSquadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
            squad_id: squad.id
        });

        let playersAdded = 0;

        if (existingSquadPlayers.length === 0) {
            // Load all players to get positions
            const allPlayers = await base44.asServiceRole.entities.Player.list();
            const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

            // Add each player from stats as starter
            for (const stat of matchStats) {
                const player = playersMap[stat.player_id];
                if (player) {
                    await base44.asServiceRole.entities.FantasySquadPlayer.create({
                        squad_id: squad.id,
                        player_id: stat.player_id,
                        slot_type: 'STARTER',
                        starter_position: player.position
                    });
                    playersAdded++;
                }
            }
        } else {
            playersAdded = existingSquadPlayers.length;
        }

        // Step 5: Check if scoring job already exists
        const dedupeKey = `FANTASY:MATCH:${matchId}:v1`;
        const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({
            dedupe_key: dedupeKey
        });

        let scoringResult = null;
        let jobCreated = false;

        if (existingJobs.length === 0) {
            // Create scoring job
            await base44.asServiceRole.entities.ScoringJob.create({
                mode: 'FANTASY',
                source_type: 'MATCH',
                source_id: `MATCH:${matchId}`,
                version: 1,
                dedupe_key: dedupeKey,
                status: 'PENDING'
            });
            jobCreated = true;

            // Execute scoring directly
            scoringResult = await base44.asServiceRole.functions.invoke('fantasyScoringService', {
                action: 'score_fantasy_match',
                match_id: matchId
            });
        } else {
            scoringResult = { 
                data: { 
                    status: 'ALREADY_SCORED', 
                    job_status: existingJobs[0].status 
                } 
            };
        }

        // Step 6: Check ledger entries
        const ledgerEntries = await base44.asServiceRole.entities.PointsLedger.filter({
            user_id: testUser.id,
            mode: 'FANTASY'
        });

        const matchLedgerEntries = ledgerEntries.filter(e => {
            try {
                const breakdown = JSON.parse(e.breakdown_json);
                return breakdown.match_id === matchId && breakdown.type === 'AWARD';
            } catch {
                return false;
            }
        });

        const totalPoints = matchLedgerEntries.reduce((sum, e) => sum + e.points, 0);

        return Response.json({
            success: true,
            test_mode: isTestMode,
            test_run_id: isTestMode ? testRunId : undefined,
            match_id: matchId,
            match_phase: phase,
            squad_id: squad.id,
            user_id: testUser.id,
            user_email: testUser.email,
            players_added: playersAdded,
            scoring_job_created: jobCreated,
            scoring_result: scoringResult?.data || {},
            fantasy_ledger_entries_created: matchLedgerEntries.length,
            total_points: totalPoints,
            message: jobCreated 
                ? 'New squad created and scored successfully' 
                : 'Squad already exists and was previously scored (idempotent)'
        });

    } catch (error) {
        console.error('Dev Fantasy Test Setup error:', error);
        return Response.json({ 
            step: 'UNKNOWN',
            error: error.message,
            details: { stack: error.stack }
        }, { status: 500 });
    }
});