import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fantasy Service - Handles fantasy squad management
 * 
 * Endpoints:
 * - POST { action: "create_squad" } - Create new fantasy squad
 * - POST { action: "add_player_to_squad" } - Add player to squad
 * - POST { action: "remove_player_from_squad" } - Remove player from squad
 * - POST { action: "set_captain" } - Set squad captain
 * - POST { action: "finalize_squad" } - Finalize squad (locks it)
 * - POST { action: "get_user_squads" } - Get user's squads
 * - POST { action: "validate_squad" } - Validate squad before finalization
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
            case 'create_squad':
                return await createSquad(base44, user, body);
            case 'add_player_to_squad':
                return await addPlayerToSquad(base44, user, body);
            case 'remove_player_from_squad':
                return await removePlayerFromSquad(base44, user, body);
            case 'set_captain':
                return await setCaptain(base44, user, body);
            case 'finalize_squad':
                return await finalizeSquad(base44, user, body);
            case 'get_user_squads':
                return await getUserSquads(base44, user, body);
            case 'validate_squad':
                return await validateSquadFull(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Fantasy service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Create new fantasy squad
 * Rule: Only one DRAFT per (user_id, phase)
 */
async function createSquad(base44, user, body) {
    const { phase, budget_cap } = body;

    if (!phase) {
        return Response.json({ error: 'phase is required' }, { status: 400 });
    }

    // Check for existing DRAFT squad
    const existingDrafts = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id: user.id,
        phase,
        status: 'DRAFT'
    });

    if (existingDrafts.length > 0) {
        return Response.json({ 
            error: 'You already have a draft squad for this phase',
            existing_squad: existingDrafts[0]
        }, { status: 409 });
    }

    // Check transfer window
    const configs = await base44.asServiceRole.entities.AppConfig.list();
    if (configs.length > 0 && configs[0].transfer_window_state === 'CLOSED') {
        return Response.json({ 
            error: 'Transfer window is closed',
            transfer_window_state: 'CLOSED'
        }, { status: 400 });
    }

    const squad = await base44.asServiceRole.entities.FantasySquad.create({
        user_id: user.id,
        phase,
        status: 'DRAFT',
        budget_cap: budget_cap || 150,
        total_cost: 0,
        last_autosaved_at: new Date().toISOString()
    });

    return Response.json({ success: true, squad });
}

/**
 * Add player to squad
 * Constraint: UNIQUE(squad_id, player_id)
 */
async function addPlayerToSquad(base44, user, body) {
    const { squad_id, player_id, slot_type, starter_position } = body;

    // Validation
    if (!squad_id || !player_id || !slot_type) {
        return Response.json({ 
            error: 'squad_id, player_id, and slot_type are required' 
        }, { status: 400 });
    }

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squads[0];

    // Check ownership
    if (squad.user_id !== user.id) {
        return Response.json({ error: 'You do not own this squad' }, { status: 403 });
    }

    // Check if squad is finalized
    if (squad.status === 'FINAL') {
        return Response.json({ error: 'Cannot modify finalized squad' }, { status: 400 });
    }

    // Check unique constraint
    const existingPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id,
        player_id
    });
    if (existingPlayers.length > 0) {
        return Response.json({ 
            error: 'Player already in squad (UNIQUE constraint)' 
        }, { status: 409 });
    }

    // Get player
    const players = await base44.asServiceRole.entities.Player.filter({ 
        id: player_id,
        is_active: true
    });
    if (players.length === 0) {
        return Response.json({ error: 'Player not found or inactive' }, { status: 404 });
    }

    const player = players[0];

    // Check budget
    const newTotalCost = squad.total_cost + player.price;
    if (newTotalCost > squad.budget_cap) {
        return Response.json({ 
            error: 'Adding this player would exceed budget',
            current_cost: squad.total_cost,
            player_price: player.price,
            new_total: newTotalCost,
            budget_cap: squad.budget_cap
        }, { status: 400 });
    }

    // Validate starter_position for STARTER slot_type
    if (slot_type === 'STARTER' && !starter_position) {
        return Response.json({ 
            error: 'starter_position is required for STARTER slot_type' 
        }, { status: 400 });
    }

    // Add player to squad
    const squadPlayer = await base44.asServiceRole.entities.FantasySquadPlayer.create({
        squad_id,
        player_id,
        slot_type,
        starter_position: starter_position || null
    });

    // Update squad total_cost and autosave timestamp
    await base44.asServiceRole.entities.FantasySquad.update(squad_id, {
        total_cost: newTotalCost,
        last_autosaved_at: new Date().toISOString()
    });

    return Response.json({ success: true, squad_player: squadPlayer, new_total_cost: newTotalCost });
}

/**
 * Remove player from squad
 */
async function removePlayerFromSquad(base44, user, body) {
    const { squad_player_id } = body;

    if (!squad_player_id) {
        return Response.json({ error: 'squad_player_id is required' }, { status: 400 });
    }

    // Get squad player
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
        id: squad_player_id 
    });
    if (squadPlayers.length === 0) {
        return Response.json({ error: 'Squad player not found' }, { status: 404 });
    }

    const squadPlayer = squadPlayers[0];

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ 
        id: squadPlayer.squad_id 
    });
    const squad = squads[0];

    // Check ownership
    if (squad.user_id !== user.id) {
        return Response.json({ error: 'You do not own this squad' }, { status: 403 });
    }

    // Check if finalized
    if (squad.status === 'FINAL') {
        return Response.json({ error: 'Cannot modify finalized squad' }, { status: 400 });
    }

    // Get player price
    const players = await base44.asServiceRole.entities.Player.filter({ 
        id: squadPlayer.player_id 
    });
    const playerPrice = players[0]?.price || 0;

    // Delete squad player
    await base44.asServiceRole.entities.FantasySquadPlayer.delete(squad_player_id);

    // Update squad total_cost
    const newTotalCost = Math.max(0, squad.total_cost - playerPrice);
    await base44.asServiceRole.entities.FantasySquad.update(squad.id, {
        total_cost: newTotalCost,
        last_autosaved_at: new Date().toISOString()
    });

    return Response.json({ success: true, new_total_cost: newTotalCost });
}

/**
 * Set squad captain
 */
async function setCaptain(base44, user, body) {
    const { squad_id, captain_player_id } = body;

    if (!squad_id || !captain_player_id) {
        return Response.json({ 
            error: 'squad_id and captain_player_id are required' 
        }, { status: 400 });
    }

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squads[0];

    // Check ownership
    if (squad.user_id !== user.id) {
        return Response.json({ error: 'You do not own this squad' }, { status: 403 });
    }

    // Check if captain is in squad
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id,
        player_id: captain_player_id
    });
    if (squadPlayers.length === 0) {
        return Response.json({ 
            error: 'Captain must be a player in the squad' 
        }, { status: 400 });
    }

    // Update captain
    await base44.asServiceRole.entities.FantasySquad.update(squad_id, {
        captain_player_id,
        last_autosaved_at: new Date().toISOString()
    });

    return Response.json({ success: true });
}

/**
 * Finalize squad (locks it, changes status to FINAL)
 */
async function finalizeSquad(base44, user, body) {
    const { squad_id } = body;

    if (!squad_id) {
        return Response.json({ error: 'squad_id is required' }, { status: 400 });
    }

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squads[0];

    // Check ownership
    if (squad.user_id !== user.id) {
        return Response.json({ error: 'You do not own this squad' }, { status: 403 });
    }

    // Check if already finalized
    if (squad.status === 'FINAL') {
        return Response.json({ 
            success: true,
            idempotent: true,
            message: 'Squad already finalized'
        });
    }

    // Validate squad before finalizing
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id });
    const validation = validateSquad(squadPlayers, squad);

    if (!validation.valid) {
        return Response.json({ 
            error: 'Squad validation failed',
            validation_errors: validation.errors
        }, { status: 400 });
    }

    // Finalize
    await base44.asServiceRole.entities.FantasySquad.update(squad_id, {
        status: 'FINAL',
        finalized_at: new Date().toISOString()
    });

    return Response.json({ success: true, message: 'Squad finalized' });
}

/**
 * Get user squads
 */
async function getUserSquads(base44, user, body) {
    const { target_user_id, phase } = body;
    
    // Non-admin can only see their own squads
    const userId = user.role === 'admin' && target_user_id ? target_user_id : user.id;

    const filter = { user_id: userId };
    if (phase) filter.phase = phase;

    const squads = await base44.asServiceRole.entities.FantasySquad.filter(filter, '-created_date');

    return Response.json({ success: true, squads, total: squads.length });
}

/**
 * Validate squad (full check)
 */
async function validateSquadFull(base44, user, body) {
    const { squad_id } = body;

    if (!squad_id) {
        return Response.json({ error: 'squad_id is required' }, { status: 400 });
    }

    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squads[0];
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id });

    const validation = validateSquad(squadPlayers, squad);

    return Response.json({ 
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
    });
}

/**
 * Helper: Validate squad structure
 */
function validateSquad(squadPlayers, squad) {
    const errors = [];
    const warnings = [];

    // Check minimum players
    if (squadPlayers.length < 11) {
        errors.push('Squad must have at least 11 players');
    }

    // Check formation
    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
    if (starters.length !== 11) {
        errors.push('Squad must have exactly 11 starters');
    }

    const positionCounts = {
        GK: starters.filter(sp => sp.starter_position === 'GK').length,
        DEF: starters.filter(sp => sp.starter_position === 'DEF').length,
        MID: starters.filter(sp => sp.starter_position === 'MID').length,
        FWD: starters.filter(sp => sp.starter_position === 'FWD').length
    };

    if (positionCounts.GK !== 1) {
        errors.push('Squad must have exactly 1 GK in starting lineup');
    }
    if (positionCounts.DEF < 3 || positionCounts.DEF > 5) {
        warnings.push('Formation should have 3-5 DEF (current: ' + positionCounts.DEF + ')');
    }
    if (positionCounts.MID < 3 || positionCounts.MID > 5) {
        warnings.push('Formation should have 3-5 MID (current: ' + positionCounts.MID + ')');
    }
    if (positionCounts.FWD < 1 || positionCounts.FWD > 3) {
        warnings.push('Formation should have 1-3 FWD (current: ' + positionCounts.FWD + ')');
    }

    // Check captain
    if (!squad.captain_player_id) {
        errors.push('Squad must have a captain');
    } else {
        const captainInSquad = squadPlayers.some(sp => sp.player_id === squad.captain_player_id);
        if (!captainInSquad) {
            errors.push('Captain must be a player in the squad');
        }
    }

    return { 
        valid: errors.length === 0, 
        errors, 
        warnings 
    };
}