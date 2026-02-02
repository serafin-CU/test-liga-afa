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
                    ok: false,
                    code: 'UNAUTHORIZED',
                    message: 'Admin access required',
                    hint: 'Only admin users can run Dev Fantasy Setup.',
                    details: { role: currentUser?.role }
                }, { status: 200 });
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
                    ok: false,
                    code: 'NO_ADMIN_USER',
                    message: 'No admin user found for test mode',
                    hint: 'Create at least one admin user to run Dev Fantasy Setup in test mode.',
                    details: { isTestMode, total_users: allUsers.length }
                }, { status: 200 });
            }
        }

        // Step 2: Find or create finalized match with stats
        const allMatches = await base44.asServiceRole.entities.Match.filter({ status: 'FINAL' });
        const sortedMatches = allMatches.sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

        let targetMatch = sortedMatches[0];
        let matchStats = [];

        if (!targetMatch) {
            return Response.json({ 
                ok: false,
                code: 'NO_FINALIZED_MATCH',
                message: 'No finalized matches found',
                hint: 'Create at least one match with status=FINAL. Use Admin Match Validation page or run automated tests.',
                details: { total_matches: allMatches.length }
            }, { status: 200 });
        }

        const matchId = targetMatch.id;
        const phase = targetMatch.phase;

        // Load or seed stats
        matchStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
            match_id: matchId 
        });

        // Step 2b: Seed full lineup if requested and no stats exist
        if (seedFullLineup && matchStats.length === 0) {
            // Get or create 22 players (11 per team)
            const homeTeamData = await base44.asServiceRole.entities.Team.get(targetMatch.home_team_id);
            const awayTeamData = await base44.asServiceRole.entities.Team.get(targetMatch.away_team_id);
            
            const homeTeamCode = homeTeamData.fifa_code || 'HOM';
            const awayTeamCode = awayTeamData.fifa_code || 'AWY';

            // Define 11 positions per team
            const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
            
            const ensurePlayersForTeam = async (teamId, teamCode) => {
                const existingPlayers = await base44.asServiceRole.entities.Player.filter({ team_id: teamId });
                const players = [];

                for (let i = 0; i < 11; i++) {
                    const position = positions[i];
                    const playerName = `Test ${teamCode} ${position}${i + 1}`;
                    
                    // Check if player already exists
                    let player = existingPlayers.find(p => p.full_name === playerName);
                    
                    if (!player) {
                        // Create new player
                        player = await base44.asServiceRole.entities.Player.create({
                            full_name: playerName,
                            team_id: teamId,
                            position: position,
                            price: position === 'GK' ? 5 : (position === 'DEF' ? 6 : (position === 'MID' ? 8 : 10))
                        });
                    }
                    
                    players.push(player);
                }
                
                return players;
            };

            // Ensure players exist for both teams
            const homeTeamPlayers = await ensurePlayersForTeam(targetMatch.home_team_id, homeTeamCode);
            const awayTeamPlayers = await ensurePlayersForTeam(targetMatch.away_team_id, awayTeamCode);

            // Create stats for home team (2 goals by FWD, 1 yellow by MID)
            for (let i = 0; i < homeTeamPlayers.length; i++) {
                const player = homeTeamPlayers[i];
                await base44.asServiceRole.entities.FantasyMatchPlayerStats.create({
                    match_id: matchId,
                    player_id: player.id,
                    team_id: targetMatch.home_team_id,
                    started: true,
                    substituted_in: false,
                    substituted_out: false,
                    minute_in: null,
                    minute_out: null,
                    minutes_played: 90,
                    goals: (i === 8) ? 2 : 0, // FWD1 scores 2 goals
                    yellow_cards: (i === 5) ? 1 : 0, // MID1 gets yellow card
                    red_cards: 0,
                    source: 'PROMIEDOS'
                });
            }

            // Create stats for away team (1 goal by FWD)
            for (let i = 0; i < awayTeamPlayers.length; i++) {
                const player = awayTeamPlayers[i];
                await base44.asServiceRole.entities.FantasyMatchPlayerStats.create({
                    match_id: matchId,
                    player_id: player.id,
                    team_id: targetMatch.away_team_id,
                    started: true,
                    substituted_in: false,
                    substituted_out: false,
                    minute_in: null,
                    minute_out: null,
                    minutes_played: 90,
                    goals: (i === 8) ? 1 : 0, // FWD1 scores 1 goal
                    yellow_cards: 0,
                    red_cards: 0,
                    source: 'PROMIEDOS'
                });
            }

            // Reload stats
            matchStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
                match_id: matchId 
            });
        }

        if (matchStats.length === 0) {
            return Response.json({ 
                ok: false,
                code: 'NO_STATS',
                message: 'No stats available and seedFullLineup was disabled or failed',
                hint: 'Enable seedFullLineup=true or manually create FantasyMatchPlayerStats for the target match.',
                details: { matchId, seedFullLineup }
            }, { status: 200 });
        }

        // Step 2c: Ensure MatchResultFinal exists (DEV-ONLY auto-finalization)
        let matchResultFinalCreated = false;
        const existingMatchResults = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: matchId });
        
        if (existingMatchResults.length === 0) {
            // Calculate goals from stats
            const homeGoals = matchStats
                .filter(s => s.team_id === targetMatch.home_team_id)
                .reduce((sum, s) => sum + (s.goals || 0), 0);
            
            const awayGoals = matchStats
                .filter(s => s.team_id === targetMatch.away_team_id)
                .reduce((sum, s) => sum + (s.goals || 0), 0);

            // Create MatchResultFinal
            await base44.asServiceRole.entities.MatchResultFinal.create({
                match_id: matchId,
                home_goals: homeGoals,
                away_goals: awayGoals,
                finalized_at: new Date().toISOString()
            });

            // Set Match.status = FINAL
            await base44.asServiceRole.entities.Match.update(matchId, { status: 'FINAL' });
            
            matchResultFinalCreated = true;
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
            match_result_final_created: matchResultFinalCreated,
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
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            hint: 'Check server logs for details. This may be a database error or missing data.',
            details: { 
                stack: error.stack,
                name: error.name
            }
        }, { status: 200 });
    }
});