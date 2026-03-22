import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fantasy Scoring Service
 * Computes fantasy points from FantasyMatchPlayerStats and writes to PointsLedger
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ 
                status: 'ERROR',
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            }, { status: 401 });
        }

        const { action, match_id, force } = await req.json();

        if (action === 'score_fantasy_match') {
            const result = await scoreFantasyMatch(base44, match_id, force || false);
            return Response.json(result);
        }

        return Response.json({ 
            status: 'ERROR',
            code: 'INVALID_ACTION',
            message: 'Invalid action specified'
        }, { status: 400 });

    } catch (error) {
        console.error('Fantasy scoring service error:', error);
        return Response.json({ 
            ok: false,
            code: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            hint: 'Check server logs for details. This may be a database error or configuration issue.',
            details: {
                name: error.name,
                stack: error.stack
            }
        }, { status: 200 });
    }
});

/**
 * Validates a fantasy squad's starters configuration
 * @returns {ok: boolean, error?: {code, message, hint, details}}
 */
async function validateFantasySquad(base44, squad_id) {
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
    
    return { ok: true, positionCounts };
}

async function scoreFantasyMatch(base44, match_id, force = false) {
    // Load match and result
    const match = await base44.asServiceRole.entities.Match.get(match_id);
    if (!match) {
        return {
            ok: false,
            code: 'MATCH_NOT_FOUND',
            message: 'Match not found in database',
            hint: 'Verify the match_id is correct and the match exists.',
            details: { match_id }
        };
    }

    const matchResults = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id });
    if (matchResults.length === 0) {
        return {
            ok: false,
            code: 'MATCH_NOT_FINALIZED',
            message: 'MatchResultFinal not found - match not finalized',
            hint: 'Finalize the match (create MatchResultFinal) before scoring. Run Dev Fantasy Setup to auto-create it for dev/test matches.',
            details: { match_id, finalized: false }
        };
    }
    const matchResult = matchResults[0];

    // Load fantasy stats
    const allStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id });
    if (allStats.length === 0) {
        return { 
            ok: false,
            code: 'NO_STATS',
            message: 'No FantasyMatchPlayerStats found for this match',
            hint: 'Run Dev Fantasy Setup first, or ensure FantasyMatchPlayerStats exist for this match.',
            details: { match_id, finalized: true, stats_count: 0 }
        };
    }

    const statsMap = Object.fromEntries(allStats.map(s => [s.player_id, s]));
    
    // Load all players for position lookup
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

    // Simplified scoring rules for validation
    const rules = {
        points_goal_fwd: 4,
        points_goal_mid: 5,
        points_goal_def: 6,
        points_goal_gk: 6,
        points_yellow_card: -1,
        points_red_card: -3,
        points_play_60_plus: 1,
        fantasy_scoring_version: 'v1'
    };
    
    // Diagnostics
    const goalScorerPlayerIds = allStats.filter(s => s.goals > 0).map(s => s.player_id);
    
    // Find all finalized squads for this phase
    const phase = match.phase;
    const allSquads = await base44.asServiceRole.entities.FantasySquad.filter({ 
        phase, 
        status: 'FINAL' 
    });
    
    console.log(`Found ${allSquads.length} finalized squads for phase ${phase}`);
    
    const diagnostics = {
        match_id,
        stats_count: allStats.length,
        squads_count: allSquads.length,
        goals_sum: allStats.reduce((sum, s) => sum + (s.goals || 0), 0),
        yc_sum: allStats.reduce((sum, s) => sum + (s.yellow_cards || 0), 0),
        rc_sum: allStats.reduce((sum, s) => sum + (s.red_cards || 0), 0),
        goal_scorer_player_ids: goalScorerPlayerIds,
        per_player_breakdown: [],
        dnp_starters_count: 0,
        auto_subs_count: 0
    };

    if (allSquads.length === 0) {
        return { 
            ok: false,
            code: 'NO_SQUAD',
            message: 'No finalized fantasy squads found for this phase',
            hint: 'Create at least one finalized squad for this phase. Run Dev Fantasy Setup to auto-create a test squad.',
            details: { match_id, phase, finalized_squads: 0 }
        };
    }

    // Check for prior scoring (re-score detection)
    const allLedger = await base44.asServiceRole.entities.PointsLedger.list();
    const priorEntriesForMatch = allLedger.filter(e => {
        if (e.mode !== 'FANTASY') return false;
        try {
            const breakdown = JSON.parse(e.breakdown_json);
            return breakdown.match_id === match_id && breakdown.type === 'AWARD';
        } catch {
            return false;
        }
    });

    const ledgerVoids = [];
    const ledgerAwards = [];

    // If force=false and prior entries exist, skip scoring
    if (!force && priorEntriesForMatch.length > 0) {
        return {
            ok: false,
            code: 'SCORING_ALREADY_DONE',
            message: 'Match already scored',
            hint: 'Use force=true to re-score (will void previous entries and create new ones).',
            details: { match_id, phase, existing_awards: priorEntriesForMatch.length }
        };
    }

    // If force=true and prior entries exist, create void entries (only if points > 0)
    if (force && priorEntriesForMatch.length > 0) {
        const voidsByUser = {};
        for (const entry of priorEntriesForMatch) {
            voidsByUser[entry.user_id] = (voidsByUser[entry.user_id] || 0) + entry.points;
        }

        for (const [user_id, totalPoints] of Object.entries(voidsByUser)) {
            // Only void if there were actual points
            if (totalPoints > 0) {
                const voidEntry = await base44.asServiceRole.entities.PointsLedger.create({
                    user_id,
                    mode: 'FANTASY',
                    source_type: 'FANTASY_MATCH',
                    source_id: match_id,
                    points: -totalPoints,
                    breakdown_json: JSON.stringify({
                        type: 'VOID',
                        match_id,
                        phase,
                        scoring_version: rules.fantasy_scoring_version,
                        reason: 'Force re-score',
                        voided_points: totalPoints,
                        timestamp: new Date().toISOString()
                    })
                });
                ledgerVoids.push(voidEntry);
            }
        }
    }

    // Score each squad
    const squadDiagnostics = [];
    const allStarterPlayerIds = [];
    
    for (const squad of allSquads) {
        // Validate squad formation
        const validation = await validateFantasySquad(base44, squad.id);
        if (!validation.ok) {
            return validation.error;
        }
        
        let squadTotalPoints = 0;
        const perPlayerDetails = [];

        // Get all squad players (starters + bench)
        const allSquadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
            squad_id: squad.id
        });
        
        const starters = allSquadPlayers.filter(sp => sp.slot_type === 'STARTER');
        const bench = allSquadPlayers.filter(sp => sp.slot_type === 'BENCH').sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0));
        
        // Auto-substitution logic
        const autoSubs = [];
        const usedBenchPlayerIds = new Set();
        const resolvedXI = [...starters]; // Start with original starters
        
        // Detect DNP starters
        const dnpStarters = starters.filter(sp => {
            const stat = statsMap[sp.player_id];
            return stat && stat.minutes_played === 0;
        });
        
        diagnostics.dnp_starters_count += dnpStarters.length;
        
        const dnpStarterPlayerIds = dnpStarters.map(sp => sp.player_id);
        const benchPlayerIds = bench.map(bp => bp.player_id);
        
        // Process each DNP starter
        for (const dnpStarter of dnpStarters) {
            const dnpPlayer = playersMap[dnpStarter.player_id];
            if (!dnpPlayer) continue;
            
            let substituted = false;
            
            // Try exact position match first
            for (const benchPlayer of bench) {
                if (usedBenchPlayerIds.has(benchPlayer.player_id)) continue;
                
                const benchStat = statsMap[benchPlayer.player_id];
                if (!benchStat || benchStat.minutes_played === 0) continue;
                
                const benchPlayerData = playersMap[benchPlayer.player_id];
                if (!benchPlayerData) continue;
                
                // Same position match
                if (benchPlayerData.position === dnpPlayer.position) {
                    // Replace DNP starter with bench player in resolvedXI
                    const index = resolvedXI.findIndex(sp => sp.player_id === dnpStarter.player_id);
                    if (index !== -1) {
                        resolvedXI[index] = {
                            ...benchPlayer,
                            slot_type: 'STARTER',
                            starter_position: dnpPlayer.position,
                            is_captain: dnpStarter.is_captain // Preserve captain status
                        };
                    }
                    
                    usedBenchPlayerIds.add(benchPlayer.player_id);
                    autoSubs.push({
                        out_player_id: dnpStarter.player_id,
                        out_player_name: dnpPlayer.full_name,
                        in_player_id: benchPlayer.player_id,
                        in_player_name: benchPlayerData.full_name,
                        bench_order: benchPlayer.bench_order,
                        reason: 'DNP - exact position match'
                    });
                    substituted = true;
                    break;
                }
            }
            
            // If no exact match, try flexible substitution (with formation check)
            if (!substituted) {
                for (const benchPlayer of bench) {
                    if (usedBenchPlayerIds.has(benchPlayer.player_id)) continue;
                    
                    const benchStat = statsMap[benchPlayer.player_id];
                    if (!benchStat || benchStat.minutes_played === 0) continue;
                    
                    const benchPlayerData = playersMap[benchPlayer.player_id];
                    if (!benchPlayerData) continue;
                    
                    // Test if this substitution keeps formation valid
                    const testXI = [...resolvedXI];
                    const index = testXI.findIndex(sp => sp.player_id === dnpStarter.player_id);
                    if (index !== -1) {
                        testXI[index] = {
                            ...benchPlayer,
                            slot_type: 'STARTER',
                            starter_position: benchPlayerData.position,
                            is_captain: dnpStarter.is_captain
                        };
                    }
                    
                    // Check formation
                    const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
                    for (const sp of testXI) {
                        const p = playersMap[sp.player_id];
                        if (p) {
                            positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
                        }
                    }
                    
                    const formationValid = positionCounts.GK === 1 && 
                                          positionCounts.DEF === 4 && 
                                          positionCounts.MID === 3 && 
                                          positionCounts.FWD === 3;
                    
                    if (formationValid) {
                        resolvedXI.splice(index, 1, testXI[index]);
                        usedBenchPlayerIds.add(benchPlayer.player_id);
                        autoSubs.push({
                            out_player_id: dnpStarter.player_id,
                            out_player_name: dnpPlayer.full_name,
                            in_player_id: benchPlayer.player_id,
                            in_player_name: benchPlayerData.full_name,
                            bench_order: benchPlayer.bench_order,
                            reason: 'DNP - flexible sub (formation preserved)'
                        });
                        substituted = true;
                        break;
                    }
                }
            }
            
            // If still not substituted, DNP starter contributes 0 points
            if (!substituted) {
                autoSubs.push({
                    out_player_id: dnpStarter.player_id,
                    out_player_name: dnpPlayer.full_name,
                    in_player_id: null,
                    in_player_name: null,
                    bench_order: null,
                    reason: 'DNP - no valid bench sub available'
                });
            }
        }
        
        diagnostics.auto_subs_count += autoSubs.length;
        
        const resolvedPlayerIds = resolvedXI.map(sp => sp.player_id);
        allStarterPlayerIds.push(...resolvedPlayerIds);
        
        // Identify captain (may have been substituted)
        const captain = resolvedXI.find(sp => sp.is_captain);
        let captainMultiplierAppliedTo = null;
        let captainBasePoints = 0;
        let captainMultipliedPoints = 0;
        let captainPlayerName = null;

        for (const squadPlayer of resolvedXI) {
            const player = playersMap[squadPlayer.player_id];
            if (!player) {
                console.warn(`Player ${squadPlayer.player_id} not found in playersMap`);
                continue;
            }

            const stat = statsMap[squadPlayer.player_id];
            if (!stat) {
                console.warn(`No stats found for player ${squadPlayer.player_id} (${player.full_name}) in match ${match_id}`);
                continue;
            }
            
            // Read exact fields from FantasyMatchPlayerStats
            const minutes = stat.minutes_played || 0;
            const goals = stat.goals || 0;
            const yc = stat.yellow_cards || 0;
            const rc = stat.red_cards || 0;
            const pos = player.position; // Position comes from Player entity
            
            console.log(`Scoring ${player.full_name} (${pos}): minutes=${minutes}, goals=${goals}, yc=${yc}, rc=${rc}`);

            // Calculate points - explicit logic
            let playerPoints = 0;

            // Base minutes points
            if (minutes >= 60) {
                playerPoints += 1;
            }

            // Goals by position
            if (pos === 'FWD') {
                playerPoints += goals * 4;
            } else if (pos === 'MID') {
                playerPoints += goals * 5;
            } else if (pos === 'DEF' || pos === 'GK') {
                playerPoints += goals * 6;
            }

            // Cards
            playerPoints += yc * -1;
            playerPoints += rc * -3;
            
            console.log(`  → Points: ${playerPoints}`);

            // Apply captain multiplier (2x only to captain)
            let multiplier = 1;
            const isCaptain = captain && squadPlayer.player_id === captain.player_id;

            if (isCaptain) {
                multiplier = 2;
                captainMultiplierAppliedTo = captain.player_id;
                captainBasePoints = playerPoints;
                captainPlayerName = player.full_name;
            }

            const finalPoints = playerPoints * multiplier;
            squadTotalPoints += finalPoints;

            if (isCaptain) {
                captainMultipliedPoints = finalPoints;
            }

            const playerDetail = {
                player_id: squadPlayer.player_id,
                player_name: player.full_name,
                pos: pos,
                minutes: minutes,
                goals: goals,
                yellow_cards: yc,
                red_cards: rc,
                base_points: playerPoints,
                multiplier,
                points: finalPoints,
                is_captain: !!isCaptain
            };
            
            perPlayerDetails.push(playerDetail);
            diagnostics.per_player_breakdown.push(playerDetail);
        }

        // Write ledger entry (always create AWARD, even if 0 points)
        console.log(`Creating ledger entry for user ${squad.user_id}: ${squadTotalPoints} points`);

        const captainDelta = captainMultipliedPoints - captainBasePoints;

        const ledgerEntry = await base44.asServiceRole.entities.PointsLedger.create({
            user_id: squad.user_id,
            mode: 'FANTASY',
            source_type: 'FANTASY_MATCH',
            source_id: match_id,
            points: squadTotalPoints,
            breakdown_json: JSON.stringify({
                type: 'AWARD',
                scoring_version: rules.fantasy_scoring_version,
                match_id,
                phase,
                squad_id: squad.id,
                per_player: perPlayerDetails,
                auto_subs: autoSubs,
                dnp_starters_count: dnpStarters.length,
                resolved_xi_player_ids: resolvedPlayerIds,
                captain: {
                    player_id: captainMultiplierAppliedTo,
                    player_name: captainPlayerName,
                    multiplier_applied: !!captainMultiplierAppliedTo,
                    points_before_multiplier: captainBasePoints,
                    points_after_multiplier: captainMultipliedPoints,
                    delta_from_multiplier: captainDelta
                },
                totals: {
                    squad_points: squadTotalPoints,
                    starters_count: starters.length,
                    bench_count: bench.length,
                    resolved_xi_count: resolvedXI.length
                },
                timestamp: new Date().toISOString()
            })
        });

        ledgerAwards.push(ledgerEntry);
        
        // Count positions for diagnostics
        const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        for (const sp of resolvedXI) {
            const player = playersMap[sp.player_id];
            if (player) {
                positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
            }
        }
        const formationString = `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;

        const captainDelta = captainMultipliedPoints - captainBasePoints;

        squadDiagnostics.push({
            squad_id: squad.id,
            user_id: squad.user_id,
            starters_count: starters.length,
            bench_count: bench.length,
            dnp_starters_count: dnpStarters.length,
            dnp_starter_player_ids: dnpStarterPlayerIds,
            bench_player_ids: benchPlayerIds,
            auto_subs: autoSubs,
            resolved_xi_count: resolvedXI.length,
            resolved_xi_player_ids: resolvedPlayerIds,
            formation: formationString,
            position_counts: positionCounts,
            captain_player_id: captain?.player_id || null,
            captain_player_name: captainPlayerName,
            captain_multiplier_applied: !!captainMultiplierAppliedTo,
            captain_points_before_multiplier: captainBasePoints,
            captain_points_after_multiplier: captainMultipliedPoints,
            delta_from_captain_multiplier: captainDelta,
            squad_points: squadTotalPoints
        });
    }
    
    // Final diagnostics
    const uniqueStarterPlayerIds = [...new Set(allStarterPlayerIds)];
    const goalScorersInStarters = diagnostics.goal_scorer_player_ids.filter(id => uniqueStarterPlayerIds.includes(id));
    const excludedGoalScorers = diagnostics.goal_scorer_player_ids.filter(id => !uniqueStarterPlayerIds.includes(id));
    
    diagnostics.starters_count = uniqueStarterPlayerIds.length;
    diagnostics.starter_player_ids = uniqueStarterPlayerIds;
    diagnostics.goal_scorers_in_starters_count = goalScorersInStarters.length;
    diagnostics.excluded_goal_scorer_player_ids = excludedGoalScorers;
    diagnostics.computed_total_points = ledgerAwards.reduce((sum, e) => sum + e.points, 0);
    diagnostics.squad_details = squadDiagnostics;
    
    // Validate: if any stats have goals > 0 but total points is 0, return detailed error
    if (diagnostics.goals_sum > 0 && diagnostics.computed_total_points === 0) {
        return {
            ok: false,
            code: 'SCORING_MATH_MISMATCH',
            message: 'Goals exist but produced zero points — check squad configuration',
            hint: 'Goal scorers exist in stats but are not in any squad\'s STARTERS. Run Dev Fantasy Setup to rebuild squads with goal scorers included.',
            details: {
                stats_count: diagnostics.stats_count,
                starters_count: diagnostics.starters_count,
                goal_scorers_in_starters_count: diagnostics.goal_scorers_in_starters_count,
                excluded_goal_scorer_player_ids: diagnostics.excluded_goal_scorer_player_ids,
                diagnostics,
                squads_count: allSquads.length,
                squad_details: squadDiagnostics,
                sample_stats: allStats.slice(0, 3).map(s => ({
                    player_id: s.player_id,
                    minutes_played: s.minutes_played,
                    goals: s.goals,
                    yellow_cards: s.yellow_cards,
                    red_cards: s.red_cards
                }))
            }
        };
    }

    return {
        ok: true,
        status: 'SUCCESS',
        match_id,
        phase,
        forced: force,
        users_scored_count: allSquads.length,
        ledger_awards: ledgerAwards.length,
        ledger_voids: ledgerVoids.length,
        total_points_awarded: diagnostics.computed_total_points,
        scoring_version: rules.fantasy_scoring_version,
        diagnostics
    };
}