import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin Validation Service - Server-side validation for admin operations
 * 
 * Endpoints:
 * - POST { action: "validate_audit_log" } - Validate AdminAuditLog entry
 * - POST { action: "validate_data_source" } - Validate DataSource
 * - POST { action: "validate_match_source_link" } - Validate MatchSourceLink URL
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'validate_audit_log':
                return await validateAuditLog(base44, user, body);
            case 'validate_data_source':
                return await validateDataSource(base44, user, body);
            case 'validate_match_source_link':
                return await validateMatchSourceLink(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Admin validation error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Validate AdminAuditLog entry
 * Rule: if actor_type=ADMIN -> admin_user_id required
 *       if actor_type=SYSTEM -> admin_user_id must be null
 */
async function validateAuditLog(base44, user, body) {
    const { audit_data } = body;
    const errors = [];

    if (!audit_data) {
        return Response.json({ valid: false, errors: ['audit_data is required'] });
    }

    const { admin_user_id, actor_type, action, entity_type, entity_id, reason } = audit_data;

    // Validate actor_type
    if (!actor_type || !['ADMIN', 'SYSTEM'].includes(actor_type)) {
        errors.push('actor_type must be ADMIN or SYSTEM');
    }

    // Validate admin_user_id based on actor_type
    if (actor_type === 'ADMIN') {
        if (!admin_user_id) {
            errors.push('admin_user_id is required when actor_type=ADMIN');
        }
    } else if (actor_type === 'SYSTEM') {
        if (admin_user_id !== null && admin_user_id !== undefined) {
            errors.push('admin_user_id must be null when actor_type=SYSTEM');
        }
    }

    // Validate required fields
    if (!action) errors.push('action is required');
    if (!entity_type) errors.push('entity_type is required');
    if (!entity_id) errors.push('entity_id is required');
    if (!reason) errors.push('reason is required');

    return Response.json({ valid: errors.length === 0, errors });
}

/**
 * Validate DataSource
 * Rules:
 * - base_url must start with "https://"
 * - allowed_paths_regex not empty
 */
async function validateDataSource(base44, user, body) {
    const { data_source } = body;
    const errors = [];

    if (!data_source) {
        return Response.json({ valid: false, errors: ['data_source is required'] });
    }

    const { name, base_url, allowed_paths_regex } = data_source;

    if (!name) errors.push('name is required');
    
    if (!base_url) {
        errors.push('base_url is required');
    } else if (!base_url.startsWith('https://')) {
        errors.push('base_url must start with "https://"');
    }

    if (!allowed_paths_regex || allowed_paths_regex.trim() === '') {
        errors.push('allowed_paths_regex is required and cannot be empty');
    } else {
        // Validate regex syntax
        try {
            new RegExp(allowed_paths_regex);
        } catch (e) {
            errors.push('allowed_paths_regex is not a valid regex: ' + e.message);
        }
    }

    return Response.json({ valid: errors.length === 0, errors });
}

/**
 * Validate MatchSourceLink URL against whitelist
 * Allows null/empty URLs for placeholder links
 */
async function validateMatchSourceLink(base44, user, body) {
    const { url, source_id } = body;
    const errors = [];

    if (!source_id) {
        return Response.json({ valid: false, errors: ['source_id is required'] });
    }

    // Get data source
    const sources = await base44.asServiceRole.entities.DataSource.filter({ id: source_id });
    if (sources.length === 0) {
        errors.push('source_id references non-existent DataSource');
        return Response.json({ valid: false, errors });
    }

    const source = sources[0];

    // Allow null/empty URLs for placeholder links
    if (!url || url.trim() === '') {
        return Response.json({ 
            valid: true, 
            errors: [],
            source_name: source.name,
            is_placeholder: true
        });
    }

    // Validate non-empty URLs against whitelist
    if (!url.startsWith(source.base_url)) {
        errors.push(`URL must start with DataSource base_url: ${source.base_url}`);
    } else {
        const path = url.substring(source.base_url.length);
        try {
            const regex = new RegExp(source.allowed_paths_regex);
            if (!regex.test(path)) {
                errors.push(`URL path does not match allowed_paths_regex: ${source.allowed_paths_regex}`);
            }
        } catch (e) {
            errors.push('Invalid regex in DataSource: ' + e.message);
        }
    }

    return Response.json({ 
        valid: errors.length === 0, 
        errors,
        source_name: source.name,
        is_placeholder: false
    });
}