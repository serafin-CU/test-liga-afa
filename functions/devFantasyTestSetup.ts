import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEV Fantasy Test Setup
 * Creates a test user, squad, and runs fantasy scoring for validation
 */

Deno.serve(async (req) => {
    const testRunId = `dev_test_${Date.now()}`;
    
    try {
        const body = await req.json().catch(() => ({}));
        const { force = false, seedFullLineup = true } = body;
        
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

        // Step 2: Find or create finalized match with stats
        const allMatches = await base44.asServiceRole.entities.Match.filter({ status: 'FINAL' });
        const sortedMatches = allMatches.sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

        let targetMatch = sortedMatches[0];
        let matchStats = [];

        if (!targetMatch) {
            return Response.json({ 
                step: 'MATCH_LOOKUP',
                error: 'No finalized matches found',
                suggestion: 'Run test harness to create match data first',
                details: { total_matches: allMatches.length }
            }, { status: 404 });
        }

        const matchId = targetMatch.id;
        const phase = targetMatch.phase;

        // Load or seed stats
        matchStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
            match_id: matchId 
        });

        // Step 2b: Seed full lineup if requested and no stats exist
        if (seedFullLineup && matchStats.length === 0) {
            const allPlayers = await base44.asServiceRole.entities.Player.list();
            const homeTeamPlayers = allPlayers.filter(p => p.team_id === targetMatch.home_team_id).slice(0, 11);
            const awayTeamPlayers = allPlayers.filter(p => p.team_id === targetMatch.away_team_id).slice(0, 11);

            const createPlayerStats = async (players, teamId, goals = 0, yellows = 0, reds = 0) => {
                for (let i = 0; i < players.length; i++) {
                    const player = players[i];
                    const isSubIn = i >= 8; // Last 3 are subs

                    await base44.asServiceRole.entities.FantasyMatchPlayerStats.create({
                        match_id: matchId,
                        player_id: player.id,
                        team_id: teamId,
                        started: !isSubIn,
                        substituted_in: isSubIn,
                        substituted_out: false,
                        minute_in: isSubIn ? 60 : null,
                        minute_out: null,
                        minutes_played: isSubIn ? 30 : 90,
                        goals: (i === 8 && goals > 0) ? goals : 0, // FWD gets goals
                        yellow_cards: (i === 3 && yellows > 0) ? 1 : 0, // One DEF gets yellow
                        red_cards: (i === 5 && reds > 0) ? 1 : 0, // One MID gets red
                        source: 'MANUAL'
                    });
                }
            };

            // Seed home team (2 goals, 1 yellow)
            await createPlayerStats(homeTeamPlayers, targetMatch.home_team_id, 2, 1, 0);
            // Seed away team (1 goal)
            await createPlayerStats(awayTeamPlayers, targetMatch.away_team_id, 1, 0, 0);

            // Reload stats
            matchStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
                match_id: matchId 
            });
        }

        if (matchStats.length === 0) {
            return Response.json({ 
                step: 'STATS_SEED',
                error: 'No stats available and seedFullLineup was disabled or failed',
                details: { matchId, seedFullLineup }
            }, { status: 404 });
        }

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

        // Step 5: Check if scoring already done (unless force=true)
        const allLedger = await base44.asServiceRole.entities.PointsLedger.list();
        const priorEntriesForMatch = allLedger.filter(e => {
            if (e.mode !== 'FANTASY') return false;
            try {
                const breakdown = JSON.parse(e.breakdown_json);
                return breakdown.match_id === matchId && breakdown.type === 'AWARD';
            } catch {
                return false;
            }
        });

        let scoringResult;

        // If already scored and not forcing, use existing results
        if (!force && priorEntriesForMatch.length > 0) {
            scoringResult = {
                data: {
                    status: 'ALREADY_SCORED',
                    message: 'Match already scored (use force=true to re-score)',
                    existing_awards: priorEntriesForMatch.length
                }
            };
        } else {
            // Create void entries if force re-scoring
            if (force && priorEntriesForMatch.length > 0) {
                const voidsByUser = {};
                for (const entry of priorEntriesForMatch) {
                    voidsByUser[entry.user_id] = (voidsByUser[entry.user_id] || 0) + entry.points;
                }

                for (const [user_id, totalPoints] of Object.entries(voidsByUser)) {
                    await base44.asServiceRole.entities.PointsLedger.create({
                        user_id,
                        mode: 'FANTASY',
                        source_type: 'FANTASY_MATCH',
                        source_id: matchId,
                        points: -totalPoints,
                        breakdown_json: JSON.stringify({
                            type: 'VOID',
                            match_id: matchId,
                            phase,
                            reason: 'Force re-score from devFantasyTestSetup',
                            voided_points: totalPoints,
                            timestamp: new Date().toISOString()
                        })
                    });
                }
            }

            // Write new scoring entries (simplified inline scoring)
            const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
                squad_id: squad.id,
                slot_type: 'STARTER'
            });

            let totalPoints = 0;
            const perPlayerDetails = [];

            for (const sp of squadPlayers) {
                const player = (await base44.asServiceRole.entities.Player.list()).find(p => p.id === sp.player_id);
                if (!player) continue;

                const stat = matchStats.find(s => s.player_id === sp.player_id);
                const minutes = stat?.minutes_played || 0;
                const goals = stat?.goals || 0;
                const yellowCards = stat?.yellow_cards || 0;
                const redCards = stat?.red_cards || 0;

                let playerPoints = 0;

                // Goals by position
                if (player.position === 'FWD') playerPoints += goals * 5;
                else if (player.position === 'MID') playerPoints += goals * 6;
                else if (player.position === 'DEF') playerPoints += goals * 7;
                else if (player.position === 'GK') playerPoints += goals * 7;

                // Cards
                playerPoints += yellowCards * -1;
                playerPoints += redCards * -3;

                // Minutes
                if (minutes >= 60) playerPoints += 2;
                else if (minutes >= 1) playerPoints += 1;

                totalPoints += playerPoints;

                perPlayerDetails.push({
                    player_id: sp.player_id,
                    player_name: player.full_name,
                    position: player.position,
                    minutes,
                    goals,
                    yellow_cards: yellowCards,
                    red_cards: redCards,
                    points: playerPoints
                });
            }

            // Write ledger entry
            await base44.asServiceRole.entities.PointsLedger.create({
                user_id: testUser.id,
                mode: 'FANTASY',
                source_type: 'FANTASY_MATCH',
                source_id: matchId,
                points: totalPoints,
                breakdown_json: JSON.stringify({
                    type: 'AWARD',
                    scoring_version: 'v1',
                    match_id: matchId,
                    phase,
                    squad_id: squad.id,
                    per_player: perPlayerDetails,
                    totals: {
                        squad_points: totalPoints,
                        starters_count: squadPlayers.length
                    },
                    timestamp: new Date().toISOString()
                })
            });

            scoringResult = {
                data: {
                    status: 'SUCCESS',
                    users_scored: 1,
                    total_points: totalPoints,
                    forced: force
                }
            };
        }

        // Step 6: Query ALL ledger entries for this match (all modes starting with FANTASY)
        const allLedgerEntries = await base44.asServiceRole.entities.PointsLedger.list();
        
        const matchLedgerEntries = allLedgerEntries.filter(e => {
            // Include any mode starting with FANTASY
            if (!e.mode?.startsWith('FANTASY')) return false;
            
            // Check if source_id matches or breakdown contains this match_id
            if (e.source_id && e.source_id.includes(matchId)) return true;
            
            try {
                const breakdown = JSON.parse(e.breakdown_json);
                return breakdown.match_id === matchId;
            } catch {
                return false;
            }
        });

        const awardEntries = matchLedgerEntries.filter(e => {
            try {
                const breakdown = JSON.parse(e.breakdown_json);
                return breakdown.type === 'AWARD';
            } catch {
                return true; // Include if no breakdown
            }
        });

        const totalPoints = awardEntries.reduce((sum, e) => sum + e.points, 0);
        
        // Get sample ledger rows (first 5)
        const sampleLedgerRows = matchLedgerEntries.slice(0, 5).map(e => ({
            id: e.id,
            user_id: e.user_id,
            mode: e.mode,
            source_type: e.source_type,
            source_id: e.source_id,
            points: e.points,
            created_date: e.created_date
        }));

        return Response.json({
            ok: true,
            test_mode: isTestMode,
            test_run_id: isTestMode ? testRunId : undefined,
            match_id: matchId,
            match_phase: phase,
            squad_id: squad.id,
            user_id: testUser.id,
            user_email: testUser.email,
            stats_count: matchStats.length,
            players_added: playersAdded,
            scoring_result: scoringResult?.data || {},
            ledger_entries_created: matchLedgerEntries.length,
            award_entries: awardEntries.length,
            total_points: totalPoints,
            sample_ledger_rows: sampleLedgerRows,
            message: force 
                ? 'Force re-score completed'
                : 'Squad created and scored (or already exists)'
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