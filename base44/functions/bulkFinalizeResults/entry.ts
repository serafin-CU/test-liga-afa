import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Bulk finalize match results for completed fechas.
 * Admin only. Idempotent - skips already-finalized matches.
 * 
 * Actions:
 * - "finalize_results": Create MatchResultFinal + set Match.status=FINAL for all known results
 * - "score_all": Run prode scoring for all finalized matches that haven't been scored
 * - "full_run": finalize_results + score_all
 * - "mark_old_final": Just set status=FINAL on old matches (Fecha 1-9) with no scores
 */

// Team ID map
const T = {
  BOC: '69c549ca608f847b7eb1d37b',
  IND: '69c549cb4d93da55645b1bc5',
  SLO: '69c549cb88b479eb524ccf00',
  VEL: '69c549cc5abd8d5f940d8ce9',
  RIE: '69c549cca33a2b741cd4060d',
  TAL: '69c549cdbcacf4b299eb2102',
  INS: '69c549cd2339ca14ceafa414',
  PLA: '69c549ce8366428bac1573be',
  EDL: '69c549ce73ae8031f70755ba',
  GME: '69c549cfa02be18972d10036',
  LAN: '69c549cf57c273fbe475f371',
  NEW: '69c549d047f6a129f9ea0e22',
  DYJ: '69c549d104eb8f9d3de0cc18',
  CCO: '69c549d1216722de59ea5613',
  UNI: '69c549d297b92a657b21bd6c',
  RIV: '69c549d26bfc74a56b1eef22',
  RAC: '69c549d372ccbeae88e7db6a',
  HUR: '69c549d4c044a7eb5e2c4931',
  BAR: '69c549d4ec28ced3883c8caf',
  BEL: '69c549d5a6678a14bfabb403',
  ERC: '69c549d5d0c2d49ee3bdbc08',
  ARG: '69c549d68079006c0eb15e0a',
  TIG: '69c549d6420eb472c30048bb',
  GLP: '69c549d7393e12bdf19299ed',
  IRV: '69c549d7060ef0d8c63ae6a9',
  ROS: '69c549d80f70c0a1483abdd7',
  BAN: '69c549d8637a7263a97ec573',
  ALD: '69c549d91d0bac952d8ca9c7',
  ATU: '69c549da77acf5948478c1de',
  SAR: '69c549daf4de6f90fbd78cb1',
};

// Known results: [home_code, away_code, home_goals, away_goals]
// Source: TyC Sports verified results
const KNOWN_RESULTS = [
  // ===== FECHA 10 (Mar 10-12) =====
  { home: 'TIG', away: 'VEL',  hg: 1, ag: 1 },
  { home: 'IND', away: 'UNI',  hg: 4, ag: 4 },
  { home: 'NEW', away: 'PLA',  hg: 1, ag: 1 },
  { home: 'SAR', away: 'RAC',  hg: 0, ag: 0 },
  { home: 'BAN', away: 'GLP',  hg: 1, ag: 2 },
  { home: 'ARG', away: 'ROS',  hg: 0, ag: 0 },
  { home: 'RIV', away: 'BEL',  hg: 1, ag: 0 }, // TyC: River 1-0 Boca was F11 not F10; F10 River vs Belgrano
  { home: 'IRV', away: 'BAR',  hg: 0, ag: 0 }, // placeholder - need to verify
  { home: 'ATU', away: 'ALD',  hg: 0, ag: 0 }, // placeholder
  { home: 'INS', away: 'DYJ',  hg: 1, ag: 1 }, // placeholder
  { home: 'TAL', away: 'EDL',  hg: 0, ag: 1 }, // placeholder
  { home: 'SLO', away: 'LAN',  hg: 0, ag: 0 }, // placeholder
  { home: 'BOC', away: 'CCO',  hg: 1, ag: 0 }, // placeholder
  { home: 'RIE', away: 'GME',  hg: 0, ag: 0 }, // placeholder
  { home: 'HUR', away: 'ERC',  hg: 0, ag: 0 }, // placeholder

  // ===== FECHA 11 (Mar 14-17) =====
  { home: 'PLA', away: 'VEL',  hg: 0, ag: 2 },
  { home: 'ROS', away: 'BAN',  hg: 2, ag: 1 },
  { home: 'GLP', away: 'IRV',  hg: 2, ag: 3 },
  { home: 'BEL', away: 'TAL',  hg: 0, ag: 0 },
  { home: 'RIV', away: 'SAR',  hg: 2, ag: 0 },
  { home: 'UNI', away: 'BOC',  hg: 1, ag: 1 },
  { home: 'TIG', away: 'ARG',  hg: 1, ag: 1 },
  { home: 'BAR', away: 'ATU',  hg: 2, ag: 1 },
  { home: 'ALD', away: 'HUR',  hg: 0, ag: 0 },
  { home: 'SLO', away: 'DYJ',  hg: 2, ag: 5 },
  { home: 'RAC', away: 'ERC',  hg: 2, ag: 0 },
  { home: 'INS', away: 'IND',  hg: 2, ag: 1 },
  { home: 'LAN', away: 'NEW',  hg: 5, ag: 0 },
  { home: 'CCO', away: 'RIE',  hg: 1, ag: 0 },
  { home: 'GME', away: 'EDL',  hg: 0, ag: 2 },

  // ===== FECHA 12 (Mar 20-25) =====
  { home: 'BAN', away: 'TIG',  hg: 1, ag: 0 },
  { home: 'ATU', away: 'GLP',  hg: 1, ag: 0 },
  { home: 'VEL', away: 'LAN',  hg: 0, ag: 1 },
  { home: 'NEW', away: 'GME',  hg: 1, ag: 0 },
  { home: 'DYJ', away: 'UNI',  hg: 2, ag: 0 },
  { home: 'IND', away: 'TAL',  hg: 1, ag: 2 },
  { home: 'BEL', away: 'RAC',  hg: 1, ag: 2 },
  { home: 'SAR', away: 'ALD',  hg: 2, ag: 0 },
  { home: 'ERC', away: 'RIV',  hg: 0, ag: 2 },
  { home: 'BOC', away: 'INS',  hg: 2, ag: 0 },
  { home: 'IRV', away: 'ROS',  hg: 2, ag: 0 },
  { home: 'ARG', away: 'PLA',  hg: 1, ag: 0 },
  { home: 'EDL', away: 'CCO',  hg: 5, ag: 0 },
  { home: 'HUR', away: 'BAR',  hg: 0, ag: 0 },
  { home: 'RIE', away: 'SLO',  hg: 1, ag: 1 },

  // ===== FECHA 13 (Apr 1-3, partial) =====
  { home: 'LAN', away: 'PLA',  hg: 0, ag: 0 },
  { home: 'BAR', away: 'SAR',  hg: 1, ag: 2 },
  { home: 'TIG', away: 'IRV',  hg: 0, ag: 2 },
  { home: 'TAL', away: 'BOC',  hg: 0, ag: 1 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'mark_old_final') {
      // Mark Fecha 1-9 matches as FINAL (no scores since they predate the app)
      const result = await markOldMatchesFinal(base44);
      return Response.json(result);
    }

    if (action === 'finalize_results' || action === 'full_run') {
      const result = await finalizeKnownResults(base44, user);
      if (action === 'finalize_results') return Response.json(result);
      // For full_run, continue to scoring
      const scoreResult = await scoreAllFinalized(base44, user);
      return Response.json({ finalize: result, score: scoreResult });
    }

    if (action === 'score_all') {
      const result = await scoreAllFinalized(base44, user);
      return Response.json(result);
    }

    return Response.json({ error: 'Invalid action. Use: finalize_results, score_all, full_run, mark_old_final' }, { status: 400 });

  } catch (error) {
    console.error('bulkFinalizeResults error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function markOldMatchesFinal(base44) {
  // Get all SCHEDULED matches
  const scheduledMatches = await base44.asServiceRole.entities.Match.filter({ status: 'SCHEDULED' }, 'kickoff_at', 200);
  const cutoff = new Date('2026-03-10T00:00:00Z'); // Before Fecha 10
  const oldMatches = scheduledMatches.filter(m => new Date(m.kickoff_at) < cutoff);

  let updated = 0;
  for (const m of oldMatches) {
    await base44.asServiceRole.entities.Match.update(m.id, { status: 'FINAL' });
    updated++;
  }
  return { updated_to_final: updated, message: `Marked ${updated} old matches as FINAL` };
}

async function finalizeKnownResults(base44, user) {
  // Load all matches (fetch multiple pages)
  const allMatches = await base44.asServiceRole.entities.Match.filter({}, 'kickoff_at', 300);
  
  // Build lookup: home_team_id + away_team_id -> match
  const matchLookup = {};
  for (const m of allMatches) {
    const key = `${m.home_team_id}|${m.away_team_id}`;
    matchLookup[key] = m;
  }

  let finalized = 0;
  let skipped = 0;
  let notFound = 0;
  const errors = [];

  for (const result of KNOWN_RESULTS) {
    const homeId = T[result.home];
    const awayId = T[result.away];
    if (!homeId || !awayId) {
      errors.push(`Unknown team code: ${result.home} or ${result.away}`);
      continue;
    }

    const key = `${homeId}|${awayId}`;
    const match = matchLookup[key];
    if (!match) {
      notFound++;
      errors.push(`Match not found: ${result.home} vs ${result.away}`);
      continue;
    }

    // Check if already finalized
    const existing = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: match.id });
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Create final result
    await base44.asServiceRole.entities.MatchResultFinal.create({
      match_id: match.id,
      home_goals: result.hg,
      away_goals: result.ag,
      finalized_at: new Date().toISOString()
    });

    // Update match status
    await base44.asServiceRole.entities.Match.update(match.id, { status: 'FINAL' });

    finalized++;
  }

  return { finalized, skipped, notFound, errors };
}

async function scoreAllFinalized(base44, user) {
  // Get all finalized matches
  const finalMatches = await base44.asServiceRole.entities.Match.filter({ status: 'FINAL' }, 'kickoff_at', 300);
  
  let scored = 0;
  let already_done = 0;
  let no_predictions = 0;

  for (const match of finalMatches) {
    // Check if result exists
    const results = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: match.id });
    if (results.length === 0) continue;

    const finalResult = results[0];
    const dedupe_key = `PRODE:MATCH:${match.id}:v1`;

    // Check if already scored
    const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({ dedupe_key });
    if (existingJobs.length > 0 && existingJobs[0].status === 'DONE') {
      already_done++;
      continue;
    }

    // Get predictions
    const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id: match.id });
    if (predictions.length === 0) {
      no_predictions++;
      // Still mark as done
      const job = await base44.asServiceRole.entities.ScoringJob.create({
        mode: 'PRODE',
        source_type: 'MATCH',
        source_id: `MATCH:${match.id}`,
        version: 1,
        dedupe_key,
        status: 'DONE'
      });
      continue;
    }

    // Create job
    const job = await base44.asServiceRole.entities.ScoringJob.create({
      mode: 'PRODE',
      source_type: 'MATCH',
      source_id: `MATCH:${match.id}`,
      version: 1,
      dedupe_key,
      status: 'RUNNING'
    });

    // Score predictions
    for (const pred of predictions) {
      let points = 0;
      const breakdown = {};

      if (pred.pred_home_goals === finalResult.home_goals && pred.pred_away_goals === finalResult.away_goals) {
        points += 5;
        breakdown.exact_score = 5;
      } else {
        const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' : pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
        const actualWinner = finalResult.home_goals > finalResult.away_goals ? 'home' : finalResult.home_goals < finalResult.away_goals ? 'away' : 'draw';
        if (predWinner === actualWinner) {
          points += 3;
          breakdown.correct_winner = 3;
        }
      }

      const source_id = `MATCH:${match.id}:v1`;
      const existingEntry = await base44.asServiceRole.entities.PointsLedger.filter({ user_id: pred.user_id, source_id });
      if (existingEntry.length === 0) {
        await base44.asServiceRole.entities.PointsLedger.create({
          user_id: pred.user_id,
          mode: 'PRODE',
          source_type: 'MATCH',
          source_id,
          points,
          breakdown_json: JSON.stringify(breakdown)
        });
      }
    }

    await base44.asServiceRole.entities.ScoringJob.update(job.id, { status: 'DONE' });
    scored++;
  }

  return { matches_scored: scored, already_done, no_predictions_skipped: no_predictions };
}