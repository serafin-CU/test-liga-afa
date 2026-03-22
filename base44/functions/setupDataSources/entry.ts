import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const results = {
            promiedos: null,
            wikipedia: null,
            fifa: null
        };

        // Get all data sources
        const allSources = await base44.asServiceRole.entities.DataSource.list();

        // A) Setup PROMIEDOS as PRIMARY source
        const promiedos = allSources.find(s => s.name === 'PROMIEDOS');
        if (promiedos) {
            await base44.asServiceRole.entities.DataSource.update(promiedos.id, {
                base_url: 'https://www.promiedos.com.ar',
                allowed_paths_regex: '^/(league|game|team)/.*$',
                enabled: true,
                rate_limit_seconds: 30
            });
            results.promiedos = 'updated';
        } else {
            await base44.asServiceRole.entities.DataSource.create({
                name: 'PROMIEDOS',
                base_url: 'https://www.promiedos.com.ar',
                allowed_paths_regex: '^/(league|game|team)/.*$',
                enabled: true,
                rate_limit_seconds: 30,
                notes: 'Primary data source for match results'
            });
            results.promiedos = 'created';
        }

        // B) Update WIKIPEDIA as FALLBACK source
        const wikipedia = allSources.find(s => s.name === 'WIKIPEDIA');
        if (wikipedia) {
            await base44.asServiceRole.entities.DataSource.update(wikipedia.id, {
                allowed_paths_regex: '^/wiki/.*$',
                enabled: true
            });
            results.wikipedia = 'updated';
        } else {
            results.wikipedia = 'not_found';
        }

        // C) Disable FIFA (keep for future use)
        const fifa = allSources.find(s => s.name === 'FIFA');
        if (fifa) {
            await base44.asServiceRole.entities.DataSource.update(fifa.id, {
                enabled: false
            });
            results.fifa = 'disabled';
        } else {
            results.fifa = 'not_found';
        }

        return Response.json({
            success: true,
            message: 'Data sources configured successfully',
            results
        });

    } catch (error) {
        console.error('Setup error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});