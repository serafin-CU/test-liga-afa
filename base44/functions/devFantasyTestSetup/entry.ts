import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEV Fantasy Test Setup
 * Creates a test user, squad, and runs fantasy scoring for validation
 */

/**
 * Ensure match has enough stats rows for 4-3-3 formation
 * Creates/updates stats to guarantee 1 GK, 4 DEF, 3 MID, 3 FWD with minutes_played = 90
 */
async function ensureMatchHasFormationStats(base44, match_id, home_team_id, away_team_id) {
    const existingStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id });
    const statsMap = Object.fromEntries(existingStats.map(s => [s.player_id, s]));
    
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const homeTeamPlayers = allPlayers.filter(p => p.team_id === home_team_id);
    const awayTeamPlayers = allPlayers.filter(p => p.team_id === away_team_id);
    
    const requiredFormation = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
    const updatedStats = [];
    const createdStats = [];
    
    // For each team, ensure we have the required positions
    for (const teamPlayers of [homeTeamPlayers, awayTeamPlayers]) {
        const teamId = teamPlayers[0]?.team_id;
        if (!teamId) continue;
        
        const playersByPos = { GK: [], DEF: [], MID: [], FWD: [] };
        for (const player of teamPlayers) {
            playersByPos[player.position].push(player);
        }
        
        // Ensure each position has enough players with minutes = 90
        for (const [pos, required] of Object.entries(requiredFormation)) {
            const posPlayers = playersByPos[pos] || [];
            
            for (let i = 0; i < required && i < posPlayers.length; i++) {
                const player = posPlayers[i];
                const existingStat = statsMap[player.id];
                
                if (existingStat) {
                    // Update if minutes are 0
                    if (existingStat.minutes_played === 0) {
                        await base44.asServiceRole.entities.FantasyMatchPlayerStats.update(existingStat.id, {
                            minutes_played: 90,
                            minute_out: 90
                        });
                        updatedStats.push(player.id);
                    }
                } else {
                    // Create new stat
                    await base44.asServiceRole.entities.FantasyMatchPlayerStats.create({
                        match_id,
                        player_id: player.id,
                        team_id: teamId,
                        started: true,
                        substituted_in: false,
                        substituted_out: false,
                        minute_in: null,
                        minute_out: 90,
                        minutes_played: 90,
                        goals: 0,
                        yellow_cards: 0,
                        red_cards: 0,
                        source: 'MANUAL'
                    });
                    createdStats.push(player.id);
                }
            }
        }
    }
    
    return {
        updated_count: updatedStats.length,
        created_count: createdStats.length,
        updated_player_ids: updatedStats,
        created_player_ids: createdStats
    };
}

/**
 * Validates a fantasy squad's starters configuration
 * @param {boolean} isDevBaseline - If true, skip minutes_played validation (for baseline squad creation)
 * @returns {ok: boolean, error?: {code, message, hint, details}}
 */
async function validateFantasySquad(base44, squad_id, isDevBaseline = false) {
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id });

    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    const bench = squadPlayers.filter(sp => sp.slot_type === 'BENCH');

    // Check for duplicate players
    const allPlayerIds = squadPlayers.map(sp => sp.player_id);
    const uniquePlayerIds = [...new Set(allPlayerIds)];
    if (allPlayerIds.length !== uniquePlayerIds.length) {
        return {
            ok: false,
            error: {
                code: 'DUPLICATE_PLAYER_IN_SQUAD',
                message: 'Squad contains duplicate players',
                hint: 'Each player can only appear once in a squad (either as STARTER or BENCH).',
                details: { squad_id, total_players: allPlayerIds.length, unique_players: uniquePlayerIds.length }
            }
        };
    }

    // Validate exactly 11 starters
    if (starters.length !== 11) {
        return {
            ok: false,
            error: {
                code: 'INVALID_STARTERS_COUNT',
                message: `Squad has ${starters.length} starters, must have exactly 11`,
                hint: 'Ensure the squad has exactly 11 FantasySquadPlayer records with slot_type=STARTER.',
                details: { squad_id, starters_count: starters.length, bench_count: bench.length }
            }
        };
    }

    // Load player data for position validation
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

    // Count positions in starters
    const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const starter of starters) {
        const player = playersMap[starter.player_id];
        if (player) {
            positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
        }
    }

    // Validate strict 4-3-3 formation
    const errors = [];
    if (positionCounts.GK !== 1) {
        errors.push(`GK: ${positionCounts.GK} (must be exactly 1)`);
    }
    if (positionCounts.DEF !== 4) {
        errors.push(`DEF: ${positionCounts.DEF} (must be exactly 4)`);
    }
    if (positionCounts.MID !== 3) {
        errors.push(`MID: ${positionCounts.MID} (must be exactly 3)`);
    }
    if (positionCounts.FWD !== 3) {
        errors.push(`FWD: ${positionCounts.FWD} (must be exactly 3)`);
    }

    if (errors.length > 0) {
        const formationString = `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;
        return {
            ok: false,
            error: {
                code: 'INVALID_FORMATION',
                message: `Invalid formation: GK=${positionCounts.GK}, ${formationString}`,
                hint: 'Formation must be exactly: 1 GK, 4 DEF, 3 MID, 3 FWD (4-3-3).',
                details: { 
                    squad_id, 
                    formation: formationString,
                    position_counts: positionCounts,
                    violations: errors
                }
            }
        };
    }

    // Validate captain
    const captains = starters.filter(sp => sp.is_captain);
    if (captains.length === 0) {
        return {
            ok: false,
            error: {
                code: 'CAPTAIN_REQUIRED',
                message: 'Squad has no captain',
                hint: 'Exactly one STARTER must be designated as captain.',
                details: { squad_id, captain_count: 0 }
            }
        };
    }
    if (captains.length > 1) {
        return {
            ok: false,
            error: {
                code: 'MULTIPLE_CAPTAINS',
                message: `Squad has ${captains.length} captains, must have exactly 1`,
                hint: 'Exactly one STARTER must be designated as captain.',
                details: { squad_id, captain_count: captains.length }
            }
        };
    }

    return { ok: true, positionCounts, isDevBaseline };
}

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

        // Step 2: Find or create finalized match with 22+ stats
        const allMatches = await base44.asServiceRole.entities.Match.filter({ status: 'FINAL' });
        const sortedMatches = allMatches.sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at));

        let targetMatch = null;
        let matchStats = [];

        // Find a match with 22+ stats (full lineup)
        for (const match of sortedMatches) {
            const stats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ 
                match_id: match.id 
            });
            if (stats.length >= 22) {
                targetMatch = match;
                matchStats = stats;
                break;
            }
        }

        // If no suitable match found, create a new dev test match
        if (!targetMatch || matchStats.length < 22) {
            const devRunId = `dev_${Date.now()}`;
            
            // Create test teams
            const homeTeam = await base44.asServiceRole.entities.Team.create({
                name: `DEV Home ${devRunId}`,
                fifa_code: 'DHM',
                is_qualified: true
            });
            
            const awayTeam = await base44.asServiceRole.entities.Team.create({
                name: `DEV Away ${devRunId}`,
                fifa_code: 'DAW',
                is_qualified: true
            });
            
            // Create match
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 2);
            
            targetMatch = await base44.asServiceRole.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: pastDate.toISOString(),
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                status: 'FINAL'
            });
            
            matchStats = [];
        }

        const matchId = targetMatch.id;
        const phase = targetMatch.phase;

        // Step 2b: Seed full lineup if requested and no stats exist
        // Step 2a: Ensure match has enough stats for formation (DEV MODE)
        const statsEnsureResult = await ensureMatchHasFormationStats(
            base44, 
            matchId, 
            targetMatch.home_team_id, 
            targetMatch.away_team_id
        );

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

        // Step 3: Check if squad already exists - ALWAYS normalize it
        const existingSquads = await base44.asServiceRole.entities.FantasySquad.filter({
            user_id: testUser.id,
            phase
        });

        let squad;
        if (existingSquads.length > 0 && existingSquads[0].status === 'FINAL') {
            squad = existingSquads[0];
            
            // Normalize: delete all existing squad players to rebuild deterministically
            const oldSquadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
                squad_id: squad.id 
            });
            for (const sp of oldSquadPlayers) {
                await base44.asServiceRole.entities.FantasySquadPlayer.delete(sp.id);
            }
        } else {
            // Delete draft squads if any
            for (const s of existingSquads) {
                const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
                    squad_id: s.id 
                });
                for (const sp of squadPlayers) {
                    await base44.asServiceRole.entities.FantasySquadPlayer.delete(sp.id);
                }
                await base44.asServiceRole.entities.FantasySquad.delete(s.id);
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

        // Step 4: Build deterministic squad with strict 4-3-3 formation
        const allPlayers = await base44.asServiceRole.entities.Player.list();
        const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

        // Identify goal scorers from stats
        const goalScorers = new Set(matchStats.filter(s => s.goals > 0).map(s => s.player_id));

        // Categorize all available players by position
        const availableByPosition = { GK: [], DEF: [], MID: [], FWD: [] };
        for (const stat of matchStats) {
            const player = playersMap[stat.player_id];
            if (!player || stat.minutes_played === 0) continue;
            availableByPosition[player.position].push(stat.player_id);
        }

        // Sort each position: goal scorers first, then by player_id for determinism
        for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
            availableByPosition[pos].sort((a, b) => {
                const aIsGoalScorer = goalScorers.has(a);
                const bIsGoalScorer = goalScorers.has(b);
                if (aIsGoalScorer && !bIsGoalScorer) return -1;
                if (!aIsGoalScorer && bIsGoalScorer) return 1;
                return a.localeCompare(b);
            });
        }

        // Strict 4-3-3 formation
        const requiredFormation = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

        // Build finalStarters with strict counts
        const finalStarters = [];
        for (const [pos, required] of Object.entries(requiredFormation)) {
            const available = availableByPosition[pos];
            if (available.length < required) {
                return Response.json({
                    ok: false,
                    code: 'DEV_SETUP_INVALID_FORMATION',
                    message: `Not enough ${pos} players with minutes > 0`,
                    hint: `Need ${required} ${pos}, but only ${available.length} available in match stats.`,
                    details: { 
                        match_id: matchId,
                        position: pos,
                        required,
                        available: available.length
                    }
                }, { status: 200 });
            }
            finalStarters.push(...available.slice(0, required));
        }
        
        // Create STARTER entries - assign captain to a goal scorer if available, otherwise first
        let playersAdded = 0;
        let captainAssigned = false;

        // Find a goal scorer among starters
        const goalScorerInStarters = finalStarters.find(playerId => {
            const stat = matchStats.find(s => s.player_id === playerId);
            return stat && stat.goals > 0;
        });

        const captainPlayerId = goalScorerInStarters || finalStarters[0];

        for (let i = 0; i < finalStarters.length; i++) {
            const playerId = finalStarters[i];
            const player = playersMap[playerId];
            if (player) {
                await base44.asServiceRole.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: playerId,
                    slot_type: 'STARTER',
                    starter_position: player.position,
                    is_captain: playerId === captainPlayerId
                });
                playersAdded++;
                if (playerId === captainPlayerId) captainAssigned = true;
            }
        }
        
        // Create EXACTLY 3 bench players (one DEF, one MID with minutes > 0 for auto-sub, one FWD)
        const starterSet = new Set(finalStarters);
        const benchPositions = ['DEF', 'MID', 'FWD'];
        const benchPlayersCreated = [];
        
        for (let i = 0; i < benchPositions.length; i++) {
            const pos = benchPositions[i];
            const availableBench = matchStats
                .filter(s => {
                    const player = playersMap[s.player_id];
                    return player && player.position === pos && !starterSet.has(s.player_id) && s.minutes_played > 0;
                })
                .sort((a, b) => a.player_id.localeCompare(b.player_id)); // Deterministic
            
            if (availableBench.length > 0) {
                const benchStat = availableBench[0];
                const player = playersMap[benchStat.player_id];
                
                await base44.asServiceRole.entities.FantasySquadPlayer.create({
                    squad_id: squad.id,
                    player_id: benchStat.player_id,
                    slot_type: 'BENCH',
                    bench_order: i + 1,
                    starter_position: null,
                    is_captain: false
                });
                
                benchPlayersCreated.push(benchStat.player_id);
                starterSet.add(benchStat.player_id); // Prevent reuse
            }
        }
        
        // Force DNP scenario: Set first MID starter to have 0 minutes
        const midStarterIds = finalStarters.filter(pid => {
            const player = playersMap[pid];
            return player && player.position === 'MID';
        });

        let dnpPlayerId = null;
        if (midStarterIds.length > 0) {
            dnpPlayerId = midStarterIds[0];
            const targetStat = matchStats.find(s => s.player_id === dnpPlayerId);

            if (targetStat) {
                await base44.asServiceRole.entities.FantasyMatchPlayerStats.update(targetStat.id, {
                    minutes_played: 0,
                    minute_in: null,
                    minute_out: 0,
                    substituted_in: false,
                    substituted_out: false,
                    started: true
                });
            }
        }
        
        // Validate the created squad (dev mode: skip minutes_played requirement)
        const validation = await validateFantasySquad(base44, squad.id, true);
        if (!validation.ok) {
            return Response.json({
                ...validation.error,
                ok: false
            }, { status: 200 });
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
            // Create void entries if force re-scoring (only if previous awards > 0)
            if (force && priorEntriesForMatch.length > 0) {
                const voidsByUser = {};
                for (const entry of priorEntriesForMatch) {
                    voidsByUser[entry.user_id] = (voidsByUser[entry.user_id] || 0) + entry.points;
                }

                for (const [user_id, totalPoints] of Object.entries(voidsByUser)) {
                    // Only create VOID if there were actual points to void
                    if (totalPoints > 0) {
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

                // Base minutes points
                if (minutes >= 60) playerPoints += 1;

                // Goals by position (align with fantasyScoringService)
                if (player.position === 'FWD') playerPoints += goals * 4;
                else if (player.position === 'MID') playerPoints += goals * 5;
                else if (player.position === 'DEF' || player.position === 'GK') playerPoints += goals * 6;

                // Cards
                playerPoints += yellowCards * -1;
                playerPoints += redCards * -3;

                // Apply captain multiplier (2x only to captain)
                let multiplier = 1;
                const isCaptain = sp.is_captain;
                
                if (isCaptain) {
                    multiplier = 2;
                }

                const finalPoints = playerPoints * multiplier;
                totalPoints += finalPoints;

                perPlayerDetails.push({
                    player_id: sp.player_id,
                    player_name: player.full_name,
                    position: player.position,
                    minutes,
                    goals,
                    yellow_cards: yellowCards,
                    red_cards: redCards,
                    base_points: playerPoints,
                    multiplier,
                    points: finalPoints,
                    is_captain: isCaptain
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

        // Build match label for UI
        const homeTeamData = await base44.asServiceRole.entities.Team.get(targetMatch.home_team_id);
        const awayTeamData = await base44.asServiceRole.entities.Team.get(targetMatch.away_team_id);
        const homeName = homeTeamData.fifa_code || homeTeamData.name;
        const awayName = awayTeamData.fifa_code || awayTeamData.name;
        const date = new Date(targetMatch.kickoff_at).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const matchLabel = `${date}  ${homeName} vs ${awayName} (${phase}) · ${matchId.slice(-8)}`;

        // Count starters for this squad
        const finalSquadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
            squad_id: squad.id
        });
        const startersCount = finalSquadPlayers.filter(sp => sp.slot_type === 'STARTER').length;
        const benchCount = finalSquadPlayers.filter(sp => sp.slot_type === 'BENCH').length;
        
        // Re-fetch stats to get updated DNP values
        const allStatsAfter = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id: matchId });
        const statsMapAfter = Object.fromEntries(allStatsAfter.map(s => [s.player_id, s]));
        
        const dnpStarters = finalSquadPlayers.filter(sp => {
            if (sp.slot_type !== 'STARTER') return false;
            const stat = statsMapAfter[sp.player_id];
            return stat && stat.minutes_played === 0;
        });
        
        const dnpStarterPlayerIds = dnpStarters.map(sp => sp.player_id);
        const benchPlayerIds = finalSquadPlayers.filter(sp => sp.slot_type === 'BENCH')
            .sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0))
            .map(sp => sp.player_id);
        
        const goalScorersCount = goalScorers.size;
        const goalScorersInStarters = Array.from(goalScorers).filter(gId => finalStarters.includes(gId)).length;

        // Count stats by position for diagnostics
        const statsByPosition = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        const statsWithMinutesByPosition = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const stat of matchStats) {
            const player = playersMap[stat.player_id];
            if (player) {
                statsByPosition[player.position] = (statsByPosition[player.position] || 0) + 1;
                if (stat.minutes_played > 0) {
                    statsWithMinutesByPosition[player.position] = (statsWithMinutesByPosition[player.position] || 0) + 1;
                }
            }
        }
        
        // Get formation details
        const starterPositionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const sp of finalSquadPlayers.filter(sp => sp.slot_type === 'STARTER')) {
            const player = playersMap[sp.player_id];
            if (player) {
                starterPositionCounts[player.position] = (starterPositionCounts[player.position] || 0) + 1;
            }
        }
        const formationString = `${starterPositionCounts.GK}-${starterPositionCounts.DEF}-${starterPositionCounts.MID}-${starterPositionCounts.FWD}`;

        return Response.json({
            ok: true,
            test_mode: isTestMode,
            test_run_id: isTestMode ? testRunId : undefined,
            match_id: matchId,
            match_label: matchLabel,
            match_phase: phase,
            match_result_final_created: matchResultFinalCreated,
            squad_id: squad.id,
            user_id: testUser.id,
            user_email: testUser.email,
            stats_count: matchStats.length,
            stats_by_position: statsByPosition,
            stats_with_minutes_by_position: statsWithMinutesByPosition,
            stats_ensure_result: statsEnsureResult,
            starters_count: startersCount,
            bench_count: benchCount,
            dnp_starters_count: dnpStarters.length,
            dnp_starter_player_ids: dnpStarterPlayerIds,
            dnp_player_id: dnpPlayerId,
            bench_player_ids: benchPlayerIds,
            formation: formationString,
            position_counts: starterPositionCounts,
            goal_scorers_count: goalScorersCount,
            goal_scorers_in_starters_count: goalScorersInStarters,
            players_added: playersAdded + benchCount,
            scoring_result: scoringResult?.data || {},
            ledger_entries_created: matchLedgerEntries.length,
            award_entries: awardEntries.length,
            total_points: totalPoints,
            sample_ledger_rows: sampleLedgerRows,
            message: force 
                ? 'Force re-score completed'
                : 'Baseline squad created without stats dependency (dev mode)'
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