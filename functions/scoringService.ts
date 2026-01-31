import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Scoring Service - Handles all score-related operations with strict validation
 * 
 * Endpoints:
 * - POST { action: "award_points" } - Award points via ledger (idempotent)
 * - POST { action: "void_entry" } - Void a ledger entry (soft delete)
 * - POST { action: "recalculate_cache" } - Recalculate user score cache
 * - POST { action: "get_user_score" } - Get user's current score
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
            case 'award_points':
                return await awardPoints(base44, user, body);
            case 'void_entry':
                return await voidEntry(base44, user, body);
            case 'recalculate_cache':
                return await recalculateCache(base44, user, body);
            case 'get_user_score':
                return await getUserScore(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Scoring service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Award points to a user via the append-only ledger
 * Strictly idempotent - will not create duplicate entries
 */
async function awardPoints(base44, user, body) {
    const { 
        target_user_id, 
        points, 
        reason, 
        source_type, 
        source_id, 
        idempotency_key,
        metadata 
    } = body;

    // Server-side validation
    const errors = [];
    if (!target_user_id || typeof target_user_id !== 'string') {
        errors.push('target_user_id is required and must be a string');
    }
    if (typeof points !== 'number' || isNaN(points)) {
        errors.push('points is required and must be a number');
    }
    if (!reason || typeof reason !== 'string') {
        errors.push('reason is required and must be a string');
    }
    if (!source_type || !['match_result', 'manual_adjustment', 'bonus', 'penalty', 'system_correction'].includes(source_type)) {
        errors.push('source_type is required and must be one of: match_result, manual_adjustment, bonus, penalty, system_correction');
    }
    if (!idempotency_key || typeof idempotency_key !== 'string') {
        errors.push('idempotency_key is required and must be a string');
    }

    if (errors.length > 0) {
        await createAuditLog(base44, {
            action: 'score_award_validation_failed',
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            details: { errors, body },
            success: false,
            error_message: errors.join('; ')
        });
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Admin check for manual adjustments and corrections
    if (['manual_adjustment', 'system_correction'].includes(source_type) && user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'score_award_unauthorized',
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            details: { source_type, target_user_id },
            success: false,
            error_message: 'Non-admin attempted manual adjustment'
        });
        return Response.json({ error: 'Admin access required for manual adjustments' }, { status: 403 });
    }

    // Check idempotency - prevent duplicate entries
    const existing = await base44.asServiceRole.entities.ScoreLedger.filter({
        idempotency_key: idempotency_key
    });

    if (existing.length > 0) {
        // Already processed - return existing entry (idempotent success)
        await createAuditLog(base44, {
            action: 'score_award_idempotent_skip',
            entity_type: 'ScoreLedger',
            entity_id: existing[0].id,
            actor_id: user.id,
            actor_type: 'user',
            severity: 'info',
            details: { idempotency_key },
            idempotency_key,
            success: true
        });
        return Response.json({ 
            success: true, 
            idempotent: true, 
            entry: existing[0],
            message: 'Entry already exists with this idempotency key'
        });
    }

    // Create the ledger entry
    const entry = await base44.asServiceRole.entities.ScoreLedger.create({
        user_id: target_user_id,
        points,
        reason,
        source_type,
        source_id: source_id || null,
        idempotency_key,
        metadata: metadata || {},
        is_voided: false
    });

    // Mark cache as needing recalculation
    await markCacheStale(base44, target_user_id);

    // Audit log
    await createAuditLog(base44, {
        action: 'score_awarded',
        entity_type: 'ScoreLedger',
        entity_id: entry.id,
        actor_id: user.id,
        actor_type: user.role === 'admin' ? 'admin' : 'user',
        severity: 'info',
        details: { target_user_id, points, reason, source_type, source_id },
        idempotency_key,
        success: true
    });

    return Response.json({ success: true, entry });
}

/**
 * Void a ledger entry (soft delete - preserves history)
 * Only admins can void entries
 */
async function voidEntry(base44, user, body) {
    const { entry_id, void_reason } = body;

    // Admin check
    if (user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'score_void_unauthorized',
            entity_id: entry_id,
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            success: false,
            error_message: 'Non-admin attempted to void entry'
        });
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Validation
    if (!entry_id || typeof entry_id !== 'string') {
        return Response.json({ error: 'entry_id is required' }, { status: 400 });
    }
    if (!void_reason || typeof void_reason !== 'string') {
        return Response.json({ error: 'void_reason is required' }, { status: 400 });
    }

    // Get the entry
    const entries = await base44.asServiceRole.entities.ScoreLedger.filter({ id: entry_id });
    if (entries.length === 0) {
        return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    const entry = entries[0];

    // Check if already voided
    if (entry.is_voided) {
        return Response.json({ 
            success: true, 
            idempotent: true, 
            message: 'Entry already voided' 
        });
    }

    // Void the entry (soft delete)
    await base44.asServiceRole.entities.ScoreLedger.update(entry_id, {
        is_voided: true,
        void_reason,
        voided_at: new Date().toISOString(),
        voided_by: user.id
    });

    // Mark cache as needing recalculation
    await markCacheStale(base44, entry.user_id);

    // Audit log
    await createAuditLog(base44, {
        action: 'score_entry_voided',
        entity_type: 'ScoreLedger',
        entity_id: entry_id,
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'warning',
        details: { 
            user_id: entry.user_id, 
            original_points: entry.points, 
            void_reason 
        },
        success: true
    });

    return Response.json({ success: true, message: 'Entry voided' });
}

/**
 * Recalculate user score cache from ledger (source of truth)
 */
async function recalculateCache(base44, user, body) {
    const { target_user_id } = body;

    if (!target_user_id || typeof target_user_id !== 'string') {
        return Response.json({ error: 'target_user_id is required' }, { status: 400 });
    }

    // Get all ledger entries for user
    const entries = await base44.asServiceRole.entities.ScoreLedger.filter({
        user_id: target_user_id
    });

    let totalPoints = 0;
    let totalEntries = entries.length;
    let voidedEntries = 0;
    let lastEntryId = null;

    for (const entry of entries) {
        if (entry.is_voided) {
            voidedEntries++;
        } else {
            totalPoints += entry.points || 0;
        }
        if (!lastEntryId || entry.created_date > lastEntryId) {
            lastEntryId = entry.id;
        }
    }

    // Find or create cache entry
    const existingCache = await base44.asServiceRole.entities.UserScoreCache.filter({
        user_id: target_user_id
    });

    const cacheData = {
        user_id: target_user_id,
        total_points: totalPoints,
        total_entries: totalEntries,
        voided_entries: voidedEntries,
        last_calculated_at: new Date().toISOString(),
        last_ledger_entry_id: lastEntryId,
        needs_recalculation: false
    };

    let cache;
    if (existingCache.length > 0) {
        cache = await base44.asServiceRole.entities.UserScoreCache.update(existingCache[0].id, cacheData);
    } else {
        cache = await base44.asServiceRole.entities.UserScoreCache.create(cacheData);
    }

    return Response.json({ success: true, cache });
}

/**
 * Get user's current score (uses cache, recalculates if stale)
 */
async function getUserScore(base44, user, body) {
    const { target_user_id } = body;
    const userId = target_user_id || user.id;

    // Check cache
    const caches = await base44.asServiceRole.entities.UserScoreCache.filter({
        user_id: userId
    });

    if (caches.length > 0 && !caches[0].needs_recalculation) {
        return Response.json({ 
            success: true, 
            score: caches[0].total_points,
            from_cache: true,
            cache: caches[0]
        });
    }

    // Recalculate
    const result = await recalculateCache(base44, user, { target_user_id: userId });
    const data = await result.json();
    
    return Response.json({
        success: true,
        score: data.cache?.total_points || 0,
        from_cache: false,
        cache: data.cache
    });
}

/**
 * Mark a user's score cache as stale
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