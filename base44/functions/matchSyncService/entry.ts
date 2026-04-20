import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * matchSyncService
 * 
 * Syncs match statuses from API-Football for all non-FINAL matches.
 * Designed to be called by a scheduled automation every 2 hours,
 * or manually triggered from the AdminMatchSync page.
 * 
 * Actions:
 *   - sync_matches : Fetch all SCHEDULED/LIVE matches, update statuses from API
 *   - get_log      : Return recent sync activity log (from IngestionRun)
 */

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 128;
const SEASON = 2025;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const body = await req.json().catch(() => ({}));
        const { action = 'sync_matches' } = body;

        // Allow both authenticated admin users and scheduled automation (no user)
        let user = null;
        try { user = await base44.auth.me(); } catch {}

        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        if (action === 'get_log') {
            const runs = await base44.asServiceRole.entities.IngestionRun.list('-started_at', 30);
            return Response.json({ ok: true, runs });
        }

        if (action === 'sync_matches') {
            return Response.json(await syncMatches(base44, user));
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('[matchSyncService] Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function apiFetch(path) {
    const apiKey = Deno.env.get('API_FUTBOL');
    if (!apiKey) throw new Error('API_FUTBOL secret not configured');
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'x-apisports-key': apiKey }
    });
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status} for ${path}`);
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
        throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
    }
    return json;
}

function mapStatus(apiStatus) {
    const finals = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
    const live = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
    if (finals.includes(apiStatus)) return 'FINAL';
    if (live.includes(apiStatus)) return 'LIVE';
    return 'SCHEDULED';
}

async function syncMatches(base44, user) {
    const startedAt = new Date().toISOString();
    const summary = { synced: 0, status_updates: 0, score_updates: 0, errors: [], skipped: 0 };

    // Get all non-FINAL matches from DB
    const allMatches = await base44.asServiceRole.entities.Match.list('-kickoff_at', 200);
    const matchesToSync = allMatches.filter(m => m.status !== 'FINAL' && m.api_fixture_id);

    console.log(`[matchSyncService] Syncing ${matchesToSync.length} non-final matches`);

    if (matchesToSync.length === 0) {
        const run = await base44.asServiceRole.entities.IngestionRun.create({
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            status: 'SUCCESS',
            summary_json: JSON.stringify({ job: 'matchSyncService', message: 'No non-final matches to sync', ...summary })
        });
        return { ok: true, message: 'No matches to sync', run_id: run.id, summary };
    }

    for (const match of matchesToSync) {
        try {
            await new Promise(r => setTimeout(r, 300)); // rate limit

            const data = await apiFetch(`/fixtures?id=${match.api_fixture_id}`);
            const fixture = data.response?.[0];

            if (!fixture) {
                summary.skipped++;
                continue;
            }

            const apiStatus = fixture.fixture?.status?.short;
            const newStatus = mapStatus(apiStatus);
            const homeGoals = fixture.goals?.home ?? null;
            const awayGoals = fixture.goals?.away ?? null;

            const updates = {};
            if (newStatus !== match.status) {
                updates.status = newStatus;
                summary.status_updates++;
            }

            if (Object.keys(updates).length > 0) {
                await base44.asServiceRole.entities.Match.update(match.id, updates);
            }

            // If newly FINAL, upsert MatchResultFinal and score predictions
            if (newStatus === 'FINAL' && homeGoals !== null && awayGoals !== null) {
                const existing = await base44.asServiceRole.entities.MatchResultFinal.filter({ match_id: match.id });
                if (existing.length === 0) {
                    await base44.asServiceRole.entities.MatchResultFinal.create({
                        match_id: match.id,
                        home_goals: homeGoals,
                        away_goals: awayGoals,
                        finalized_at: new Date().toISOString()
                    });
                    summary.score_updates++;

                    // Score prode predictions for this match
                    try {
                        await scoreProde(base44, match.id, homeGoals, awayGoals);
                        summary.scored = (summary.scored || 0) + 1;
                        console.log(`[matchSyncService] Prode scored for match ${match.id}`);
                    } catch (err) {
                        console.error(`[matchSyncService] Prode scoring error for match ${match.id}:`, err.message);
                        summary.errors.push({ fixture_id: match.api_fixture_id, error: `Prode scoring: ${err.message}` });
                    }
                }
            }

            summary.synced++;
            console.log(`[matchSyncService] ${match.api_fixture_id}: ${match.status} → ${newStatus} (${homeGoals}-${awayGoals})`);

        } catch (err) {
            console.error(`[matchSyncService] Error for fixture ${match.api_fixture_id}:`, err.message);
            summary.errors.push({ fixture_id: match.api_fixture_id, error: err.message });
        }
    }

    const status = summary.errors.length === 0 ? 'SUCCESS' : (summary.synced > 0 ? 'PARTIAL' : 'FAIL');

    const run = await base44.asServiceRole.entities.IngestionRun.create({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        status,
        summary_json: JSON.stringify({ job: 'matchSyncService', ...summary })
    });

    if (user) {
        await base44.asServiceRole.entities.AdminAuditLog.create({
            admin_user_id: user.id,
            actor_type: 'ADMIN',
            action: 'SYNC_MATCHES',
            entity_type: 'Match',
            entity_id: 'bulk',
            reason: 'Manual match sync triggered from AdminMatchSync',
            details_json: JSON.stringify(summary)
        });
    }

    return { ok: true, run_id: run.id, summary };
}

async function scoreProde(base44, match_id, home_goals, away_goals) {
    const dedupe_key = `PRODE:MATCH:${match_id}:v1`;

    // Idempotency check
    const existingJobs = await base44.asServiceRole.entities.ScoringJob.filter({ dedupe_key });
    if (existingJobs.length > 0 && existingJobs[0].status === 'DONE') {
        console.log(`[scoreProde] Already scored for match ${match_id}, skipping`);
        return;
    }

    // Upsert scoring job
    let job;
    if (existingJobs.length > 0) {
        job = await base44.asServiceRole.entities.ScoringJob.update(existingJobs[0].id, { status: 'RUNNING' });
        job = { ...existingJobs[0], status: 'RUNNING' };
    } else {
        job = await base44.asServiceRole.entities.ScoringJob.create({
            mode: 'PRODE', source_type: 'MATCH', source_id: `MATCH:${match_id}`,
            version: 1, dedupe_key, status: 'RUNNING'
        });
    }

    try {
        const predictions = await base44.asServiceRole.entities.ProdePrediction.filter({ match_id });
        let scored_count = 0;

        for (const pred of predictions) {
            let points = 0;
            const breakdown = {};

            if (pred.pred_home_goals === home_goals && pred.pred_away_goals === away_goals) {
                points += 5; breakdown.exact_score = 5;
            } else {
                const predWinner = pred.pred_home_goals > pred.pred_away_goals ? 'home' : pred.pred_home_goals < pred.pred_away_goals ? 'away' : 'draw';
                const actualWinner = home_goals > away_goals ? 'home' : home_goals < away_goals ? 'away' : 'draw';
                if (predWinner === actualWinner) { points += 3; breakdown.correct_winner = 3; }
            }

            if (points > 0) {
                const source_id = `MATCH:${match_id}:v1`;
                const existingEntries = await base44.asServiceRole.entities.PointsLedger.filter({ user_id: pred.user_id, source_id });
                if (existingEntries.length === 0) {
                    await base44.asServiceRole.entities.PointsLedger.create({
                        user_id: pred.user_id, mode: 'PRODE', source_type: 'MATCH', source_id, points,
                        breakdown_json: JSON.stringify(breakdown)
                    });
                    scored_count++;
                }
            }
        }

        await base44.asServiceRole.entities.ScoringJob.update(job.id, { status: 'DONE' });
        console.log(`[scoreProde] ${scored_count}/${predictions.length} predictions scored for match ${match_id}`);
    } catch (err) {
        await base44.asServiceRole.entities.ScoringJob.update(job.id, { status: 'FAILED', error_message: err.message });
        throw err;
    }
}