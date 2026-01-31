import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Match Service - Handles match result management with safe promotion flow
 * 
 * Flow: candidate → confirmed → locked
 * 
 * Endpoints:
 * - POST { action: "create_match" } - Create a new match result (candidate status)
 * - POST { action: "confirm_match" } - Promote candidate to confirmed
 * - POST { action: "lock_match" } - Lock the match (final, triggers scoring)
 * - POST { action: "dispute_match" } - Flag match as disputed
 * - POST { action: "void_match" } - Void a match (admin only)
 * - POST { action: "get_match" } - Get match details
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
            case 'create_match':
                return await createMatch(base44, user, body);
            case 'confirm_match':
                return await confirmMatch(base44, user, body);
            case 'lock_match':
                return await lockMatch(base44, user, body);
            case 'dispute_match':
                return await disputeMatch(base44, user, body);
            case 'void_match':
                return await voidMatch(base44, user, body);
            case 'get_match':
                return await getMatch(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Match service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Create a new match result in candidate status
 */
async function createMatch(base44, user, body) {
    const { match_id, participant_ids, winner_id, result_data, source_url, is_external_source } = body;

    // Server-side validation
    const errors = [];
    if (!match_id || typeof match_id !== 'string') {
        errors.push('match_id is required and must be a string');
    }
    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
        errors.push('participant_ids is required and must be an array with at least 2 participants');
    }
    if (winner_id && !participant_ids?.includes(winner_id)) {
        errors.push('winner_id must be one of the participant_ids');
    }

    if (errors.length > 0) {
        await createAuditLog(base44, {
            action: 'match_create_validation_failed',
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            details: { errors, body },
            success: false,
            error_message: errors.join('; ')
        });
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Check for duplicate match_id
    const existing = await base44.asServiceRole.entities.MatchResult.filter({ match_id });
    if (existing.length > 0) {
        return Response.json({ 
            error: 'Match with this ID already exists',
            existing_match: existing[0]
        }, { status: 409 });
    }

    // If external source, validate against whitelist
    if (is_external_source && source_url) {
        const isAllowed = await validateSourceUrl(base44, source_url);
        if (!isAllowed) {
            await createAuditLog(base44, {
                action: 'match_create_url_blocked',
                actor_id: user.id,
                actor_type: 'user',
                severity: 'warning',
                details: { source_url, match_id },
                success: false,
                error_message: 'Source URL not in whitelist'
            });
            return Response.json({ 
                error: 'Source URL not in approved whitelist',
                blocked_url: source_url
            }, { status: 403 });
        }
    }

    // Create the match in candidate status
    const match = await base44.asServiceRole.entities.MatchResult.create({
        match_id,
        participant_ids,
        status: 'candidate',
        winner_id: winner_id || null,
        result_data: result_data || {},
        source_url: source_url || null,
        is_external_source: is_external_source || false,
        points_awarded: false,
        ledger_entry_ids: []
    });

    await createAuditLog(base44, {
        action: 'match_created',
        entity_type: 'MatchResult',
        entity_id: match.id,
        actor_id: user.id,
        actor_type: user.role === 'admin' ? 'admin' : 'user',
        severity: 'info',
        details: { match_id, participant_ids, status: 'candidate' },
        success: true
    });

    return Response.json({ success: true, match });
}

/**
 * Confirm a match result (promote from candidate to confirmed)
 */
async function confirmMatch(base44, user, body) {
    const { match_entity_id } = body;

    if (!match_entity_id) {
        return Response.json({ error: 'match_entity_id is required' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.MatchResult.filter({ id: match_entity_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];

    // Validate current status
    if (match.status !== 'candidate') {
        await createAuditLog(base44, {
            action: 'match_confirm_invalid_status',
            entity_type: 'MatchResult',
            entity_id: match_entity_id,
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            details: { current_status: match.status, required_status: 'candidate' },
            success: false
        });
        return Response.json({ 
            error: `Cannot confirm match in ${match.status} status. Must be in candidate status.`,
            current_status: match.status
        }, { status: 400 });
    }

    // Must have a winner to confirm
    if (!match.winner_id) {
        return Response.json({ error: 'Match must have a winner_id to be confirmed' }, { status: 400 });
    }

    // Update to confirmed
    const updated = await base44.asServiceRole.entities.MatchResult.update(match_entity_id, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id
    });

    await createAuditLog(base44, {
        action: 'match_confirmed',
        entity_type: 'MatchResult',
        entity_id: match_entity_id,
        actor_id: user.id,
        actor_type: user.role === 'admin' ? 'admin' : 'user',
        severity: 'info',
        details: { match_id: match.match_id, previous_status: 'candidate' },
        success: true
    });

    return Response.json({ success: true, match: updated });
}

/**
 * Lock a match result (final - triggers point awarding)
 * Only admins can lock matches
 */
async function lockMatch(base44, user, body) {
    const { match_entity_id, points_config } = body;

    // Admin check
    if (user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'match_lock_unauthorized',
            entity_id: match_entity_id,
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            success: false,
            error_message: 'Non-admin attempted to lock match'
        });
        return Response.json({ error: 'Admin access required to lock matches' }, { status: 403 });
    }

    if (!match_entity_id) {
        return Response.json({ error: 'match_entity_id is required' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.MatchResult.filter({ id: match_entity_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];

    // Validate current status
    if (match.status !== 'confirmed') {
        return Response.json({ 
            error: `Cannot lock match in ${match.status} status. Must be in confirmed status.`,
            current_status: match.status
        }, { status: 400 });
    }

    // Check if points already awarded (idempotency)
    if (match.points_awarded) {
        return Response.json({ 
            success: true,
            idempotent: true,
            message: 'Points already awarded for this match',
            match
        });
    }

    // Award points based on config or defaults
    const winnerPoints = points_config?.winner_points || 10;
    const loserPoints = points_config?.loser_points || 0;
    const participantPoints = points_config?.participant_points || 1;

    const ledgerEntryIds = [];

    // Award winner points
    if (match.winner_id) {
        const winnerIdempotencyKey = `match_${match.match_id}_winner_${match.winner_id}`;
        
        const existing = await base44.asServiceRole.entities.ScoreLedger.filter({
            idempotency_key: winnerIdempotencyKey
        });

        if (existing.length === 0) {
            const entry = await base44.asServiceRole.entities.ScoreLedger.create({
                user_id: match.winner_id,
                points: winnerPoints,
                reason: `Won match ${match.match_id}`,
                source_type: 'match_result',
                source_id: match_entity_id,
                idempotency_key: winnerIdempotencyKey,
                metadata: { match_id: match.match_id, role: 'winner' },
                is_voided: false
            });
            ledgerEntryIds.push(entry.id);
            await markCacheStale(base44, match.winner_id);
        }
    }

    // Award participation/loser points to other participants
    for (const participantId of match.participant_ids) {
        if (participantId === match.winner_id) continue;

        const idempotencyKey = `match_${match.match_id}_participant_${participantId}`;
        
        const existing = await base44.asServiceRole.entities.ScoreLedger.filter({
            idempotency_key: idempotencyKey
        });

        if (existing.length === 0) {
            const points = loserPoints || participantPoints;
            const entry = await base44.asServiceRole.entities.ScoreLedger.create({
                user_id: participantId,
                points: points,
                reason: `Participated in match ${match.match_id}`,
                source_type: 'match_result',
                source_id: match_entity_id,
                idempotency_key: idempotencyKey,
                metadata: { match_id: match.match_id, role: 'participant' },
                is_voided: false
            });
            ledgerEntryIds.push(entry.id);
            await markCacheStale(base44, participantId);
        }
    }

    // Update match to locked
    const updated = await base44.asServiceRole.entities.MatchResult.update(match_entity_id, {
        status: 'locked',
        locked_at: new Date().toISOString(),
        locked_by: user.id,
        points_awarded: true,
        ledger_entry_ids: [...(match.ledger_entry_ids || []), ...ledgerEntryIds]
    });

    await createAuditLog(base44, {
        action: 'match_locked',
        entity_type: 'MatchResult',
        entity_id: match_entity_id,
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'info',
        details: { 
            match_id: match.match_id, 
            ledger_entries_created: ledgerEntryIds.length,
            winner_id: match.winner_id
        },
        success: true
    });

    return Response.json({ 
        success: true, 
        match: updated,
        ledger_entries_created: ledgerEntryIds.length
    });
}

/**
 * Dispute a match result
 */
async function disputeMatch(base44, user, body) {
    const { match_entity_id, dispute_reason } = body;

    if (!match_entity_id) {
        return Response.json({ error: 'match_entity_id is required' }, { status: 400 });
    }
    if (!dispute_reason || typeof dispute_reason !== 'string') {
        return Response.json({ error: 'dispute_reason is required' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.MatchResult.filter({ id: match_entity_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];

    // Cannot dispute locked matches
    if (match.status === 'locked') {
        return Response.json({ 
            error: 'Cannot dispute a locked match. Contact admin for corrections.',
            current_status: match.status
        }, { status: 400 });
    }

    // User must be a participant to dispute (or admin)
    if (user.role !== 'admin' && !match.participant_ids.includes(user.id)) {
        return Response.json({ error: 'Only participants can dispute a match' }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities.MatchResult.update(match_entity_id, {
        status: 'disputed',
        dispute_reason
    });

    await createAuditLog(base44, {
        action: 'match_disputed',
        entity_type: 'MatchResult',
        entity_id: match_entity_id,
        actor_id: user.id,
        actor_type: user.role === 'admin' ? 'admin' : 'user',
        severity: 'warning',
        details: { match_id: match.match_id, dispute_reason },
        success: true
    });

    return Response.json({ success: true, match: updated });
}

/**
 * Void a match result (admin only)
 * If points were awarded, they will be voided in the ledger
 */
async function voidMatch(base44, user, body) {
    const { match_entity_id, void_reason } = body;

    // Admin check
    if (user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'match_void_unauthorized',
            entity_id: match_entity_id,
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            success: false,
            error_message: 'Non-admin attempted to void match'
        });
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!match_entity_id) {
        return Response.json({ error: 'match_entity_id is required' }, { status: 400 });
    }
    if (!void_reason) {
        return Response.json({ error: 'void_reason is required' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.MatchResult.filter({ id: match_entity_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];

    // Void associated ledger entries if points were awarded
    if (match.points_awarded && match.ledger_entry_ids?.length > 0) {
        for (const entryId of match.ledger_entry_ids) {
            const entries = await base44.asServiceRole.entities.ScoreLedger.filter({ id: entryId });
            if (entries.length > 0 && !entries[0].is_voided) {
                await base44.asServiceRole.entities.ScoreLedger.update(entryId, {
                    is_voided: true,
                    void_reason: `Match ${match.match_id} voided: ${void_reason}`,
                    voided_at: new Date().toISOString(),
                    voided_by: user.id
                });
                await markCacheStale(base44, entries[0].user_id);
            }
        }
    }

    const updated = await base44.asServiceRole.entities.MatchResult.update(match_entity_id, {
        status: 'voided',
        void_reason
    });

    await createAuditLog(base44, {
        action: 'match_voided',
        entity_type: 'MatchResult',
        entity_id: match_entity_id,
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'critical',
        details: { 
            match_id: match.match_id, 
            void_reason,
            ledger_entries_voided: match.ledger_entry_ids?.length || 0
        },
        success: true
    });

    return Response.json({ 
        success: true, 
        match: updated,
        ledger_entries_voided: match.ledger_entry_ids?.length || 0
    });
}

/**
 * Get match details
 */
async function getMatch(base44, user, body) {
    const { match_entity_id, match_id } = body;

    let matches;
    if (match_entity_id) {
        matches = await base44.asServiceRole.entities.MatchResult.filter({ id: match_entity_id });
    } else if (match_id) {
        matches = await base44.asServiceRole.entities.MatchResult.filter({ match_id });
    } else {
        return Response.json({ error: 'match_entity_id or match_id is required' }, { status: 400 });
    }

    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    return Response.json({ success: true, match: matches[0] });
}

/**
 * Validate source URL against whitelist
 */
async function validateSourceUrl(base44, url) {
    const whitelist = await base44.asServiceRole.entities.UrlWhitelist.filter({ is_active: true });
    
    for (const entry of whitelist) {
        let isMatch = false;
        
        if (entry.pattern_type === 'exact') {
            isMatch = url === entry.pattern;
        } else if (entry.pattern_type === 'prefix') {
            isMatch = url.startsWith(entry.pattern);
        } else if (entry.pattern_type === 'regex') {
            try {
                const regex = new RegExp(entry.pattern);
                isMatch = regex.test(url);
            } catch (e) {
                console.error('Invalid regex pattern:', entry.pattern, e);
            }
        }

        if (isMatch) {
            // Update usage stats
            await base44.asServiceRole.entities.UrlWhitelist.update(entry.id, {
                last_used_at: new Date().toISOString(),
                use_count: (entry.use_count || 0) + 1
            });
            return true;
        }
    }

    return false;
}

/**
 * Mark user's score cache as stale
 */
async function markCacheStale(base44, userId) {
    const caches = await base44.asServiceRole.entities.UserScoreCache.filter({
        user_id: userId
    });

    if (caches.length > 0) {
        await base44.asServiceRole.entities.UserScoreCache.update(caches[0].id, {
            needs_recalculation: true
        });
    }
}

/**
 * Create an audit log entry
 */
async function createAuditLog(base44, data) {
    try {
        await base44.asServiceRole.entities.AuditLog.create(data);
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
}