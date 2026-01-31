import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Job Runner Service - Executes automated jobs with idempotency guarantees
 * 
 * All jobs are tracked in JobExecution entity to prevent double execution.
 * 
 * Endpoints:
 * - POST { action: "recalculate_all_scores" } - Recalculate all user score caches
 * - POST { action: "process_pending_matches" } - Auto-confirm matches older than threshold
 * - POST { action: "cleanup_stale_candidates" } - Clean up old candidate matches
 * - POST { action: "get_job_status" } - Get status of a job execution
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // All job operations require admin
        if (user.role !== 'admin') {
            await createAuditLog(base44, {
                action: 'job_runner_unauthorized',
                actor_id: user.id,
                actor_type: 'user',
                severity: 'warning',
                success: false,
                error_message: 'Non-admin attempted to run job'
            });
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'recalculate_all_scores':
                return await recalculateAllScores(base44, user, body);
            case 'process_pending_matches':
                return await processPendingMatches(base44, user, body);
            case 'cleanup_stale_candidates':
                return await cleanupStaleCandidates(base44, user, body);
            case 'get_job_status':
                return await getJobStatus(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Job runner error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Recalculate all user score caches
 * Idempotent - will skip users already processed in this run
 */
async function recalculateAllScores(base44, user, body) {
    const { idempotency_key } = body;

    if (!idempotency_key) {
        return Response.json({ error: 'idempotency_key is required for job execution' }, { status: 400 });
    }

    // Check if job already running or completed
    const existingJob = await base44.asServiceRole.entities.JobExecution.filter({
        idempotency_key
    });

    if (existingJob.length > 0) {
        const job = existingJob[0];
        if (job.status === 'completed') {
            return Response.json({ 
                success: true,
                idempotent: true,
                message: 'Job already completed',
                job
            });
        }
        if (job.status === 'running') {
            return Response.json({ 
                error: 'Job already running',
                job
            }, { status: 409 });
        }
    }

    // Create or update job record
    let jobId;
    if (existingJob.length > 0) {
        await base44.asServiceRole.entities.JobExecution.update(existingJob[0].id, {
            status: 'running',
            started_at: new Date().toISOString(),
            retry_count: (existingJob[0].retry_count || 0) + 1
        });
        jobId = existingJob[0].id;
    } else {
        const newJob = await base44.asServiceRole.entities.JobExecution.create({
            job_name: 'recalculate_all_scores',
            idempotency_key,
            status: 'running',
            started_at: new Date().toISOString(),
            retry_count: 0
        });
        jobId = newJob.id;
    }

    try {
        // Get all unique user IDs from score ledger
        const ledgerEntries = await base44.asServiceRole.entities.ScoreLedger.list();
        const userIds = [...new Set(ledgerEntries.map(e => e.user_id))];

        let processed = 0;
        let skipped = 0;
        let failed = 0;

        for (const userId of userIds) {
            try {
                // Get all entries for user
                const entries = await base44.asServiceRole.entities.ScoreLedger.filter({
                    user_id: userId
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

                // Update or create cache
                const existingCache = await base44.asServiceRole.entities.UserScoreCache.filter({
                    user_id: userId
                });

                const cacheData = {
                    user_id: userId,
                    total_points: totalPoints,
                    total_entries: totalEntries,
                    voided_entries: voidedEntries,
                    last_calculated_at: new Date().toISOString(),
                    last_ledger_entry_id: lastEntryId,
                    needs_recalculation: false
                };

                if (existingCache.length > 0) {
                    await base44.asServiceRole.entities.UserScoreCache.update(existingCache[0].id, cacheData);
                } else {
                    await base44.asServiceRole.entities.UserScoreCache.create(cacheData);
                }

                processed++;
            } catch (userError) {
                console.error(`Failed to process user ${userId}:`, userError);
                failed++;
            }
        }

        // Update job as completed
        await base44.asServiceRole.entities.JobExecution.update(jobId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: processed,
            records_skipped: skipped,
            records_failed: failed,
            output_data: { total_users: userIds.length }
        });

        await createAuditLog(base44, {
            action: 'job_completed',
            entity_type: 'JobExecution',
            entity_id: jobId,
            actor_id: user.id,
            actor_type: 'admin',
            severity: 'info',
            details: { 
                job_name: 'recalculate_all_scores',
                processed,
                skipped,
                failed
            },
            success: true
        });

        return Response.json({ 
            success: true,
            processed,
            skipped,
            failed,
            total_users: userIds.length
        });

    } catch (error) {
        // Update job as failed
        await base44.asServiceRole.entities.JobExecution.update(jobId, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message
        });

        throw error;
    }
}

/**
 * Process pending matches - auto-confirm candidates older than threshold
 * This is a conservative operation - only moves to confirmed, not locked
 */
async function processPendingMatches(base44, user, body) {
    const { idempotency_key, age_threshold_hours } = body;

    if (!idempotency_key) {
        return Response.json({ error: 'idempotency_key is required' }, { status: 400 });
    }

    const threshold = age_threshold_hours || 24; // Default 24 hours

    // Check for existing job
    const existingJob = await base44.asServiceRole.entities.JobExecution.filter({
        idempotency_key
    });

    if (existingJob.length > 0 && existingJob[0].status === 'completed') {
        return Response.json({ 
            success: true,
            idempotent: true,
            message: 'Job already completed',
            job: existingJob[0]
        });
    }

    // Create job record
    let jobId;
    if (existingJob.length > 0) {
        await base44.asServiceRole.entities.JobExecution.update(existingJob[0].id, {
            status: 'running',
            started_at: new Date().toISOString()
        });
        jobId = existingJob[0].id;
    } else {
        const newJob = await base44.asServiceRole.entities.JobExecution.create({
            job_name: 'process_pending_matches',
            idempotency_key,
            status: 'running',
            started_at: new Date().toISOString(),
            input_data: { age_threshold_hours: threshold }
        });
        jobId = newJob.id;
    }

    try {
        const cutoffDate = new Date(Date.now() - threshold * 60 * 60 * 1000).toISOString();
        
        // Get candidate matches
        const candidates = await base44.asServiceRole.entities.MatchResult.filter({
            status: 'candidate'
        });

        let processed = 0;
        let skipped = 0;

        for (const match of candidates) {
            // Only process if older than threshold
            if (match.created_date < cutoffDate && match.winner_id) {
                // Create idempotency key for this specific confirmation
                const confirmKey = `auto_confirm_${match.id}_${idempotency_key}`;
                
                // Check if already processed in this run
                const existingConfirm = await base44.asServiceRole.entities.AuditLog.filter({
                    idempotency_key: confirmKey
                });

                if (existingConfirm.length > 0) {
                    skipped++;
                    continue;
                }

                await base44.asServiceRole.entities.MatchResult.update(match.id, {
                    status: 'confirmed',
                    confirmed_at: new Date().toISOString(),
                    confirmed_by: 'system_auto_confirm'
                });

                await createAuditLog(base44, {
                    action: 'match_auto_confirmed',
                    entity_type: 'MatchResult',
                    entity_id: match.id,
                    actor_id: 'system',
                    actor_type: 'job',
                    severity: 'info',
                    details: { match_id: match.match_id, age_hours: threshold },
                    idempotency_key: confirmKey,
                    success: true
                });

                processed++;
            } else {
                skipped++;
            }
        }

        await base44.asServiceRole.entities.JobExecution.update(jobId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: processed,
            records_skipped: skipped
        });

        return Response.json({ 
            success: true,
            processed,
            skipped,
            total_candidates: candidates.length
        });

    } catch (error) {
        await base44.asServiceRole.entities.JobExecution.update(jobId, {
            status: 'failed',
            error_message: error.message
        });
        throw error;
    }
}

/**
 * Cleanup stale candidate matches (void old unconfirmed matches)
 */
async function cleanupStaleCandidates(base44, user, body) {
    const { idempotency_key, age_threshold_days } = body;

    if (!idempotency_key) {
        return Response.json({ error: 'idempotency_key is required' }, { status: 400 });
    }

    const thresholdDays = age_threshold_days || 7; // Default 7 days

    // Check for existing job
    const existingJob = await base44.asServiceRole.entities.JobExecution.filter({
        idempotency_key
    });

    if (existingJob.length > 0 && existingJob[0].status === 'completed') {
        return Response.json({ 
            success: true,
            idempotent: true,
            message: 'Job already completed'
        });
    }

    const newJob = await base44.asServiceRole.entities.JobExecution.create({
        job_name: 'cleanup_stale_candidates',
        idempotency_key,
        status: 'running',
        started_at: new Date().toISOString(),
        input_data: { age_threshold_days: thresholdDays }
    });

    try {
        const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();
        
        const candidates = await base44.asServiceRole.entities.MatchResult.filter({
            status: 'candidate'
        });

        let voided = 0;
        let skipped = 0;

        for (const match of candidates) {
            if (match.created_date < cutoffDate) {
                await base44.asServiceRole.entities.MatchResult.update(match.id, {
                    status: 'voided',
                    void_reason: `Auto-voided: Candidate not confirmed within ${thresholdDays} days`
                });

                await createAuditLog(base44, {
                    action: 'match_auto_voided',
                    entity_type: 'MatchResult',
                    entity_id: match.id,
                    actor_id: 'system',
                    actor_type: 'job',
                    severity: 'warning',
                    details: { match_id: match.match_id, age_days: thresholdDays },
                    success: true
                });

                voided++;
            } else {
                skipped++;
            }
        }

        await base44.asServiceRole.entities.JobExecution.update(newJob.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: voided,
            records_skipped: skipped
        });

        return Response.json({ 
            success: true,
            voided,
            skipped,
            total_candidates: candidates.length
        });

    } catch (error) {
        await base44.asServiceRole.entities.JobExecution.update(newJob.id, {
            status: 'failed',
            error_message: error.message
        });
        throw error;
    }
}

/**
 * Get status of a job execution
 */
async function getJobStatus(base44, user, body) {
    const { idempotency_key, job_id } = body;

    let jobs;
    if (job_id) {
        jobs = await base44.asServiceRole.entities.JobExecution.filter({ id: job_id });
    } else if (idempotency_key) {
        jobs = await base44.asServiceRole.entities.JobExecution.filter({ idempotency_key });
    } else {
        return Response.json({ error: 'job_id or idempotency_key is required' }, { status: 400 });
    }

    if (jobs.length === 0) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json({ success: true, job: jobs[0] });
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