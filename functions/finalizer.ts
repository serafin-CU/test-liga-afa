import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Finalizer - Job C
 * 
 * Schedule: Every 15 minutes
 * 
 * Responsibilities:
 * - Finalize matches when confidence >= 70
 * - Create MatchResultFinal records
 * - Update Match.status to FINAL
 * - Lock MatchValidation
 * - Enqueue ScoringJob records (idempotent)
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

        let matchesChecked = 0;
        let matchesFinalized = 0;
        let matchesSkipped = 0;
        let scoringJobsEnqueued = 0;
        const finalizedMatches = [];
        const skippedReasons = [];

        // Get all match validations
        const allValidations = await base44.asServiceRole.entities.MatchValidation.list();

        for (const validation of allValidations) {
            matchesChecked++;

            // Skip if already locked
            if (validation.locked_final) {
                matchesSkipped++;
                continue;
            }

            // Check finalization criteria
            const canFinalize = 
                validation.status_candidate === 'FINAL' &&
                validation.confidence_score >= 70 &&
                validation.score_candidate_home !== null &&
                validation.score_candidate_away !== null;

            if (!canFinalize) {
                matchesSkipped++;
                skippedReasons.push({
                    match_id: validation.match_id,
                    reason: validation.status_candidate !== 'FINAL' ? 'Status not FINAL' :
                           validation.confidence_score < 70 ? `Confidence too low (${validation.confidence_score})` :
                           'Scores not available'
                });
                continue;
            }

            // Check if MatchResultFinal already exists (idempotency)
            const existingResults = await base44.asServiceRole.entities.MatchResultFinal.filter({
                match_id: validation.match_id
            });

            if (existingResults.length > 0) {
                // Already finalized, just ensure validation is locked
                if (!validation.locked_final) {
                    await base44.asServiceRole.entities.MatchValidation.update(validation.id, {
                        locked_final: true,
                        finalized_at: now
                    });
                }
                matchesSkipped++;
                continue;
            }

            // Step 1: Create MatchResultFinal
            const matchResult = await base44.asServiceRole.entities.MatchResultFinal.create({
                match_id: validation.match_id,
                home_goals: validation.score_candidate_home,
                away_goals: validation.score_candidate_away,
                mvp_player_id: null, // Could be extracted from parsed data in future
                finalized_at: now
            });

            // Step 2: Update Match.status to FINAL
            await base44.asServiceRole.entities.Match.update(validation.match_id, {
                status: 'FINAL'
            });

            // Step 3: Lock MatchValidation
            await base44.asServiceRole.entities.MatchValidation.update(validation.id, {
                locked_final: true,
                finalized_at: now
            });

            matchesFinalized++;
            finalizedMatches.push({
                match_id: validation.match_id,
                confidence: validation.confidence_score,
                score: `${validation.score_candidate_home}-${validation.score_candidate_away}`
            });

            // Step 4: Enqueue ScoringJob records (idempotent)
            
            // PRODE scoring job
            const prodeDedupeKey = `PRODE:MATCH:${validation.match_id}:v1`;
            const existingProdeJobs = await base44.asServiceRole.entities.ScoringJob.filter({
                dedupe_key: prodeDedupeKey
            });

            if (existingProdeJobs.length === 0) {
                await base44.asServiceRole.entities.ScoringJob.create({
                    mode: 'PRODE',
                    source_type: 'MATCH',
                    source_id: `MATCH:${validation.match_id}`,
                    version: 1,
                    dedupe_key: prodeDedupeKey,
                    status: 'PENDING'
                });
                scoringJobsEnqueued++;
            }

            // FANTASY scoring job
            const fantasyDedupeKey = `FANTASY:MATCH:${validation.match_id}:v1`;
            const existingFantasyJobs = await base44.asServiceRole.entities.ScoringJob.filter({
                dedupe_key: fantasyDedupeKey
            });

            if (existingFantasyJobs.length === 0) {
                await base44.asServiceRole.entities.ScoringJob.create({
                    mode: 'FANTASY',
                    source_type: 'MATCH',
                    source_id: `MATCH:${validation.match_id}`,
                    version: 1,
                    dedupe_key: fantasyDedupeKey,
                    status: 'PENDING'
                });
                scoringJobsEnqueued++;
            }

            // Log admin action
            await base44.asServiceRole.entities.AdminAuditLog.create({
                admin_user_id: 'system',
                action: 'AUTO_FINALIZE_MATCH',
                entity_type: 'MatchResultFinal',
                entity_id: matchResult.id,
                reason: `Automated finalization by Finalizer job (confidence: ${validation.confidence_score})`,
                details_json: JSON.stringify({
                    match_id: validation.match_id,
                    confidence_score: validation.confidence_score,
                    home_goals: validation.score_candidate_home,
                    away_goals: validation.score_candidate_away,
                    finalized_at: now
                })
            });
        }

        return Response.json({
            success: true,
            job: 'Finalizer',
            matches_checked: matchesChecked,
            matches_finalized: matchesFinalized,
            matches_skipped: matchesSkipped,
            scoring_jobs_enqueued: scoringJobsEnqueued,
            finalized_matches: finalizedMatches,
            skipped_reasons: skippedReasons.slice(0, 10) // First 10 for brevity
        });

    } catch (error) {
        console.error('Finalizer error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});