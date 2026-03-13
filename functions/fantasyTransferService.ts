import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { awardCoreKeeperBadge } from './badgeService';

/**
 * Fantasy Transfer Service
 * Handles transfer detection, validation, penalties, and phase locks
 * 
 * TRANSFER RULES (source of truth):
 * - R32: free=2; transfers 3-5 => -3 each; 6-7 => -4 each
 * - R16: free=3; transfers 4-6 => -2 each; 7-11 => -3 each
 * - QF: free=2; transfers 3-5 => -4 each
 * - SF: free=2; transfers 3-5 => -5 each
 * - FINAL: free=5; transfers 6+ => -7 each
 */

const PHASE_ORDER = ['PRE_TOURNAMENT', 'GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];

const KNOCKOUT_PHASES = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];

const TRANSFER_RULES = {
    'ROUND_OF_32': {
        free_transfers: 2,
        max_allowed_transfers: 11,
        tiers: [
            { max: 5, penalty: -3 },  // transfers 3-5: -3 each
            { max: 7, penalty: -4 }   // transfers 6-7: -4 each
        ]
    },
    'ROUND_OF_16': {
        free_transfers: 3,
        max_allowed_transfers: 11,
        tiers: [
            { max: 6, penalty: -2 },  // transfers 4-6: -2 each
            { max: 11, penalty: -3 }  // transfers 7-11: -3 each
        ]
    },
    'QUARTERFINALS': {
        free_transfers: 2,
        max_allowed_transfers: 5,
        tiers: [
            { max: 5, penalty: -4 }  // transfers 3-5: -4 each (HARD CAP at 5)
        ]
    },
    'SEMIFINALS': {
        free_transfers: 2,
        max_allowed_transfers: 5,
        tiers: [
            { max: 5, penalty: -5 }  // transfers 3-5: -5 each (HARD CAP at 5)
        ]
    },
    'FINAL': {
        free_transfers: 5,
        max_allowed_transfers: Infinity,
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

        if (action === 'ensure_baseline_squad') {
            const result = await ensureBaselineSquadForPhase(base44, user_id || user.id, phase || target_phase);
            return Response.json(result);
        }

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

/**
 * Ensure a baseline squad exists for a knockout phase
 * Copies from most recent previous phase if missing
 */
async function ensureBaselineSquadForPhase(base44, user_id, phase) {
    if (!KNOCKOUT_PHASES.includes(phase)) {
        return {
            status: 'ERROR',
            code: 'INVALID_PHASE',
            message: 'Phase must be a knockout phase',
            valid_phases: KNOCKOUT_PHASES
        };
    }

    // Check if squad already exists
    const existingSquads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase,
        status: 'FINAL'
    });

    if (existingSquads.length > 0) {
        return {
            status: 'SUCCESS',
            baseline_status: 'EXISTING',
            squad_id: existingSquads[0].id,
            phase,
            message: 'Squad already exists for this phase'
        };
    }

    // Find most recent previous phase squad
    const phaseIndex = PHASE_ORDER.indexOf(phase);
    let previousSquad = null;

    // Try knockout phases first (descending from current)
    for (let i = phaseIndex - 1; i >= 0; i--) {
        const testPhase = PHASE_ORDER[i];
        const squads = await base44.asServiceRole.entities.FantasySquad.filter({
            user_id,
            phase: testPhase,
            status: 'FINAL'
        });
        
        if (squads.length > 0) {
            previousSquad = squads[0];
            break;
        }
    }

    if (!previousSquad) {
        return {
            status: 'ERROR',
            code: 'NO_PREVIOUS_SQUAD',
            message: 'No previous finalized squad found to copy from',
            hint: 'Create a finalized squad for an earlier phase first (e.g., GROUP_MD3 or previous knockout phase)'
        };
    }

    // Load previous squad players
    const previousPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: previousSquad.id
    });

    if (previousPlayers.length !== 14) {
        return {
            status: 'ERROR',
            code: 'INVALID_PREVIOUS_SQUAD',
            message: `Previous squad has ${previousPlayers.length} players, expected 14 (11 starters + 3 bench)`
        };
    }

    // Create new squad for current phase
    const newSquad = await base44.asServiceRole.entities.FantasySquad.create({
        user_id,
        phase,
        status: 'FINAL',
        budget_cap: previousSquad.budget_cap || 150,
        total_cost: previousSquad.total_cost || 0,
        finalized_at: new Date().toISOString()
    });

    // Copy all players
    const starters = previousPlayers.filter(sp => sp.slot_type === 'STARTER');
    const bench = previousPlayers.filter(sp => sp.slot_type === 'BENCH');

    for (const sp of starters) {
        await base44.asServiceRole.entities.FantasySquadPlayer.create({
            squad_id: newSquad.id,
            player_id: sp.player_id,
            slot_type: 'STARTER',
            starter_position: sp.starter_position,
            is_captain: sp.is_captain || false
        });
    }

    for (const sp of bench) {
        await base44.asServiceRole.entities.FantasySquadPlayer.create({
            squad_id: newSquad.id,
            player_id: sp.player_id,
            slot_type: 'BENCH',
            bench_order: sp.bench_order || 0,
            is_captain: false
        });
    }

    return {
        status: 'SUCCESS',
        baseline_status: 'CREATED',
        squad_id: newSquad.id,
        phase,
        copied_from_phase: previousSquad.phase,
        copied_from_squad_id: previousSquad.id,
        players_copied: previousPlayers.length,
        message: `Baseline squad created by copying from ${previousSquad.phase}`
    };
}

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
    // Ensure baseline squad exists first
    const baselineResult = await ensureBaselineSquadForPhase(base44, user_id, phase);
    if (baselineResult.status !== 'SUCCESS') {
        return baselineResult;
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

    const currentSquad = squads[0];

    const rules = TRANSFER_RULES[phase];
    if (!rules) {
        return {
            status: 'ERROR',
            code: 'INVALID_PHASE',
            message: `No transfer rules defined for phase ${phase}`
        };
    }

    const transferResult = await calculateTransfers(base44, user_id, currentSquad.id, phase);

    if (transferResult.status !== 'SUCCESS') {
        return transferResult;
    }

    let transfersCount = transferResult.transfers_count;

    // Override for testing
    if (forceTransfersCount !== null && forceTransfersCount !== undefined) {
        transfersCount = forceTransfersCount;
    }

    // Get lock status for this phase
    const lockStatus = await checkPhaseLock(base44, phase);

    return {
        status: 'SUCCESS',
        transfers_count: transfersCount,
        baseline_status: baselineResult.baseline_status,
        is_locked: lockStatus.is_locked,
        lock_time: lockStatus.lock_time,
        first_match_time: lockStatus.first_match_time,
        message: `Transfers recorded: ${transfersCount} (no penalties applied)`
    };
}