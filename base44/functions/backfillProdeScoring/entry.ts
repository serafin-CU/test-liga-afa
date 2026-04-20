import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * backfillProdeScoring
 * One-time backfill: scores prode predictions for all FINAL matches
 * that have a MatchResultFinal but no PointsLedger entry yet.
 * Admin only.
 */

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const log = [];
    let totalScored = 0;
    let totalSkipped = 0;
    let matchesProcessed = 0;

    try {
        // Get all MatchResultFinal records
        const allResults = await base44.asServiceRole.entities.MatchResultFinal.list('-finalized_at', 500);
        log.push(`Found ${allResults.length} finalized match results`);

        for (const result of allResults) {
            const match_id = result.match_id;
            const dedupe_key = `PRODE:MATCH:${match_id}:v1`;

            // Check if already scored (ScoringJob DONE)
            const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({ dedupe_key });
            if (existingJobs.length > 0 && existingJobs[0].status === 'DONE') {
                totalSkipped++;
                continue;
            }

            // Get predictions for this match
            const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id });
            if (predictions.length === 0) {
                totalSkipped++;
                continue;
            }

            // Upsert job as RUNNING
            let job;
            if (existingJobs.length > 0) {
                await base44.asServiceRole.entities.ScoringJob.update(existingJobs[0].id, { status: 'RUNNING' });
                job = { id: existingJobs[0].id };
            } else {
                job = await base44.asServiceRole.entities.ScoringJob.create({
                    mode: 'PRODE', source_type: 'MATCH', source_id: `MATCH:${match_id}`,
                    version: 1, dedupe_key, status: 'RUNNING'
                });
            }

            let scored_count = 0;
            const home_goals = result.home_goals;
            const away_goals = result.away_goals;

            for (const pred of predictions) {
                let points = 0;
                const breakdown = {};

                if (pred.pred_home_goals === home_goals && pred.pred_away_goals === away_goals) {
                    points += 5; breakdown.exact_score = 5;
                } else {
                    const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'H' : pred.pred_home_goals < pred.pred_away_goals ? 'A' : 'D';
                    const actualWinner = home_goals > away_goals ? 'H' : home_goals < away_goals ? 'A' : 'D';
                    if (predWinner === actualWinner) { points += 3; breakdown.correct_winner = 3; }
                }

                const source_id = `MATCH:${match_id}:v1`;
                const existingEntry = await base44.asServiceRole.entities.PointsLedger.filter({ user_id: pred.user_id, source_id });
                if (existingEntry.length === 0) {
                    await base44.asServiceRole.entities.PointsLedger.create({
                        user_id: pred.user_id, mode: 'PRODE', source_type: 'MATCH', source_id,
                        points, breakdown_json: JSON.stringify(breakdown)
                    });
                    scored_count++;
                }
            }

            await base44.asServiceRole.entities.ScoringJob.update(job.id, { status: 'DONE' });
            log.push(`Match ${match_id} (${home_goals}-${away_goals}): ${scored_count}/${predictions.length} predictions scored`);
            totalScored += scored_count;
            matchesProcessed++;
        }

        log.push(`Done: ${matchesProcessed} matches processed, ${totalScored} predictions scored, ${totalSkipped} skipped`);
        return Response.json({ success: true, matchesProcessed, totalScored, totalSkipped, log });

    } catch (error) {
        log.push(`Error: ${error.message}`);
        return Response.json({ success: false, error: error.message, log }, { status: 500 });
    }
});