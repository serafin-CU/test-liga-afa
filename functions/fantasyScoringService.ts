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
    const diagnostics = {
        match_id,
        stats_rows_count: allStats.length,
        goals_sum: allStats.reduce((sum, s) => sum + (s.goals || 0), 0),
        yc_sum: allStats.reduce((sum, s) => sum + (s.yellow_cards || 0), 0),
        rc_sum: allStats.reduce((sum, s) => sum + (s.red_cards || 0), 0),
        per_player_breakdown: []
    };



    // Find all finalized squads for this phase
    const phase = match.phase;
    const allSquads = await base44.asServiceRole.entities.FantasySquad.filter({ 
        phase, 
        status: 'FINAL' 
    });

    if (allSquads.length === 0) {
        return { 
            ok: false,
            code: 'NO_SQUAD',
            message: 'No finalized fantasy squads found for this phase',
            hint: 'Create at least one finalized squad for this phase. Run Dev Fantasy Setup to auto-create a test squad.',
            details: { match_id, phase, finalized_squads: 0 }
        };
    }

    // Load all players for position lookup
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

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

    // If force=true and prior entries exist, create void entries
    if (force && priorEntriesForMatch.length > 0) {
        const voidsByUser = {};
        for (const entry of priorEntriesForMatch) {
            voidsByUser[entry.user_id] = (voidsByUser[entry.user_id] || 0) + entry.points;
        }

        for (const [user_id, totalPoints] of Object.entries(voidsByUser)) {
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

    // Score each squad
    for (const squad of allSquads) {
        let squadTotalPoints = 0;
        const perPlayerDetails = [];

        // Get starter players only
        const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
            squad_id: squad.id,
            slot_type: 'STARTER'
        });

        for (const squadPlayer of squadPlayers) {
            const player = playersMap[squadPlayer.player_id];
            if (!player) continue;

            const stats = statsMap[squadPlayer.player_id];
            if (!stats) continue;
            
            const minutes = stats.minutes_played || 0;
            const goals = stats.goals || 0;
            const yellowCards = stats.yellow_cards || 0;
            const redCards = stats.red_cards || 0;

            // Calculate points
            let playerPoints = 0;

            // Goals
            const goalPoints = {
                'FWD': rules.points_goal_fwd,
                'MID': rules.points_goal_mid,
                'DEF': rules.points_goal_def,
                'GK': rules.points_goal_gk
            }[player.position] || 0;
            playerPoints += goals * goalPoints;

            // Cards
            playerPoints += yellowCards * rules.points_yellow_card;
            playerPoints += redCards * rules.points_red_card;

            // Minutes
            if (minutes >= 60) {
                playerPoints += rules.points_play_60_plus;
            }

            squadTotalPoints += playerPoints;

            const playerDetail = {
                player_id: squadPlayer.player_id,
                player_name: player.full_name,
                position: player.position,
                minutes,
                goals,
                yellow_cards: yellowCards,
                red_cards: redCards,
                points: playerPoints
            };
            
            perPlayerDetails.push(playerDetail);
            diagnostics.per_player_breakdown.push(playerDetail);
        }

        // Write ledger entry
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
                totals: {
                    squad_points: squadTotalPoints,
                    starters_count: squadPlayers.length
                },
                timestamp: new Date().toISOString()
            })
        });

        ledgerAwards.push(ledgerEntry);
    }
    
    diagnostics.computed_total_points = ledgerAwards.reduce((sum, e) => sum + e.points, 0);
    
    // Validate: if any stats have goals > 0 but total points is 0, throw error
    if (diagnostics.goals_sum > 0 && diagnostics.computed_total_points === 0) {
        return {
            ok: false,
            code: 'SCORING_LOGIC_ERROR',
            message: 'Match has goals but computed 0 points',
            hint: 'Check that players with goals are in a finalized squad as STARTERS.',
            details: {
                diagnostics,
                squads_count: allSquads.length,
                starters_per_squad: allSquads.map(sq => ({
                    squad_id: sq.id,
                    user_id: sq.user_id,
                    starters_count: squadPlayers.length
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