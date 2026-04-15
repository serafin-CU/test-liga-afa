import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered automatically when a new MatchResultFinal is created.
 * Calls fantasyScoringService to score all FantasySquads for the match.
 * Also scores Prode predictions via inline logic (idempotent).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both entity automation payload and direct invocation
    const match_id = body?.data?.match_id || body?.match_id;

    if (!match_id) {
      return Response.json({ error: 'match_id required' }, { status: 400 });
    }

    console.log(`[onMatchResultFinal] Triggered for match_id=${match_id}`);

    // --- 1. Score Fantasy ---
    const fantasyResult = await base44.asServiceRole.functions.invoke('fantasyScoringService', {
      action: 'score_fantasy_match',
      match_id,
      force: false
    });

    console.log(`[onMatchResultFinal] Fantasy scoring result:`, JSON.stringify(fantasyResult?.data || fantasyResult));

    // --- 2. Score Prode (idempotent) ---
    const prodeResult = await scoreProdeForMatch(base44, match_id);

    console.log(`[onMatchResultFinal] Prode scoring result:`, JSON.stringify(prodeResult));

    return Response.json({
      ok: true,
      match_id,
      fantasy: fantasyResult?.data || fantasyResult,
      prode: prodeResult
    });

  } catch (error) {
    console.error('[onMatchResultFinal] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function scoreProdeForMatch(base44, match_id) {
  const dedupe_key = `PRODE:MATCH:${match_id}:v1`;

  // Idempotency check
  const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({ dedupe_key });
  if (existingJobs.length > 0 && existingJobs[0].status === 'DONE') {
    return { skipped: true, reason: 'already_scored' };
  }

  // Load result
  const results = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id });
  if (results.length === 0) {
    return { skipped: true, reason: 'no_result_found' };
  }
  const finalResult = results[0];

  // Load predictions
  const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id });
  if (predictions.length === 0) {
    await base44.asServiceRole.entities.ScoringJob.create({
      mode: 'PRODE', source_type: 'MATCH',
      source_id: `MATCH:${match_id}`, version: 1, dedupe_key, status: 'DONE'
    });
    return { scored: 0, reason: 'no_predictions' };
  }

  // Load existing ledger entries to avoid dupes
  const source_id = `MATCH:${match_id}:v1`;
  const existingLedger = await base44.asServiceRole.entities.PointsLedger.filter({ source_id });
  const scoredUserIds = new Set(existingLedger.map(l => l.user_id));

  let scored = 0;
  for (const pred of predictions) {
    if (scoredUserIds.has(pred.user_id)) continue;

    let points = 0;
    const breakdown = {};

    if (pred.pred_home_goals === finalResult.home_goals && pred.pred_away_goals === finalResult.away_goals) {
      points = 5;
      breakdown.exact_score = 5;
    } else {
      const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' : pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
      const actualWinner = finalResult.home_goals > finalResult.away_goals ? 'home' : finalResult.home_goals < finalResult.away_goals ? 'away' : 'draw';
      if (predWinner === actualWinner) {
        points = 3;
        breakdown.correct_winner = 3;
      }
    }

    await base44.asServiceRole.entities.PointsLedger.create({
      user_id: pred.user_id,
      mode: 'PRODE',
      source_type: 'MATCH',
      source_id,
      points,
      breakdown_json: JSON.stringify(breakdown)
    });
    scored++;
  }

  await base44.asServiceRole.entities.ScoringJob.create({
    mode: 'PRODE', source_type: 'MATCH',
    source_id: `MATCH:${match_id}`, version: 1, dedupe_key, status: 'DONE'
  });

  return { scored, predictions_total: predictions.length };
}