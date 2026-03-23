import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const KNOCKOUT_PHASE_PREV = {
    'APERTURA_QF': 'APERTURA_R16',
    'APERTURA_SF': 'APERTURA_QF',
    'APERTURA_FINAL': 'APERTURA_SF'
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

        if (action === 'award_unbreakable_xi') {
            const result = await awardUnbreakableXiBadge(base44, user_id || user.id, phase);
            return Response.json({ status: 'SUCCESS', ...result });
        }

        if (action === 'award_the_originals') {
            const result = await awardTheOriginalsBadge(base44, user_id || user.id);
            return Response.json({ status: 'SUCCESS', ...result });
        }

        if (action === 'award_perfect_matchday') {
            const result = await awardPerfectMatchdayBadge(base44, user_id || user.id, phase);
            return Response.json({ status: 'SUCCESS', ...result });
        }

        if (action === 'migrate_badge_names') {
            const result = await migrateBadgeNames(base44);
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

async function awardPerfectMatchdayBadge(base44, user_id, phase) {
    const VALID_PHASES = ['GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3'];
    if (!VALID_PHASES.includes(phase)) {
        return { awarded: false, reason: 'INVALID_PHASE', phase };
    }

    // Idempotency check
    const existing = await base44.asServiceRole.entities.BadgeAward.filter({ user_id, badge_type: 'PERFECT_MATCHDAY', phase });
    if (existing.length > 0) {
        return { awarded: true, already_existed: true, phase, badge_id: existing[0].id };
    }

    // Get all matches in this matchday phase
    const matches = await base44.asServiceRole.entities.Match.filter({ phase });
    if (matches.length === 0) {
        return { awarded: false, reason: 'NO_MATCHES_IN_PHASE', phase };
    }

    // Get finalized results for all matches in this phase
    const matchIds = matches.map(m => m.id);
    const allResults = await Promise.all(
        matchIds.map(mid => base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: mid }))
    );

    const resultsMap = {};
    for (let i = 0; i < matchIds.length; i++) {
        if (allResults[i].length > 0) {
            resultsMap[matchIds[i]] = allResults[i][0];
        }
    }

    // Only proceed if ALL matches are finalized
    const finalizedCount = Object.keys(resultsMap).length;
    if (finalizedCount < matches.length) {
        return { awarded: false, reason: 'NOT_ALL_MATCHES_FINALIZED', finalized: finalizedCount, total: matches.length, phase };
    }

    // Get user's predictions for this phase
    const allPredictions = await base44.asServiceRole.entities.ProdePrediction.filter({ user_id });
    const phasePredictions = allPredictions.filter(p => matchIds.includes(p.match_id));

    if (phasePredictions.length < matches.length) {
        return { awarded: false, reason: 'MISSING_PREDICTIONS', predicted: phasePredictions.length, total: matches.length, phase };
    }

    // Check each prediction
    let correctCount = 0;
    for (const pred of phasePredictions) {
        const result = resultsMap[pred.match_id];
        if (!result) continue;

        const predOutcome = pred.pred_home_goals > pred.pred_away_goals ? 'HOME' :
                            pred.pred_away_goals > pred.pred_home_goals ? 'AWAY' : 'DRAW';
        const actualOutcome = result.home_goals > result.away_goals ? 'HOME' :
                              result.away_goals > result.home_goals ? 'AWAY' : 'DRAW';

        if (predOutcome === actualOutcome) correctCount++;
    }

    if (correctCount < matches.length) {
        return { awarded: false, reason: 'NOT_ALL_CORRECT', correct_count: correctCount, total_matches: matches.length, phase };
    }

    const badge = await base44.asServiceRole.entities.BadgeAward.create({
        user_id,
        badge_type: 'PERFECT_MATCHDAY',
        phase,
        awarded_at: new Date().toISOString(),
        metadata_json: JSON.stringify({ correct_count: correctCount, total_matches: matches.length })
    });

    return { awarded: true, already_existed: false, correct_count: correctCount, total_matches: matches.length, phase, badge_id: badge.id };
}

async function awardTheOriginalsBadge(base44, user_id) {
    const THRESHOLD = 9;
    const BASE_PHASE = 'APERTURA_R16';
    const TARGET_PHASE = 'APERTURA_FINAL';

    const [finalSquads, r16Squads] = await Promise.all([
        base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase: TARGET_PHASE, status: 'FINAL' }),
        base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase: BASE_PHASE, status: 'FINAL' })
    ]);

    if (finalSquads.length === 0) return { awarded: false, reason: 'NO_FINAL_SQUAD' };
    if (r16Squads.length === 0) return { awarded: false, reason: 'NO_R16_SQUAD' };

    const [finalPlayers, r16Players] = await Promise.all([
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: finalSquads[0].id }),
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: r16Squads[0].id })
    ]);

    const finalStarters = new Set(finalPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));
    const r16Starters = new Set(r16Players.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));

    let keptCount = 0;
    for (const pid of finalStarters) {
        if (r16Starters.has(pid)) keptCount++;
    }

    if (keptCount < THRESHOLD) {
        return { awarded: false, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE };
    }

    // Idempotency check
    const existing = await base44.asServiceRole.entities.BadgeAward.filter({ user_id, badge_type: 'THE_ORIGINALS', phase: TARGET_PHASE });
    if (existing.length > 0) {
        return { awarded: true, already_existed: true, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE, badge_id: existing[0].id };
    }

    const badge = await base44.asServiceRole.entities.BadgeAward.create({
        user_id,
        badge_type: 'THE_ORIGINALS',
        phase: TARGET_PHASE,
        awarded_at: new Date().toISOString(),
        metadata_json: JSON.stringify({ kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE })
    });

    return { awarded: true, already_existed: false, kept_count: keptCount, threshold: THRESHOLD, base_phase: BASE_PHASE, phase: TARGET_PHASE, badge_id: badge.id };
}

export async function awardUnbreakableXiBadge(base44, user_id, phase) {
    const prevPhase = KNOCKOUT_PHASE_PREV[phase];
    if (!prevPhase) {
        return { awarded: false, reason: 'NOT_A_KNOCKOUT_PHASE', phase };
    }

    const currentSquads = await base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase, status: 'FINAL' });
    if (currentSquads.length === 0) return { awarded: false, reason: 'NO_CURRENT_FINAL_SQUAD', phase };

    const prevSquads = await base44.asServiceRole.entities.FantasySquad.filter({ user_id, phase: prevPhase, status: 'FINAL' });
    if (prevSquads.length === 0) return { awarded: false, reason: 'NO_PREVIOUS_FINAL_SQUAD', phase, prev_phase: prevPhase };

    const [currentPlayers, prevPlayers] = await Promise.all([
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: currentSquads[0].id }),
        base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: prevSquads[0].id })
    ]);

    const currentStarters = new Set(currentPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));
    const prevStarters = new Set(prevPlayers.filter(sp => sp.slot_type === 'STARTER').map(sp => sp.player_id));

    let keptCount = 0;
    for (const pid of currentStarters) {
        if (prevStarters.has(pid)) keptCount++;
    }

    if (keptCount < CORE_KEEPER_THRESHOLD) {
        return { awarded: false, kept_count: keptCount, threshold: CORE_KEEPER_THRESHOLD, phase, prev_phase: prevPhase };
    }

    const existing = await base44.asServiceRole.entities.BadgeAward.filter({ user_id, badge_type: 'UNBREAKABLE_XI', phase });
    if (existing.length > 0) {
        return { awarded: true, already_existed: true, kept_count: keptCount, threshold: CORE_KEEPER_THRESHOLD, phase, prev_phase: prevPhase, badge_id: existing[0].id };
    }

    const badge = await base44.asServiceRole.entities.BadgeAward.create({
        user_id,
        badge_type: 'UNBREAKABLE_XI',
        phase,
        awarded_at: new Date().toISOString(),
        metadata_json: JSON.stringify({ kept_count: keptCount, threshold: CORE_KEEPER_THRESHOLD, prev_phase: prevPhase })
    });

    return { awarded: true, already_existed: false, kept_count: keptCount, threshold: CORE_KEEPER_THRESHOLD, phase, prev_phase: prevPhase, badge_id: badge.id };
}

async function migrateBadgeNames(base44) {
    const coreKeeperBadges = await base44.asServiceRole.entities.BadgeAward.filter({ badge_type: 'CORE_KEEPER' });
    const loyalCoreBadges = await base44.asServiceRole.entities.BadgeAward.filter({ badge_type: 'LOYAL_CORE' });

    let coreKeeperUpdated = 0;
    let loyalCoreUpdated = 0;

    for (const badge of coreKeeperBadges) {
        await base44.asServiceRole.entities.BadgeAward.update(badge.id, { badge_type: 'UNBREAKABLE_XI' });
        coreKeeperUpdated++;
    }

    for (const badge of loyalCoreBadges) {
        await base44.asServiceRole.entities.BadgeAward.update(badge.id, { badge_type: 'THE_ORIGINALS' });
        loyalCoreUpdated++;
    }

    return {
        core_keeper_migrated_to_unbreakable_xi: coreKeeperUpdated,
        loyal_core_migrated_to_the_originals: loyalCoreUpdated,
        total_migrated: coreKeeperUpdated + loyalCoreUpdated
    };
}