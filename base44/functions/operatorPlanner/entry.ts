import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * OperatorPlanner - Job A
 * 
 * Schedule: Every 60 minutes
 * 
 * Responsibilities:
 * 1. Ensure app_config row exists (id=1)
 * 2. Build/refresh MatchSourceLink records for matches in time window
 * 3. Create IngestionRun record
 * 4. Update last_operator_run_at
 * 
 * Conservative and idempotent.
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Admin-only job
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const startTime = new Date();
        const now = startTime.toISOString();

        // Step 1: Ensure app_config exists
        const configs = await base44.asServiceRole.entities.AppConfig.list();
        let appConfig;

        if (configs.length === 0) {
            // Create with safe defaults
            const tournamentStart = new Date();
            tournamentStart.setDate(tournamentStart.getDate() + 30); // 30 days from now
            
            const squadLock = new Date(tournamentStart);
            squadLock.setDate(squadLock.getDate() - 1); // 1 day before tournament

            appConfig = await base44.asServiceRole.entities.AppConfig.create({
                tournament_start_at: tournamentStart.toISOString(),
                tournament_phase: 'PRE_TOURNAMENT',
                transfer_window_state: 'OPEN',
                squad_lock_at: squadLock.toISOString(),
                last_operator_run_at: now
            });
        } else {
            appConfig = configs[0];
        }

        // Step 2: Build/refresh MatchSourceLink records
        // Time window: now-6h to now+24h
        const windowStart = new Date(startTime);
        windowStart.setHours(windowStart.getHours() - 6);
        
        const windowEnd = new Date(startTime);
        windowEnd.setHours(windowEnd.getHours() + 24);

        // Get all matches in window
        const allMatches = await base44.asServiceRole.entities.Match.list();
        const matchesInWindow = allMatches.filter(m => {
            const kickoff = new Date(m.kickoff_at);
            return kickoff >= windowStart && kickoff <= windowEnd;
        });

        // Get all enabled data sources
        const dataSources = await base44.asServiceRole.entities.DataSource.filter({ enabled: true });
        const fifaSource = dataSources.find(ds => ds.name.toUpperCase().includes('FIFA'));
        const wikiSource = dataSources.find(ds => ds.name.toUpperCase().includes('WIKIPEDIA'));

        let linksCreated = 0;
        let linksMissing = 0;
        let linksOk = 0;
        const missingLinks = [];

        for (const match of matchesInWindow) {
            // Get existing links for this match
            const existingLinks = await base44.asServiceRole.entities.MatchSourceLink.filter({
                match_id: match.id
            });

            // Check FIFA source
            if (fifaSource) {
                const fifaLink = existingLinks.find(el => el.source_id === fifaSource.id);
                if (!fifaLink) {
                    // Create placeholder
                    await base44.asServiceRole.entities.MatchSourceLink.create({
                        match_id: match.id,
                        source_id: fifaSource.id,
                        url: null,
                        is_primary: true
                    });
                    linksCreated++;
                    linksMissing++;
                    missingLinks.push({
                        match_id: match.id,
                        source: 'FIFA',
                        phase: match.phase,
                        kickoff_at: match.kickoff_at
                    });
                } else if (!fifaLink.url) {
                    linksMissing++;
                    missingLinks.push({
                        match_id: match.id,
                        source: 'FIFA',
                        phase: match.phase,
                        kickoff_at: match.kickoff_at
                    });
                } else {
                    linksOk++;
                }
            }

            // Check Wikipedia source
            if (wikiSource) {
                const wikiLink = existingLinks.find(el => el.source_id === wikiSource.id);
                if (!wikiLink) {
                    // Create placeholder
                    await base44.asServiceRole.entities.MatchSourceLink.create({
                        match_id: match.id,
                        source_id: wikiSource.id,
                        url: null,
                        is_primary: false
                    });
                    linksCreated++;
                    linksMissing++;
                    missingLinks.push({
                        match_id: match.id,
                        source: 'WIKIPEDIA',
                        phase: match.phase,
                        kickoff_at: match.kickoff_at
                    });
                } else if (!wikiLink.url) {
                    linksMissing++;
                    missingLinks.push({
                        match_id: match.id,
                        source: 'WIKIPEDIA',
                        phase: match.phase,
                        kickoff_at: match.kickoff_at
                    });
                } else {
                    linksOk++;
                }
            }
        }

        // Step 3: Create IngestionRun record
        const finishedTime = new Date();
        const status = linksMissing > 0 ? 'PARTIAL' : 'SUCCESS';
        
        const summaryJson = JSON.stringify({
            job: 'OperatorPlanner',
            matches_scanned: matchesInWindow.length,
            window_start: windowStart.toISOString(),
            window_end: windowEnd.toISOString(),
            links_created: linksCreated,
            links_missing: linksMissing,
            links_ok: linksOk,
            missing_links_details: missingLinks,
            fifa_source_exists: !!fifaSource,
            wiki_source_exists: !!wikiSource
        });

        const ingestionRun = await base44.asServiceRole.entities.IngestionRun.create({
            started_at: startTime.toISOString(),
            finished_at: finishedTime.toISOString(),
            status,
            summary_json: summaryJson
        });

        // Step 4: Update last_operator_run_at
        await base44.asServiceRole.entities.AppConfig.update(appConfig.id, {
            last_operator_run_at: now
        });

        return Response.json({
            success: true,
            job: 'OperatorPlanner',
            matches_scanned: matchesInWindow.length,
            links_created: linksCreated,
            links_missing: linksMissing,
            links_ok: linksOk,
            status,
            ingestion_run_id: ingestionRun.id
        });

    } catch (error) {
        console.error('OperatorPlanner error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});