import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Squad Captain Service
 * Manages captain selection for fantasy squads
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

        const { action, squad_id, player_id } = await req.json();

        if (action === 'set_captain') {
            return await setCaptain(base44, user, squad_id, player_id);
        }

        if (action === 'clear_captain') {
            return await clearCaptain(base44, user, squad_id);
        }

        return Response.json({ 
            status: 'ERROR',
            code: 'INVALID_ACTION',
            message: 'Invalid action specified'
        }, { status: 400 });

    } catch (error) {
        console.error('Squad captain service error:', error);
        return Response.json({ 
            status: 'ERROR',
            code: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            details: {
                name: error.name,
                stack: error.stack
            }
        }, { status: 500 });
    }
});

async function setCaptain(base44, user, squad_id, player_id) {
    // Validate inputs
    if (!squad_id || !player_id) {
        return Response.json({
            status: 'ERROR',
            code: 'MISSING_PARAMETERS',
            message: 'squad_id and player_id are required'
        }, { status: 400 });
    }

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({
            status: 'ERROR',
            code: 'INVALID_SQUAD',
            message: 'Squad not found'
        }, { status: 404 });
    }
    const squad = squads[0];

    // Check authorization: user must be squad owner or admin
    const isOwner = squad.user_id === user.id;
    const isAdmin = user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
        return Response.json({
            status: 'ERROR',
            code: 'FORBIDDEN',
            message: 'You do not have permission to modify this squad'
        }, { status: 403 });
    }

    // Get all squad players
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
        squad_id 
    });

    // Find the player to set as captain
    const targetPlayer = squadPlayers.find(sp => sp.player_id === player_id);
    
    if (!targetPlayer) {
        return Response.json({
            status: 'ERROR',
            code: 'PLAYER_NOT_IN_SQUAD',
            message: 'Player is not in this squad'
        }, { status: 400 });
    }

    // Validate player is a starter
    if (targetPlayer.slot_type !== 'STARTER') {
        return Response.json({
            status: 'ERROR',
            code: 'NOT_A_STARTER',
            message: 'Only starters can be set as captain'
        }, { status: 400 });
    }

    // Find current captain
    const currentCaptain = squadPlayers.find(sp => sp.is_captain === true);
    const previousCaptainId = currentCaptain?.player_id || null;

    // Clear all captains first (atomic operation)
    for (const sp of squadPlayers) {
        if (sp.is_captain === true) {
            await base44.asServiceRole.entities.FantasySquadPlayer.update(sp.id, {
                is_captain: false
            });
        }
    }

    // Set new captain
    await base44.asServiceRole.entities.FantasySquadPlayer.update(targetPlayer.id, {
        is_captain: true
    });

    // Get player details for audit log
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const playerData = allPlayers.find(p => p.id === player_id);
    const previousPlayerData = previousCaptainId ? allPlayers.find(p => p.id === previousCaptainId) : null;

    // Create audit log
    await base44.asServiceRole.entities.AdminAuditLog.create({
        admin_user_id: user.id,
        actor_type: 'ADMIN',
        action: 'SET_SQUAD_CAPTAIN',
        entity_type: 'FantasySquad',
        entity_id: squad_id,
        reason: `Captain set to ${playerData?.full_name || player_id}`,
        details_json: JSON.stringify({
            squad_id,
            new_captain_id: player_id,
            new_captain_name: playerData?.full_name,
            old_captain_id: previousCaptainId,
            old_captain_name: previousPlayerData?.full_name,
            actor_id: user.id,
            actor_email: user.email,
            timestamp: new Date().toISOString()
        })
    });

    return Response.json({
        status: 'OK',
        captain_player_id: player_id,
        captain_player_name: playerData?.full_name,
        previous_captain_id: previousCaptainId,
        previous_captain_name: previousPlayerData?.full_name,
        message: `Captain set: ${playerData?.full_name || player_id}`
    });
}

async function clearCaptain(base44, user, squad_id) {
    // Validate inputs
    if (!squad_id) {
        return Response.json({
            status: 'ERROR',
            code: 'MISSING_PARAMETERS',
            message: 'squad_id is required'
        }, { status: 400 });
    }

    // Get squad
    const squads = await base44.asServiceRole.entities.FantasySquad.filter({ id: squad_id });
    if (squads.length === 0) {
        return Response.json({
            status: 'ERROR',
            code: 'INVALID_SQUAD',
            message: 'Squad not found'
        }, { status: 404 });
    }
    const squad = squads[0];

    // Check authorization
    const isOwner = squad.user_id === user.id;
    const isAdmin = user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
        return Response.json({
            status: 'ERROR',
            code: 'FORBIDDEN',
            message: 'You do not have permission to modify this squad'
        }, { status: 403 });
    }

    // Get all squad players
    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ 
        squad_id 
    });

    // Find current captain
    const currentCaptain = squadPlayers.find(sp => sp.is_captain === true);
    
    if (!currentCaptain) {
        return Response.json({
            status: 'OK',
            message: 'No captain to clear'
        });
    }

    // Clear captain
    await base44.asServiceRole.entities.FantasySquadPlayer.update(currentCaptain.id, {
        is_captain: false
    });

    // Get player details for audit log
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const playerData = allPlayers.find(p => p.id === currentCaptain.player_id);

    // Create audit log
    await base44.asServiceRole.entities.AdminAuditLog.create({
        admin_user_id: user.id,
        actor_type: 'ADMIN',
        action: 'CLEAR_SQUAD_CAPTAIN',
        entity_type: 'FantasySquad',
        entity_id: squad_id,
        reason: `Captain cleared from ${playerData?.full_name || currentCaptain.player_id}`,
        details_json: JSON.stringify({
            squad_id,
            cleared_captain_id: currentCaptain.player_id,
            cleared_captain_name: playerData?.full_name,
            actor_id: user.id,
            actor_email: user.email,
            timestamp: new Date().toISOString()
        })
    });

    return Response.json({
        status: 'OK',
        message: 'Captain cleared',
        cleared_captain_id: currentCaptain.player_id
    });
}