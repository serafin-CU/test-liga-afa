import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const KNOCKOUT_PHASE_PREV = {
    'ROUND_OF_16': 'ROUND_OF_32',
    'QUARTERFINALS': 'ROUND_OF_16',
    'SEMIFINALS': 'QUARTERFINALS',
    'FINAL': 'SEMIFINALS'
};

const CORE_KEEPER_THRESHOLD = 8;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ status: 'ERROR', code: 'UNAUTHORIZED' }, { status: 401 });
        }

        const { action, user_id, phase } = await req.json();

        if (action === 'award_core_keeper') {
            const result = await awardCoreKeeperBadge(base44, user_id || user.id, phase);
            return Response.json({ status: 'SUCCESS', ...result });
        }

        if (action === 'award_loyal_core') {
            const result = await awardLoyalCoreBadge(base44, user_id || user.id);
            return Response.json({ status: 'SUCCESS', ...result });
        }

        return Response.json({ status: 'ERROR', code: 'INVALID_ACTION' }, { status: 400 });

    } catch (error) {
        return Response.json({
            status: 'ERROR',
            code: 'INTERNAL_ERROR',
            message: error.message
        }, { status: 500 });
    }
});

async function awardLoyalCoreBadge(base44, user_id) {
    const THRESHOLD = 9;
    const BASE_PHASE = 'ROUND_OF_32';
    const TARGET_PHASE = 'FINAL';

    const [finalSquads, r32Squads] = await Promise.all([
        base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase: TARGET_PHASE, status: 'FINAL' }),
        base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase: BASE_PHASE, status: 'FINAL' })
    ]);

    if (finalSquads.length === 0) return { awarded: false, reason: 'NO_FINAL_SQUAD' };
    if (r32Squads.length === 0) return { awarded: false, reason: 'NO_R32_SQUAD' };

    const [finalPlayers, r32Players] = await Promise.all([
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: finalSquads[0].id }),
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: r32Squads[0].id })
    ]);

    const finalStarters = new Set(finalPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));
    const r32Starters = new Set(r32Players.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));

    let keptCount = 0;
    for (const pid of finalStarters) {
        if (r32Starters.has(pid)) keptCount++;
    }

    if (keptCount < THRESHOLD) {
        return { awarded: false, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE };
    }

    // Idempotency check
    const existing = await base44.asServiceRole.entities.BadgeAward.filter({ user_id, badge_type: 'LOYAL_CORE', phase: TARGET_PHASE });
    if (existing.length > 0) {
        return { awarded: true, already_existed: true, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE, badge_id: existing[0].id };
    }

    const badge = await base44.asServiceRole.entities.BadgeAward.create({
        user_id,
        badge_type: 'LOYAL_CORE',
        phase: TARGET_PHASE,
        awarded_at: new Date().toISOString(),
        metadata_json: JSON.stringify({ kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE })
    });

    return { awarded: true, already_existed: false, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE, badge_id: badge.id };
}

export async function awardCoreKeeperBadge(base44, user_id, phase) {
    // Only valid for knockout phases
    const prevPhase = KNOCKOUT_PHASE_PREV[phase];
    if (!prevPhase) {
        return {
            awarded: false,
            reason: 'NOT_A_KNOCKOUT_PHASE',
            phase
        };
    }

    // Load current phase squad (FINAL)
    const currentSquads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase,
        status: 'FINAL'
    });

    if (currentSquads.length === 0) {
        return { awarded: false, reason: 'NO_CURRENT_FINAL_SQUAD', phase };
    }

    // Load previous phase squad (FINAL)
    const prevSquads = await base44.asServiceRole.entities.FantasySquad.filter({
        user_id,
        phase: prevPhase,
        status: 'FINAL'
    });

    if (prevSquads.length === 0) {
        return { awarded: false, reason: 'NO_PREVIOUS_FINAL_SQUAD', phase, prev_phase: prevPhase };
    }

    // Get starters from both squads
    const currentPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: currentSquads[0].id
    });
    const prevPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({
        squad_id: prevSquads[0].id
    });

    const currentStarters = new Set(
        currentPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id)
    );
    const prevStarters = new Set(
        prevPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id)
    );

    let keptCount = 0;
    for (const pid of currentStarters) {
        if (prevStarters.has(pid)) keptCount++;
    }

    if (keptCount < CORE_KEEPER_THRESHOLD) {
        return {
            awarded: false,
            kept_count: keptCount,
            threshold: CORE_KEEPER_THRESHOLD,
            phase,
            prev_phase: prevPhase
        };
    }

    // Idempotent upsert: check if badge already exists
    const existing = await base44.asServiceRole.entities.BadgeAward.filter({
        user_id,
        badge_type: 'CORE_KEEPER',
        phase
    });

    if (existing.length > 0) {
        return {
            awarded: true,
            already_existed: true,
            kept_count: keptCount,
            threshold: CORE_KEEPER_THRESHOLD,
            phase,
            prev_phase: prevPhase,
            badge_id: existing[0].id
        };
    }

    // Create badge
    const badge = await base44.asServiceRole.entities.BadgeAward.create({
        user_id,
        badge_type: 'CORE_KEEPER',
        phase,
        awarded_at: new Date().toISOString(),
        metadata_json: JSON.stringify({
            kept_count: keptCount,
            threshold: CORE_KEEPER_THRESHOLD,
            prev_phase: prevPhase
        })
    });

    return {
        awarded: true,
        already_existed: false,
        kept_count: keptCount,
        threshold: CORE_KEEPER_THRESHOLD,
        phase,
        prev_phase: prevPhase,
        badge_id: badge.id
    };
}