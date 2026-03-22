import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Prode Service - Handles predictions and scoring for Prode mode
 * 
 * Endpoints:
 * - POST { action: "submit_prediction" } - Submit/update match prediction
 * - POST { action: "get_user_predictions" } - Get all predictions for a user
 * - POST { action: "finalize_match_result" } - Finalize match result (admin only)
 * - POST { action: "score_match" } - Score predictions for a match (idempotent)
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
            case 'submit_prediction':
                return await submitPrediction(base44, user, body);
            case 'get_user_predictions':
                return await getUserPredictions(base44, user, body);
            case 'finalize_match_result':
                return await finalizeMatchResult(base44, user, body);
            case 'score_match':
                return await scoreMatch(base44, user, body);
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Prode service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Submit or update a prediction
 * Constraint: UNIQUE(match_id, user_id)
 */
async function submitPrediction(base44, user, body) {
    const { match_id, pred_home_goals, pred_away_goals, pred_mvp_player_id } = body;

    // Server-side validation
    const errors = [];
    if (!match_id) errors.push('match_id is required');
    if (typeof pred_home_goals !== 'number') errors.push('pred_home_goals is required');
    if (typeof pred_away_goals !== 'number') errors.push('pred_away_goals is required');
    if (pred_home_goals < 0 || pred_home_goals > 20) errors.push('pred_home_goals must be 0-20');
    if (pred_away_goals < 0 || pred_away_goals > 20) errors.push('pred_away_goals must be 0-20');

    if (errors.length > 0) {
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Check if match exists and hasn't started yet
    const matches = await base44.asServiceRole.entities.Match.filter({ id: match_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];
    const now = new Date();
    const kickoff = new Date(match.kickoff_at);

    if (now >= kickoff) {
        return Response.json({ 
            error: 'Cannot submit prediction after match kickoff',
            kickoff_at: match.kickoff_at
        }, { status: 400 });
    }

    // Check for existing prediction
    const existing = await base44.asServiceRole.entities.ProdePrediction.filter({
        match_id,
        user_id: user.id
    });

    let prediction;
    if (existing.length > 0) {
        // Update existing prediction
        prediction = await base44.asServiceRole.entities.ProdePrediction.update(existing[0].id, {
            pred_home_goals,
            pred_away_goals,
            pred_mvp_player_id: pred_mvp_player_id || null
        });
    } else {
        // Create new prediction
        prediction = await base44.asServiceRole.entities.ProdePrediction.create({
            match_id,
            user_id: user.id,
            pred_home_goals,
            pred_away_goals,
            pred_mvp_player_id: pred_mvp_player_id || null,
            submitted_at: new Date().toISOString()
        });
    }

    return Response.json({ success: true, prediction });
}

/**
 * Get all predictions for a user
 */
async function getUserPredictions(base44, user, body) {
    const { target_user_id } = body;
    
    // Non-admin users can only see their own predictions
    const userId = user.role === 'admin' && target_user_id ? target_user_id : user.id;

    const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({
        user_id: userId
    }, '-submitted_at', 100);

    return Response.json({ success: true, predictions, total: predictions.length });
}

/**
 * Finalize match result (admin only)
 * Creates MatchResultFinal entry (one per match)
 */
async function finalizeMatchResult(base44, user, body) {
    // Admin check
    if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { match_id, home_goals, away_goals, mvp_player_id } = body;

    // Validation
    const errors = [];
    if (!match_id) errors.push('match_id is required');
    if (typeof home_goals !== 'number') errors.push('home_goals is required');
    if (typeof away_goals !== 'number') errors.push('away_goals is required');
    if (home_goals < 0 || home_goals > 20) errors.push('home_goals must be 0-20');
    if (away_goals < 0 || away_goals > 20) errors.push('away_goals must be 0-20');

    if (errors.length > 0) {
        return Response.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Check if match exists
    const matches = await base44.asServiceRole.entities.Match.filter({ id: match_id });
    if (matches.length === 0) {
        return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    // Check if result already exists
    const existing = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id });
    if (existing.length > 0) {
        return Response.json({ 
            error: 'Match result already finalized',
            existing_result: existing[0]
        }, { status: 409 });
    }

    // Create final result
    const result = await base44.asServiceRole.entities.MatchResultFinal.create({
        match_id,
        home_goals,
        away_goals,
        mvp_player_id: mvp_player_id || null,
        finalized_at: new Date().toISOString()
    });

    // Update match status to FINAL
    await base44.asServiceRole.entities.Match.update(match_id, {
        status: 'FINAL'
    });

    // Log admin action
    await base44.asServiceRole.entities.AdminAuditLog.create({
        admin_user_id: user.id,
        action: 'FINALIZE_MATCH_RESULT',
        entity_type: 'MatchResultFinal',
        entity_id: result.id,
        reason: 'Match result finalized',
        details_json: JSON.stringify({ match_id, home_goals, away_goals, mvp_player_id })
    });

    return Response.json({ success: true, result });
}

/**
 * Score predictions for a match (idempotent via ScoringJob dedupe_key)
 * Admin only
 */
async function scoreMatch(base44, user, body) {
    // Admin check
    if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { match_id, version } = body;
    const scoringVersion = version || 1;

    if (!match_id) {
        return Response.json({ error: 'match_id is required' }, { status: 400 });
    }

    // Check if match result is finalized
    const results = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id });
    if (results.length === 0) {
        return Response.json({ 
            error: 'Match result not finalized yet. Finalize first before scoring.' 
        }, { status: 400 });
    }

    const finalResult = results[0];
    const dedupe_key = `PRODE:MATCH:${match_id}:v${scoringVersion}`;

    // Check if scoring job already exists (idempotency)
    const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({ dedupe_key });
    if (existingJobs.length > 0 && existingJobs[0].status === 'DONE') {
        return Response.json({ 
            success: true,
            idempotent: true,
            message: 'Scoring already completed for this match',
            job: existingJobs[0]
        });
    }

    // Create or update job
    let job;
    if (existingJobs.length > 0) {
        job = await base44.asServiceRole.entities.ScoringJob.update(existingJobs[0].id, {
            status: 'RUNNING'
        });
    } else {
        job = await base44.asServiceRole.entities.ScoringJob.create({
            mode: 'PRODE',
            source_type: 'MATCH',
            source_id: `MATCH:${match_id}`,
            version: scoringVersion,
            dedupe_key,
            status: 'RUNNING'
        });
    }

    try {
        // Get all predictions for this match
        const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id });

        let scored_count = 0;

        for (const pred of predictions) {
            // Scoring logic (example - adjust based on actual rules)
            let points = 0;
            const breakdown = {};

            // Exact score: 5 points
            if (pred.pred_home_goals === finalResult.home_goals && 
                pred.pred_away_goals === finalResult.away_goals) {
                points += 5;
                breakdown.exact_score = 5;
            }
            // Correct winner: 3 points
            else {
                const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' : 
                                 pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
                const actualWinner = finalResult.home_goals > finalResult.away_goals ? 'home' : 
                                   finalResult.home_goals < finalResult.away_goals ? 'away' : 'draw';
                
                if (predWinner === actualWinner) {
                    points += 3;
                    breakdown.correct_winner = 3;
                }
            }

            // MVP bonus: 2 points
            if (pred.pred_mvp_player_id && pred.pred_mvp_player_id === finalResult.mvp_player_id) {
                points += 2;
                breakdown.mvp_correct = 2;
            }

            // Create ledger entry (idempotent via source_id)
            const source_id = `MATCH:${match_id}:v${scoringVersion}`;
            
            // Check if entry already exists
            const existingEntries = await base44.asServiceRole.entities.PointsLedger.filter({
                user_id: pred.user_id,
                source_id
            });

            if (existingEntries.length === 0 && points > 0) {
                await base44.asServiceRole.entities.PointsLedger.create({
                    user_id: pred.user_id,
                    mode: 'PRODE',
                    source_type: 'MATCH',
                    source_id,
                    points,
                    breakdown_json: JSON.stringify(breakdown)
                });
                scored_count++;
            }
        }

        // Update job status
        await base44.asServiceRole.entities.ScoringJob.update(job.id, {
            status: 'DONE'
        });

        // Log admin action
        await base44.asServiceRole.entities.AdminAuditLog.create({
            admin_user_id: user.id,
            action: 'SCORE_MATCH_PRODE',
            entity_type: 'ScoringJob',
            entity_id: job.id,
            reason: 'Scored prode predictions for match',
            details_json: JSON.stringify({ 
                match_id, 
                predictions_count: predictions.length,
                scored_count,
                version: scoringVersion
            })
        });

        return Response.json({ 
            success: true,
            predictions_count: predictions.length,
            scored_count,
            job
        });

    } catch (error) {
        // Update job as failed
        await base44.asServiceRole.entities.ScoringJob.update(job.id, {
            status: 'FAILED',
            error_message: error.message
        });
        throw error;
    }
}