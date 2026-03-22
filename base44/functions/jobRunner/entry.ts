import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Job Runner
 * Processes ScoringJob records for various modes
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin-only job
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { job_id } = await req.json();

        if (!job_id) {
            return Response.json({ error: 'job_id required' }, { status: 400 });
        }

        // Fetch the job
        const job = await base44.asServiceRole.entities.ScoringJob.get(job_id);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Check if already done
        if (job.status === 'DONE') {
            return Response.json({ status: 'ALREADY_DONE', job_id });
        }

        // Check if stuck in RUNNING (older than 30 min)
        if (job.status === 'RUNNING') {
            const updatedAt = new Date(job.updated_date);
            const now = new Date();
            const ageMinutes = (now - updatedAt) / (1000 * 60);
            if (ageMinutes < 30) {
                return Response.json({ status: 'ALREADY_RUNNING', job_id });
            }
            // Allow retry
        }

        // Mark as RUNNING
        await base44.asServiceRole.entities.ScoringJob.update(job_id, {
            status: 'RUNNING'
        });

        try {
            let result = null;

            if (job.mode === 'FANTASY_STATS') {
                result = await handleFantasyStats(base44, job);
            } else if (job.mode === 'FANTASY') {
                result = await handleFantasyScoring(base44, job);
            } else if (job.mode === 'PRODE') {
                result = await handleProdeScoring(base44, job);
            } else {
                throw new Error(`Unsupported job mode: ${job.mode}`);
            }

            // Mark as DONE
            await base44.asServiceRole.entities.ScoringJob.update(job_id, {
                status: 'DONE'
            });

            return Response.json({
                status: 'SUCCESS',
                job_id,
                result
            });

        } catch (error) {
            // Mark as FAILED
            await base44.asServiceRole.entities.ScoringJob.update(job_id, {
                status: 'FAILED',
                error_message: error.message
            });

            return Response.json({
                status: 'FAILED',
                job_id,
                error: error.message
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Job runner error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function handleFantasyStats(base44, job) {
    // Extract match_id from source_id (format: "MATCH:123")
    const match_id = job.source_id.split(':')[1];
    if (!match_id) {
        throw new Error('Invalid source_id format for FANTASY_STATS job');
    }

    // Call fantasyStatsService
    const result = await base44.asServiceRole.functions.invoke('fantasyStatsService', {
        action: 'build_fantasy_stats',
        match_id,
        options: {}
    });

    if (result.data.status === 'NO_SOURCE_DATA') {
        throw new Error('No source data available for fantasy stats');
    }

    return result.data;
}

async function handleFantasyScoring(base44, job) {
    // Extract match_id from source_id
    const match_id = job.source_id.split(':')[1];
    if (!match_id) {
        throw new Error('Invalid source_id format for FANTASY job');
    }

    // Check if FantasyMatchPlayerStats exist
    const stats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id });
    if (stats.length === 0) {
        // Re-enqueue FANTASY_STATS job and exit
        const statsDedupeKey = `FANTASY_STATS:MATCH:${match_id}:v1`;
        const existingStatsJobs = await base44.asServiceRole.entities.ScoringJob.filter({
            dedupe_key: statsDedupeKey
        });

        if (existingStatsJobs.length === 0) {
            await base44.asServiceRole.entities.ScoringJob.create({
                mode: 'FANTASY_STATS',
                source_type: 'MATCH',
                source_id: `MATCH:${match_id}`,
                version: 1,
                dedupe_key: statsDedupeKey,
                status: 'PENDING'
            });
        }

        throw new Error('FantasyMatchPlayerStats not available, re-enqueued FANTASY_STATS job');
    }

    // Call fantasy scoring service
    const result = await base44.asServiceRole.functions.invoke('fantasyScoringService', {
        action: 'score_fantasy_match',
        match_id
    });

    return result.data;
}

async function handleProdeScoring(base44, job) {
    // TODO: Implement prode scoring logic
    return { status: 'PRODE_SCORING_NOT_IMPLEMENTED' };
}