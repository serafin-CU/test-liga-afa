import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const log = [];

    try {
        // Allow both admin users and system/scheduled calls
        let user = null;
        try { user = await base44.auth.me(); } catch {}
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        log.push('Starting 2-hour sync...');

        // STEP 1: Find matches from last 7 days with an api_fixture_id
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const allMatches = await base44.asServiceRole.entities.Match.list('-kickoff_at', 200);
        const recentMatches = allMatches.filter(m =>
            m.api_fixture_id &&
            m.kickoff_at >= sevenDaysAgo &&
            m.status !== 'FINAL'
        );

        log.push(`Found ${recentMatches.length} non-final recent matches to check`);

        let updatedCount = 0;
        let scoredCount = 0;
        const errors = [];

        // STEP 2: Check each match via apiFutbol
        for (const match of recentMatches) {
            const oldStatus = match.status;

            try {
                const result = await base44.asServiceRole.functions.invoke('apiFutbol', {
                    action: 'ingest_fixture',
                    fixture_id: match.api_fixture_id
                });

                if (result?.ok || result?.status === 'ok') {
                    updatedCount++;

                    // Re-fetch updated match
                    const updated = await base44.asServiceRole.entities.Match.filter({ id: match.id });
                    const updatedMatch = updated[0] || match;

                    // STEP 3: If match just finished, trigger scoring
                    if (updatedMatch.status === 'FINAL' && oldStatus !== 'FINAL') {
                        log.push(`✓ Match finished: ${match.id} (fixture ${match.api_fixture_id})`);

                        // Score Prode predictions
                        try {
                            await base44.asServiceRole.functions.invoke('finalizer', { match_id: match.id });
                            log.push(`  ✓ Prode scored for match ${match.id}`);
                        } catch (err) {
                            log.push(`  ✗ Prode error: ${err.message}`);
                            errors.push(`Prode:${match.id}: ${err.message}`);
                        }

                        // Score Fantasy points
                        try {
                            await base44.asServiceRole.functions.invoke('fantasyScoringService', { match_id: match.id });
                            log.push(`  ✓ Fantasy scored for match ${match.id}`);
                        } catch (err) {
                            log.push(`  ✗ Fantasy error: ${err.message}`);
                            errors.push(`Fantasy:${match.id}: ${err.message}`);
                        }

                        scoredCount++;
                    }
                }
            } catch (matchErr) {
                const msg = `✗ Failed fixture ${match.api_fixture_id}: ${matchErr.message}`;
                log.push(msg);
                errors.push(msg);
            }

            // Rate limit: 1 second between API calls
            await new Promise(r => setTimeout(r, 1000));
        }

        log.push(`Sync complete: ${updatedCount} updated, ${scoredCount} scored, ${errors.length} errors`);

        // Save audit log
        await base44.asServiceRole.entities.AdminAuditLog.create({
            actor_type: 'SYSTEM',
            action: 'AUTO_MATCH_SYNC',
            entity_type: 'Match',
            entity_id: 'bulk',
            reason: 'Automated 2-hour match sync',
            details_json: JSON.stringify({
                matches_checked: recentMatches.length,
                updated: updatedCount,
                scored: scoredCount,
                errors,
                log
            })
        });

        return Response.json({ success: true, log, updatedCount, scoredCount, errors });

    } catch (error) {
        log.push(`✗ Error: ${error.message}`);
        console.error('[syncMatches] Fatal error:', error.message);
        return Response.json({ success: false, error: error.message, log }, { status: 500 });
    }
});