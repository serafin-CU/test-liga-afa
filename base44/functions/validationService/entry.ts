import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validation Service - Server-side validation for CookUnity World Cup Hub 2026
 * 
 * ALL WRITE OPERATIONS MUST BE VALIDATED SERVER-SIDE
 * 
 * Endpoints:
 * - POST { action: "validate_match" } - Validate match data
 * - POST { action: "validate_prediction" } - Validate prode prediction
 * - POST { action: "validate_squad" } - Validate fantasy squad
 * - POST { action: "validate_url" } - Validate data source URL
 * - POST { action: "check_unique_constraint" } - Check uniqueness constraints
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'validate_match':
                return await validateMatch(base44, user, body);
            case 'validate_prediction':
                return await validatePrediction(base44, user, body);
            case 'validate_squad':
                return await validateSquad(base44, user, body);
            case 'validate_url':
                return await validateUrl(base44, user, body);
            case 'check_unique_constraint':
                return await checkUniqueConstraint(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Validation service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Validate match data (constraint: home_team_id != away_team_id)
 */
async function validateMatch(base44, user, body) {
    const { match_data } = body;
    const errors = [];

    if (!match_data) {
        return Response.json({ valid: false, errors: ['match_data is required'] });
    }

    const { phase, kickoff_at, home_team_id, away_team_id, venue } = match_data;

    // Required fields
    if (!phase) errors.push('phase is required');
    if (!kickoff_at) errors.push('kickoff_at is required');
    if (!home_team_id) errors.push('home_team_id is required');
    if (!away_team_id) errors.push('away_team_id is required');

    // Constraint: home_team_id != away_team_id
    if (home_team_id && away_team_id && home_team_id === away_team_id) {
        errors.push('home_team_id and away_team_id must be different');
    }

    // Validate teams exist
    if (home_team_id) {
        const homeTeams = await base44.asServiceRole.entities.Team.filter({ id: home_team_id });
        if (homeTeams.length === 0) {
            errors.push('home_team_id references non-existent team');
        }
    }
    if (away_team_id) {
        const awayTeams = await base44.asServiceRole.entities.Team.filter({ id: away_team_id });
        if (awayTeams.length === 0) {
            errors.push('away_team_id references non-existent team');
        }
    }

    return Response.json({ valid: errors.length === 0, errors });
}

/**
 * Validate prode prediction (constraint: UNIQUE(match_id, user_id))
 */
async function validatePrediction(base44, user, body) {
    const { prediction_data } = body;
    const errors = [];

    if (!prediction_data) {
        return Response.json({ valid: false, errors: ['prediction_data is required'] });
    }

    const { match_id, user_id, pred_home_goals, pred_away_goals, pred_mvp_player_id } = prediction_data;

    // Required fields
    if (!match_id) errors.push('match_id is required');
    if (!user_id) errors.push('user_id is required');
    if (typeof pred_home_goals !== 'number') errors.push('pred_home_goals is required');
    if (typeof pred_away_goals !== 'number') errors.push('pred_away_goals is required');

    // Range validation
    if (pred_home_goals < 0 || pred_home_goals > 20) {
        errors.push('pred_home_goals must be between 0 and 20');
    }
    if (pred_away_goals < 0 || pred_away_goals > 20) {
        errors.push('pred_away_goals must be between 0 and 20');
    }

    // Check unique constraint
    if (match_id && user_id) {
        const existing = await base44.asServiceRole.entities.ProdePrediction.filter({
            match_id,
            user_id
        });
        if (existing.length > 0) {
            errors.push('Prediction already exists for this match and user (UNIQUE constraint violated)');
        }
    }

    // Validate match exists
    if (match_id) {
        const matches = await base44.asServiceRole.entities.Match.filter({ id: match_id });
        if (matches.length === 0) {
            errors.push('match_id references non-existent match');
        }
    }

    // Validate MVP player exists and is active
    if (pred_mvp_player_id) {
        const players = await base44.asServiceRole.entities.Player.filter({ 
            id: pred_mvp_player_id,
            is_active: true
        });
        if (players.length === 0) {
            errors.push('pred_mvp_player_id must reference an active player');
        }
    }

    return Response.json({ valid: errors.length === 0, errors });
}

/**
 * Validate fantasy squad
 * Rules:
 * - Only one DRAFT per (user_id, phase)
 * - Total cost <= budget_cap
 * - UNIQUE(squad_id, player_id) in squad_players
 * - Proper formation (e.g., 1 GK, 3-5 DEF, 3-5 MID, 1-3 FWD)
 */
async function validateSquad(base44, user, body) {
    const { squad_data, squad_players } = body;
    const errors = [];
    const warnings = [];

    if (!squad_data) {
        return Response.json({ valid: false, errors: ['squad_data is required'] });
    }

    const { user_id, phase, status, budget_cap, total_cost, captain_player_id } = squad_data;

    // Required fields
    if (!user_id) errors.push('user_id is required');
    if (!phase) errors.push('phase is required');

    // Check only one DRAFT per (user_id, phase)
    if (user_id && phase && status === 'DRAFT') {
        const existingDrafts = await base44.asServiceRole.entities.FantasySquad.filter({
            user_id,
            phase,
            status: 'DRAFT'
        });
        if (existingDrafts.length > 0) {
            errors.push('User already has a DRAFT squad for this phase (only one DRAFT allowed per user/phase)');
        }
    }

    // Budget validation
    if (total_cost > budget_cap) {
        errors.push(`Total cost ${total_cost} exceeds budget cap ${budget_cap}`);
    }

    // Validate squad players if provided
    if (squad_players && Array.isArray(squad_players)) {
        // Check for duplicate players
        const playerIds = squad_players.map(sp => sp.player_id);
        const uniquePlayerIds = new Set(playerIds);
        if (playerIds.length !== uniquePlayerIds.size) {
            errors.push('Squad contains duplicate players (UNIQUE constraint on squad_id + player_id)');
        }

        // Count positions
        const starters = squad_players.filter(sp => sp.slot_type === 'STARTER');
        const positionCounts = {
            GK: starters.filter(sp => sp.starter_position === 'GK').length,
            DEF: starters.filter(sp => sp.starter_position === 'DEF').length,
            MID: starters.filter(sp => sp.starter_position === 'MID').length,
            FWD: starters.filter(sp => sp.starter_position === 'FWD').length
        };

        // Formation validation
        if (positionCounts.GK !== 1) {
            errors.push('Squad must have exactly 1 GK in starting lineup');
        }
        if (positionCounts.DEF < 3 || positionCounts.DEF > 5) {
            warnings.push('Typical formations have 3-5 DEF (current: ' + positionCounts.DEF + ')');
        }
        if (positionCounts.MID < 3 || positionCounts.MID > 5) {
            warnings.push('Typical formations have 3-5 MID (current: ' + positionCounts.MID + ')');
        }
        if (positionCounts.FWD < 1 || positionCounts.FWD > 3) {
            warnings.push('Typical formations have 1-3 FWD (current: ' + positionCounts.FWD + ')');
        }

        // Validate starter_position is required for STARTER
        for (const sp of starters) {
            if (!sp.starter_position) {
                errors.push('starter_position is required for all STARTER slot_type players');
                break;
            }
        }

        // Validate captain is in the squad
        if (captain_player_id) {
            if (!playerIds.includes(captain_player_id)) {
                errors.push('captain_player_id must be a player in the squad');
            }
        }
    }

    return Response.json({ valid: errors.length === 0, errors, warnings });
}

/**
 * Validate URL against data source whitelist
 */
async function validateUrl(base44, user, body) {
    const { url } = body;
    const errors = [];

    if (!url) {
        return Response.json({ valid: false, errors: ['url is required'] });
    }

    // Get all enabled data sources
    const dataSources = await base44.asServiceRole.entities.DataSource.filter({ enabled: true });

    let allowed = false;
    let matchedSource = null;

    for (const source of dataSources) {
        // Check base_url match
        if (!url.startsWith(source.base_url)) continue;

        // Check regex pattern
        const path = url.substring(source.base_url.length);
        try {
            const regex = new RegExp(source.allowed_paths_regex);
            if (regex.test(path)) {
                allowed = true;
                matchedSource = source;
                break;
            }
        } catch (e) {
            console.error('Invalid regex in data source:', source.name, e);
        }
    }

    if (!allowed) {
        errors.push('URL not in approved whitelist (base_url + allowed_paths_regex)');
    }

    return Response.json({ 
        valid: allowed, 
        errors,
        matched_source: matchedSource ? { id: matchedSource.id, name: matchedSource.name } : null
    });
}

/**
 * Check unique constraint
 */
async function checkUniqueConstraint(base44, user, body) {
    const { entity_type, fields } = body;

    if (!entity_type || !fields) {
        return Response.json({ error: 'entity_type and fields are required' }, { status: 400 });
    }

    const validEntities = [
        'ProdePrediction', 'FantasySquadPlayer', 'MatchSourceLink', 
        'FantasyTransferPenalty', 'ScoringJob'
    ];
    
    if (!validEntities.includes(entity_type)) {
        return Response.json({ 
            error: `entity_type must be one of: ${validEntities.join(', ')}` 
        }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities[entity_type].filter(fields);

    return Response.json({ 
        exists: existing.length > 0,
        count: existing.length,
        constraint_violated: existing.length > 0
    });
}