import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Data Ingestion Service - Handles external data with strict URL validation
 * 
 * All external URLs are validated against whitelist before processing.
 * Blocked URLs are logged for security monitoring.
 * 
 * Endpoints:
 * - POST { action: "validate_url" } - Check if URL is whitelisted
 * - POST { action: "add_whitelist_entry" } - Add URL to whitelist (admin only)
 * - POST { action: "remove_whitelist_entry" } - Remove URL from whitelist (admin only)
 * - POST { action: "list_whitelist" } - List all whitelist entries
 * - POST { action: "ingest_match_data" } - Ingest match data from external URL
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
            case 'validate_url':
                return await validateUrl(base44, user, body);
            case 'add_whitelist_entry':
                return await addWhitelistEntry(base44, user, body);
            case 'remove_whitelist_entry':
                return await removeWhitelistEntry(base44, user, body);
            case 'list_whitelist':
                return await listWhitelist(base44, user, body);
            case 'ingest_match_data':
                return await ingestMatchData(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Data ingestion service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Validate a URL against the whitelist
 */
async function validateUrl(base44, user, body) {
    const { url } = body;

    if (!url || typeof url !== 'string') {
        return Response.json({ error: 'url is required' }, { status: 400 });
    }

    const result = await checkUrlAgainstWhitelist(base44, url);
    
    if (!result.allowed) {
        await createAuditLog(base44, {
            action: 'url_validation_blocked',
            actor_id: user.id,
            actor_type: user.role === 'admin' ? 'admin' : 'user',
            severity: 'warning',
            details: { url, reason: 'Not in whitelist' },
            success: false
        });
    }

    return Response.json({ 
        success: true, 
        allowed: result.allowed,
        matched_entry: result.matchedEntry || null
    });
}

/**
 * Add a URL pattern to the whitelist (admin only)
 */
async function addWhitelistEntry(base44, user, body) {
    // Admin check
    if (user.role !== 'admin') {
        await createAuditLog(base44, {
            action: 'whitelist_add_unauthorized',
            actor_id: user.id,
            actor_type: 'user',
            severity: 'warning',
            success: false,
            error_message: 'Non-admin attempted to add whitelist entry'
        });
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { pattern, pattern_type, name, description } = body;

    // Validation
    const errors = [];
    if (!pattern || typeof pattern !== 'string') {
        errors.push('pattern is required and must be a string');
    }
    if (!pattern_type || !['exact', 'prefix', 'regex'].includes(pattern_type)) {
        errors.push('pattern_type is required and must be one of: exact, prefix, regex');
    }
    if (!name || typeof name !== 'string') {
        errors.push('name is required and must be a string');
    }

    // Validate regex pattern if applicable
    if (pattern_type === 'regex') {
        try {
            new RegExp(pattern);
        } catch (e) {
            errors.push('Invalid regex pattern: ' + e.message);
        }
    }

    if (errors.length > 0) {
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Check for duplicate
    const existing = await base44.asServiceRole.entities.UrlWhitelist.filter({ pattern });
    if (existing.length > 0) {
        return Response.json({ 
            error: 'Pattern already exists in whitelist',
            existing_entry: existing[0]
        }, { status: 409 });
    }

    const entry = await base44.asServiceRole.entities.UrlWhitelist.create({
        pattern,
        pattern_type,
        name,
        description: description || '',
        is_active: true,
        added_by: user.id,
        use_count: 0
    });

    await createAuditLog(base44, {
        action: 'whitelist_entry_added',
        entity_type: 'UrlWhitelist',
        entity_id: entry.id,
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'info',
        details: { pattern, pattern_type, name },
        success: true
    });

    return Response.json({ success: true, entry });
}

/**
 * Remove (deactivate) a whitelist entry (admin only)
 */
async function removeWhitelistEntry(base44, user, body) {
    // Admin check
    if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { entry_id } = body;

    if (!entry_id) {
        return Response.json({ error: 'entry_id is required' }, { status: 400 });
    }

    const entries = await base44.asServiceRole.entities.UrlWhitelist.filter({ id: entry_id });
    if (entries.length === 0) {
        return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Soft delete - deactivate instead of delete
    await base44.asServiceRole.entities.UrlWhitelist.update(entry_id, {
        is_active: false
    });

    await createAuditLog(base44, {
        action: 'whitelist_entry_removed',
        entity_type: 'UrlWhitelist',
        entity_id: entry_id,
        actor_id: user.id,
        actor_type: 'admin',
        severity: 'warning',
        details: { pattern: entries[0].pattern },
        success: true
    });

    return Response.json({ success: true, message: 'Entry deactivated' });
}

/**
 * List all whitelist entries
 */
async function listWhitelist(base44, user, body) {
    const { include_inactive } = body;

    let entries;
    if (include_inactive && user.role === 'admin') {
        entries = await base44.asServiceRole.entities.UrlWhitelist.list();
    } else {
        entries = await base44.asServiceRole.entities.UrlWhitelist.filter({ is_active: true });
    }

    return Response.json({ success: true, entries });
}

/**
 * Ingest match data from an external URL
 * URL must be whitelisted before ingestion is allowed
 */
async function ingestMatchData(base44, user, body) {
    const { source_url, match_data } = body;

    // Validate required fields
    if (!source_url || typeof source_url !== 'string') {
        return Response.json({ error: 'source_url is required' }, { status: 400 });
    }
    if (!match_data || typeof match_data !== 'object') {
        return Response.json({ error: 'match_data is required and must be an object' }, { status: 400 });
    }

    // Check URL against whitelist
    const urlCheck = await checkUrlAgainstWhitelist(base44, source_url);
    
    if (!urlCheck.allowed) {
        await createAuditLog(base44, {
            action: 'data_ingestion_url_blocked',
            actor_id: user.id,
            actor_type: user.role === 'admin' ? 'admin' : 'user',
            severity: 'critical',
            details: { 
                source_url, 
                match_data_keys: Object.keys(match_data),
                reason: 'URL not in approved whitelist'
            },
            success: false,
            error_message: 'Blocked ingestion from non-whitelisted URL'
        });

        return Response.json({ 
            error: 'Source URL not in approved whitelist. This incident has been logged.',
            blocked_url: source_url
        }, { status: 403 });
    }

    // Validate match_data structure
    const { match_id, participant_ids, winner_id, result_data } = match_data;
    
    const errors = [];
    if (!match_id || typeof match_id !== 'string') {
        errors.push('match_data.match_id is required');
    }
    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
        errors.push('match_data.participant_ids must be an array with at least 2 participants');
    }

    if (errors.length > 0) {
        await createAuditLog(base44, {
            action: 'data_ingestion_validation_failed',
            actor_id: user.id,
            actor_type: user.role === 'admin' ? 'admin' : 'user',
            severity: 'warning',
            details: { source_url, errors },
            success: false
        });
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Check for duplicate match
    const existing = await base44.asServiceRole.entities.MatchResult.filter({ match_id });
    if (existing.length > 0) {
        return Response.json({ 
            error: 'Match with this ID already exists',
            existing_match: existing[0]
        }, { status: 409 });
    }

    // Create match in candidate status
    const match = await base44.asServiceRole.entities.MatchResult.create({
        match_id,
        participant_ids,
        status: 'candidate',
        winner_id: winner_id || null,
        result_data: result_data || {},
        source_url,
        is_external_source: true,
        points_awarded: false,
        ledger_entry_ids: []
    });

    await createAuditLog(base44, {
        action: 'data_ingestion_success',
        entity_type: 'MatchResult',
        entity_id: match.id,
        actor_id: user.id,
        actor_type: user.role === 'admin' ? 'admin' : 'user',
        severity: 'info',
        details: { 
            source_url, 
            match_id,
            whitelist_entry_used: urlCheck.matchedEntry?.name
        },
        success: true
    });

    return Response.json({ 
        success: true, 
        match,
        ingestion_source: urlCheck.matchedEntry?.name
    });
}

/**
 * Check URL against whitelist
 */
async function checkUrlAgainstWhitelist(base44, url) {
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
            return { allowed: true, matchedEntry: entry };
        }
    }

    return { allowed: false, matchedEntry: null };
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