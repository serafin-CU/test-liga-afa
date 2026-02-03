import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fantasy Transfer Service
 * Handles transfer detection, validation, penalties, and phase locks
 * 
 * TRANSFER RULES (source of truth):
 * - R32: free=2; transfers 3-5 => -3 each
 * - R16: free=3; transfers 4-6 => -2 each; 7-11 => -3 each
 * - QF: free=2; transfers 3-5 => -4 each
 * - SF: free=2; transfers 3-5 => -5 each
 * - FINAL: free=5; transfers 6+ => -7 each
 */

const PHASE_ORDER = ['PRE_TOURNAMENT', 'GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];

const TRANSFER_RULES = {
    'ROUND_OF_32': {
        free_transfers: 2,
        tiers: [
            { max: 5, penalty: -3 }  // transfers 3-5: -3 each
        ]
    },
    'ROUND_OF_16': {
        free_transfers: 3,
        tiers: [
            { max: 6, penalty: -2 },  // transfers 4-6: -2 each
            { max: 11, penalty: -3 }  // transfers 7-11: -3 each
        ]
    },
    'QUARTERFINALS': {
        free_transfers: 2,
        tiers: [
            { max: 5, penalty: -4 }  // transfers 3-5: -4 each
        ]
    },
    'SEMIFINALS': {
        free_transfers: 2,
        tiers: [
            { max: 5, penalty: -5 }  // transfers 3-5: -5 each
        ]
    },
    'FINAL': {
        free_transfers: 5,
        tiers: [
            { max: Infinity, penalty: -7 }  // transfers 6+: -7 each
        ]
    }
};

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

        const { action, squad_id, target_phase, user_id, phase, force_transfers_count } = await req.json();

        if (action === 'calculate_transfers') {
            const result = await calculateTransfers(base44, user_id || user.id, squad_id, target_phase);
            return Response.json(result);
        }

        if (action === 'check_phase_lock') {
            const result = await checkPhaseLock(base44, target_phase);
            return Response.json(result);
        }

        if (action === 'apply_transfer_penalties') {
            const result = await applyTransferPenalties(base44, user_id || user.id, phase, force_transfers_count);
            return Response.json(result);
        }

        return Response.json({
            status: 'ERROR',
            code: 'INVALID_ACTION',
            message: 'Invalid action specified'
        }, { status: 400 });

    } catch (error) {
        console.error('Fantasy transfer service error:', error);
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

async function checkPhaseLock(base44, phase) {
    const phaseMatches = await base44.asServiceRole.entities.Match.filter({ phase });
    
    if (phaseMatches.length === 0) {
        return {
            status: 'SUCCESS',
            is_locked: false,
            reason: 'No matches found for phase'
        };
    }

    const sortedMatches = phaseMatches.sort((a, b) => 
        new Date(a.kickoff_at) - new Date(b.kickoff_at)
    );

    const firstMatch = sortedMatches[0];
    const firstMatchTime = new Date(firstMatch.kickoff_at);
    const lockTime = new Date(firstMatchTime.getTime() - (48 * 60 * 60 * 1000));
    const now = new Date();

    const isLocked = now >= lockTime;

    return {
        status: 'SUCCESS',
        is_locked: isLocked,
        lock_time: lockTime.toISOString(),
        first_match_time: firstMatchTime.toISOString(),
        current_time: now.toISOString(),
        hours_until_lock: isLocked ? 0 : Math.floor((lockTime - now) / (1000 * 60 * 60))
    };
}

async function calculateTransfers(base44, user_id, current_squad_id, current_phase) {
    const currentSquad = await base44.asServiceRole.entities.FantasySquad.get(current_squad_id);
    if (!currentSquad) {
        return {
            status: 'ERROR',
            code: 'SQUAD_NOT_FOUND',
            message: 'Current squad not found'
        };
    }

    const currentPhaseIndex = PHASE_ORDER.indexOf(current_phase);
    
    if (currentPhaseIndex <= 3) {  // PRE_TOURNAMENT through GROUP_MD3
        return {
            status: 'SUCCESS',
            transfers_count: 0,
            free_transfers: 0,
            penalty_points: 0,
            changed_player_ids: [],
            message: 'Group stage - no transfers calculated'
        };
    }

    const previousPhase = PHASE_ORDER[currentPhaseIndex - 1];

    const previousSquads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase: previousPhase,
        status: 'FINAL'
    });

    if (previousSquads.length === 0) {
        return {
            status: 'SUCCESS',
            transfers_count: 0,
            free_transfers: 0,
            penalty_points: 0,
            changed_player_ids: [],
            message: 'No previous phase squad found'
        };
    }

    const previousSquad = previousSquads[0];

    const currentPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: current_squad_id
    });
    const previousPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: previousSquad.id
    });

    const currentPlayerIds = new Set(currentPlayers.map(p => p.player_id));
    const previousPlayerIds = new Set(previousPlayers.map(p => p.player_id));

    const changedPlayerIds = [];
    for (const playerId of currentPlayerIds) {
        if (!previousPlayerIds.has(playerId)) {
            changedPlayerIds.push(playerId);
        }
    }
    for (const playerId of previousPlayerIds) {
        if (!currentPlayerIds.has(playerId)) {
            changedPlayerIds.push(playerId);
        }
    }

    const transfersCount = Math.floor(changedPlayerIds.length / 2);

    const rules = TRANSFER_RULES[current_phase];
    if (!rules) {
        return {
            status: 'ERROR',
            code: 'INVALID_PHASE',
            message: `No transfer rules defined for phase ${current_phase}`
        };
    }

    const freeTransfers = rules.free_transfers;
    const excessTransfers = Math.max(0, transfersCount - freeTransfers);

    const penaltyResult = calculatePenalty(current_phase, transfersCount);

    return {
        status: 'SUCCESS',
        transfers_count: transfersCount,
        free_transfers: freeTransfers,
        excess_transfers: excessTransfers,
        penalty_points: penaltyResult.penalty,
        penalty_breakdown: penaltyResult.breakdown,
        changed_player_ids: changedPlayerIds,
        previous_phase: previousPhase,
        current_phase: current_phase
    };
}

function calculatePenalty(phase, transfersCount) {
    const rules = TRANSFER_RULES[phase];
    if (!rules) return { penalty: 0, breakdown: '' };

    const freeTransfers = rules.free_transfers;
    const excessTransfers = transfersCount - freeTransfers;

    if (excessTransfers <= 0) {
        return { penalty: 0, breakdown: 'No excess transfers' };
    }

    let penalty = 0;
    const breakdownParts = [];
    let remaining = excessTransfers;
    let currentTransfer = freeTransfers + 1;

    for (const tier of rules.tiers) {
        const tierMax = tier.max;
        const tierCount = Math.min(remaining, tierMax - freeTransfers - (excessTransfers - remaining));
        
        if (tierCount > 0) {
            penalty += tierCount * tier.penalty;
            const rangeStart = currentTransfer;
            const rangeEnd = currentTransfer + tierCount - 1;
            breakdownParts.push(`(${rangeStart}-${rangeEnd})×${tier.penalty}`);
            currentTransfer += tierCount;
            remaining -= tierCount;
        }

        if (remaining <= 0) break;
    }

    return {
        penalty,
        breakdown: breakdownParts.join(' + ') + ` = ${penalty}`
    };
}

async function applyTransferPenalties(base44, user_id, phase, forceTransfersCount = null) {
    // Check for existing penalty for this user + phase (idempotency)
    const existingPenalties = await base44.asServiceRole.entities.PointsLedger.filter({
        user_id,
        mode: 'PENALTY',
        source_type: 'TRANSFER_PENALTY'
    });

    let existingPenaltyForPhase = null;
    for (const p of existingPenalties) {
        try {
            const breakdown = JSON.parse(p.breakdown_json);
            if (breakdown.phase === phase) {
                existingPenaltyForPhase = p;
                break;
            }
        } catch {}
    }

    const squads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase,
        status: 'FINAL'
    });

    if (squads.length === 0) {
        return {
            status: 'ERROR',
            code: 'NO_SQUAD',
            message: 'No finalized squad found for phase'
        };
    }

    const transferResult = await calculateTransfers(base44, user_id, squads[0].id, phase);

    if (transferResult.status !== 'SUCCESS') {
        return transferResult;
    }

    let penaltyPoints = transferResult.penalty_points;
    let transfersCount = transferResult.transfers_count;
    let penaltyBreakdown = transferResult.penalty_breakdown;

    // Override for testing
    if (forceTransfersCount !== null && forceTransfersCount !== undefined) {
        transfersCount = forceTransfersCount;
        const penaltyResult = calculatePenalty(phase, forceTransfersCount);
        penaltyPoints = penaltyResult.penalty;
        penaltyBreakdown = penaltyResult.breakdown;
    }

    const excessTransfers = Math.max(0, transfersCount - transferResult.free_transfers);

    if (penaltyPoints >= 0) {
        return {
            status: 'SUCCESS',
            penalty_applied: false,
            message: 'No penalty to apply',
            transfers_count: transfersCount,
            free_transfers: transferResult.free_transfers,
            excess_transfers: excessTransfers,
            penalty_points: 0
        };
    }

    // Idempotent: update existing or create new
    if (existingPenaltyForPhase) {
        await base44.asServiceRole.entities.PointsLedger.update(existingPenaltyForPhase.id, {
            points: penaltyPoints,
            breakdown_json: JSON.stringify({
                type: 'TRANSFER_PENALTY',
                phase: phase,
                transfers_count: transfersCount,
                free_transfers: transferResult.free_transfers,
                excess_transfers: excessTransfers,
                penalty_points: penaltyPoints,
                penalty_breakdown: penaltyBreakdown,
                timestamp: new Date().toISOString()
            })
        });
    } else {
        await base44.asServiceRole.entities.PointsLedger.create({
            user_id,
            mode: 'PENALTY',
            source_type: 'TRANSFER_PENALTY',
            source_id: `TRANSFER:${phase}`,
            points: penaltyPoints,
            breakdown_json: JSON.stringify({
                type: 'TRANSFER_PENALTY',
                phase: phase,
                transfers_count: transfersCount,
                free_transfers: transferResult.free_transfers,
                excess_transfers: excessTransfers,
                penalty_points: penaltyPoints,
                penalty_breakdown: penaltyBreakdown,
                timestamp: new Date().toISOString()
            })
        });
    }

    return {
        status: 'SUCCESS',
        penalty_applied: true,
        penalty_points: penaltyPoints,
        penalty_breakdown: penaltyBreakdown,
        transfers_count: transfersCount,
        free_transfers: transferResult.free_transfers,
        excess_transfers: excessTransfers,
        message: `Transfer penalty applied: ${penaltyPoints} points`
    };
}