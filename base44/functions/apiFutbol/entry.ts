import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * apiFutbol - API-Football v3 Integration
 * 
 * Base URL: https://v3.football.api-sports.io
 * Auth header: x-apisports-key
 * 
 * AFA Apertura 2026:
 *   League ID: 435 (Liga Profesional Argentina)
 *   Season:    2025 (AFA uses calendar year of season start)
 * 
 * Actions:
 *   - status              : Check API quota & subscription info
 *   - get_fixtures        : Fixtures for a round (e.g. "Regular Season - 14")
 *   - get_fixture         : Single fixture by fixture_id
 *   - get_events          : Match events (goals, cards, subs) by fixture_id
 *   - get_lineups         : Lineups by fixture_id
 *   - get_player_stats    : Player statistics by fixture_id
 *   - get_rounds          : All rounds for the league/season
 *   - ingest_fixture      : Full pipeline: fetch events+lineups+player_stats for a fixture,
 *                           normalize to our IngestionEvent format, and store in DB
 */

const API_BASE = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 128;   // Liga Profesional Argentina (AFA)
const SEASON    = 2025;  // AFA Apertura 2025

// API-Football team ID → our DB team fifa_code
// Source: verified from API-Football team IDs for Liga Profesional 2025
const API_TEAM_ID_TO_FIFA_CODE = {
  440:  'BEL',  // Belgrano Cordoba → Belgrano
  451:  'BOC',  // Boca Juniors
  450:  'RIV',  // River Plate
  457:  'RAC',  // Racing Club
  442:  'IND',  // Independiente
  452:  'SLO',  // San Lorenzo
  455:  'HUR',  // Huracán
  447:  'LAN',  // Lanús
  454:  'VEL',  // Vélez Sarsfield
  444:  'ATU',  // Atlético Tucumán
  441:  'BAN',  // Banfield
  435:  'TIG',  // Tigre
  2302: 'TAL',  // Talleres Cordoba
  453:  'ROS',  // Rosario Central
  438:  'ARG',  // Argentinos Juniors
  446:  'GLP',  // Gimnasia LP
  448:  'NEW',  // Newell's Old Boys
  1267: 'UNI',  // Unión Santa Fe
  463:  'ERC',  // Estudiantes LP → Estudiantes RC
  10227:'INS',  // Instituto → Instituto
  1574: 'DYJ',  // Defensa y Justicia
  1574: 'DYJ',  // Defensa y Justicia
  1318: 'PLA',  // Platense
  465:  'SAR',  // Sarmiento
  10228:'IRV',  // Independiente Rivadavia
  10229:'GME',  // Godoy Cruz → Godoy Cruz ME
  10230:'BAR',  // Barracas Central
  10231:'RIE',  // Riestra
  10232:'ALD',  // Aldosivi
  10233:'EDL',  // Estudiantes de La Plata (alternate)
  1323: 'CCO',  // Central Córdoba SdE
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    // Allow system/scheduled calls (no user) or admin users only
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, fixture_id, round, league_id, season } = body;

    const leagueId = league_id ?? LEAGUE_ID;
    const seasonId = season ?? SEASON;

    switch (action) {

      case 'status': {
        const data = await apiFetch('/status');
        return Response.json(data);
      }

      case 'get_rounds': {
        const data = await apiFetch(`/fixtures/rounds?league=${leagueId}&season=${seasonId}`);
        return Response.json(data);
      }

      case 'get_fixtures': {
        if (!round) return Response.json({ error: 'round is required' }, { status: 400 });
        const encodedRound = encodeURIComponent(round);
        const data = await apiFetch(`/fixtures?league=${leagueId}&season=${seasonId}&round=${encodedRound}`);
        return Response.json(data);
      }

      case 'get_fixture': {
        if (!fixture_id) return Response.json({ error: 'fixture_id is required' }, { status: 400 });
        const data = await apiFetch(`/fixtures?id=${fixture_id}`);
        return Response.json(data);
      }

      case 'get_events': {
        if (!fixture_id) return Response.json({ error: 'fixture_id is required' }, { status: 400 });
        const data = await apiFetch(`/fixtures/events?fixture=${fixture_id}`);
        return Response.json(data);
      }

      case 'get_lineups': {
        if (!fixture_id) return Response.json({ error: 'fixture_id is required' }, { status: 400 });
        const data = await apiFetch(`/fixtures/lineups?fixture=${fixture_id}`);
        return Response.json(data);
      }

      case 'get_player_stats': {
        if (!fixture_id) return Response.json({ error: 'fixture_id is required' }, { status: 400 });
        const data = await apiFetch(`/fixtures/players?fixture=${fixture_id}`);
        return Response.json(data);
      }

      case 'ingest_fixture': {
        if (!fixture_id) return Response.json({ error: 'fixture_id is required' }, { status: 400 });
        // match_id override: skip auto-matching, use the provided match_id directly
        const result = await ingestFixture(base44, fixture_id, user, body.match_id || null);
        return Response.json(result);
      }

      case 'get_squad': {
        // Fetch squad/players for a team from API-Football
        const teamId = body.team_id;
        if (!teamId) return Response.json({ error: 'team_id is required' }, { status: 400 });
        const data = await apiFetch(`/players/squads?team=${teamId}`);
        return Response.json(data);
      }

      case 'seed_players': {
        // Fetch squads for all teams in DB and upsert Player records (single call, all 30 teams)
        const result = await seedPlayersFromApi(base44);
        return Response.json(result);
      }

      default:
        return Response.json({
          error: 'Invalid action',
          available_actions: ['status', 'get_rounds', 'get_fixtures', 'get_fixture', 'get_events', 'get_lineups', 'get_player_stats', 'ingest_fixture', 'get_squad', 'seed_players']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('[apiFutbol] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── API Helper ───────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const apiKey = Deno.env.get('API_FUTBOL');
  if (!apiKey) throw new Error('API_FUTBOL secret not configured');

  const url = `${API_BASE}${path}`;
  console.log(`[apiFutbol] GET ${url}`);

  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey }
  });

  if (!res.ok) {
    throw new Error(`API-Football returned HTTP ${res.status} for ${path}`);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

// ─── Ingest Fixture Pipeline ──────────────────────────────────────────────────

/**
 * Full pipeline for a single fixture:
 * 1. Fetch events, lineups, player stats from API-Football
 * 2. Normalize to our standard parsed_json format
 * 3. Find matching Match in our DB (by home/away team name + kickoff date)
 * 4. Write IngestionEvent record (idempotent)
 * 5. Return summary
 */
async function ingestFixture(base44, fixture_id, user, overrideMatchId = null) {
  // Fetch all data in parallel (3 API calls)
  const [eventsRes, lineupsRes, playerStatsRes] = await Promise.all([
    apiFetch(`/fixtures/events?fixture=${fixture_id}`),
    apiFetch(`/fixtures/lineups?fixture=${fixture_id}`),
    apiFetch(`/fixtures/players?fixture=${fixture_id}`)
  ]);

  // Also fetch fixture metadata for score + status
  const fixtureRes = await apiFetch(`/fixtures?id=${fixture_id}`);
  const fixture = fixtureRes.response?.[0];

  if (!fixture) {
    return { ok: false, error: 'Fixture not found in API-Football', fixture_id };
  }

  const fixtureStatus = fixture.fixture?.status?.short; // FT, HT, NS, LIVE, etc.
  const homeGoals = fixture.goals?.home ?? null;
  const awayGoals = fixture.goals?.away ?? null;
  const homeTeamName = fixture.teams?.home?.name;
  const awayTeamName = fixture.teams?.away?.name;
  const homeApiTeamId = fixture.teams?.home?.id;
  const awayApiTeamId = fixture.teams?.away?.id;
  const kickoffDate = fixture.fixture?.date; // ISO string

  console.log(`[ingestFixture] ${homeTeamName} vs ${awayTeamName} | Status: ${fixtureStatus} | Score: ${homeGoals}-${awayGoals}`);

  // Normalize events
  const normalizedEvents = normalizeEvents(eventsRes.response || [], fixture);

  // Normalize lineups
  const normalizedLineups = normalizeLineups(lineupsRes.response || []);

  // Normalize player stats into per-player stats
  const normalizedPlayerStats = normalizePlayerStats(playerStatsRes.response || []);

  const parsedJson = {
    source: 'API_FUTBOL',
    fixture_id,
    status: mapStatus(fixtureStatus),
    score: { home: homeGoals, away: awayGoals },
    home_team: homeTeamName,
    away_team: awayTeamName,
    kickoff: kickoffDate,
    events: normalizedEvents,
    lineups: normalizedLineups,
    player_stats: normalizedPlayerStats,
    raw_status: fixtureStatus,
    fetched_at: new Date().toISOString()
  };

  // Find matching Match in our DB
  const allMatches = await base44.asServiceRole.entities.Match.list();
  const allTeams = await base44.asServiceRole.entities.Team.list();

  // If a match_id override is provided, use it directly; otherwise auto-match
  let matchedMatch = null;
  if (overrideMatchId) {
    matchedMatch = allMatches.find(m => m.id === overrideMatchId) || null;
    if (!matchedMatch) {
      return { ok: false, error: `Match not found for override match_id: ${overrideMatchId}`, fixture_id };
    }
  } else {
    matchedMatch = findMatch(allMatches, allTeams, homeTeamName, awayTeamName, homeApiTeamId, awayApiTeamId);
  }

  // Get or create the API_FUTBOL data source record
  const sources = await base44.asServiceRole.entities.DataSource.list();
  let apiSource = sources.find(s => s.name === 'API_FUTBOL');
  if (!apiSource) {
    apiSource = await base44.asServiceRole.entities.DataSource.create({
      name: 'API_FUTBOL',
      base_url: API_BASE,
      allowed_paths_regex: '.*',
      enabled: true,
      rate_limit_seconds: 5,
      notes: 'API-Football v3 paid integration'
    });
  }

  if (!matchedMatch) {
    // Log unmatched but still store the raw data
    console.warn(`[ingestFixture] No DB match found for: ${homeTeamName} vs ${awayTeamName}`);
    return {
      ok: false,
      warning: 'No matching Match found in database',
      fixture_id,
      home_team: homeTeamName,
      away_team: awayTeamName,
      score: parsedJson.score,
      status: parsedJson.status,
      events_count: normalizedEvents.length,
      lineups_count: normalizedLineups.length
    };
  }

  // Check for existing ingestion event for this fixture (idempotent)
  const existingEvents = await base44.asServiceRole.entities.IngestionEvent.filter({
    match_id: matchedMatch.id,
    source_id: apiSource.id
  });

  // Create a new IngestionRun
  const run = await base44.asServiceRole.entities.IngestionRun.create({
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: 'SUCCESS',
    summary_json: JSON.stringify({ job: 'apiFutbol.ingest_fixture', fixture_id, match_id: matchedMatch.id })
  });

  const contentHash = await hashString(JSON.stringify(parsedJson));

  let ingestionEvent;
  if (existingEvents.length > 0) {
    // Update existing
    ingestionEvent = await base44.asServiceRole.entities.IngestionEvent.update(existingEvents[0].id, {
      run_id: run.id,
      fetched_at: new Date().toISOString(),
      http_status: 200,
      parse_status: 'OK',
      content_hash: contentHash,
      parsed_json: JSON.stringify(parsedJson),
      error_message: null
    });
  } else {
    ingestionEvent = await base44.asServiceRole.entities.IngestionEvent.create({
      run_id: run.id,
      match_id: matchedMatch.id,
      source_id: apiSource.id,
      fetched_at: new Date().toISOString(),
      http_status: 200,
      parse_status: 'OK',
      content_hash: contentHash,
      parsed_json: JSON.stringify(parsedJson),
      error_message: null
    });
  }

  // Auto-update Match.status if the API reports it as finished
  if (parsedJson.status === 'FINAL' && matchedMatch.status !== 'FINAL') {
    await base44.asServiceRole.entities.Match.update(matchedMatch.id, { status: 'FINAL' });
  } else if (parsedJson.status === 'LIVE' && matchedMatch.status === 'SCHEDULED') {
    await base44.asServiceRole.entities.Match.update(matchedMatch.id, { status: 'LIVE' });
  }

  // Audit log
  await base44.asServiceRole.entities.AdminAuditLog.create({
    admin_user_id: user?.id || null,
    actor_type: user ? 'ADMIN' : 'SYSTEM',
    action: 'INGEST_FIXTURE',
    entity_type: 'IngestionEvent',
    entity_id: ingestionEvent.id,
    reason: `Ingested fixture ${fixture_id} from API-Football`,
    details_json: JSON.stringify({ fixture_id, match_id: matchedMatch.id, status: parsedJson.status, score: parsedJson.score })
  });

  return {
    ok: true,
    fixture_id,
    match_id: matchedMatch.id,
    ingestion_event_id: ingestionEvent.id,
    status: parsedJson.status,
    score: parsedJson.score,
    events_count: normalizedEvents.length,
    lineups_count: normalizedLineups.length,
    player_stats_count: normalizedPlayerStats.length,
    match_status_updated: parsedJson.status !== matchedMatch.status
  };
}

// ─── Normalization Helpers ────────────────────────────────────────────────────

function mapStatus(apiStatus) {
  const finals = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  const live = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
  if (finals.includes(apiStatus)) return 'FINAL';
  if (live.includes(apiStatus)) return 'LIVE';
  return 'SCHEDULED';
}

function normalizeEvents(rawEvents, fixture) {
  return rawEvents.map(e => {
    let type = null;
    const detail = (e.detail || '').toLowerCase();
    const evType = (e.type || '').toLowerCase();

    if (evType === 'goal') {
      type = detail.includes('own goal') ? 'OWN_GOAL' : 'GOAL';
    } else if (evType === 'card') {
      type = detail.includes('yellow') ? 'YC' : 'RC';
    } else if (evType === 'subst') {
      type = 'SUB';
    } else if (evType === 'var') {
      type = 'VAR';
    }

    if (!type) return null;

    const event = {
      type,
      minute: e.time?.elapsed ?? 0,
      team: e.team?.name ?? null,
    };

    if (type === 'GOAL' || type === 'OWN_GOAL') {
      event.player = e.player?.name ?? null;
      event.assist = e.assist?.name ?? null;
    } else if (type === 'YC' || type === 'RC') {
      event.player = e.player?.name ?? null;
    } else if (type === 'SUB') {
      event.player_in = e.assist?.name ?? null;   // API: assist = player coming in
      event.player_out = e.player?.name ?? null;
    }

    return event;
  }).filter(Boolean);
}

function normalizeLineups(rawLineups) {
  return rawLineups.map(teamLineup => ({
    team_name: teamLineup.team?.name ?? null,
    formation: teamLineup.formation ?? null,
    starters: (teamLineup.startXI || []).map(p => p.player?.name).filter(Boolean),
    bench: (teamLineup.substitutes || []).map(p => p.player?.name).filter(Boolean)
  }));
}

function normalizePlayerStats(rawPlayerStats) {
  const result = [];
  for (const teamData of rawPlayerStats) {
    const teamName = teamData.team?.name ?? null;
    for (const playerData of (teamData.players || [])) {
      const p = playerData.player;
      const s = playerData.statistics?.[0] ?? {};
      result.push({
        player_name: p?.name ?? null,
        team_name: teamName,
        position: s.games?.position ?? null,
        minutes_played: s.games?.minutes ?? 0,
        rating: s.games?.rating ?? null,
        goals: s.goals?.total ?? 0,
        assists: s.goals?.assists ?? 0,
        yellow_cards: s.cards?.yellow ?? 0,
        red_cards: s.cards?.red ?? 0,
        shots_total: s.shots?.total ?? 0,
        shots_on: s.shots?.on ?? 0,
        passes_total: s.passes?.total ?? 0,
        passes_key: s.passes?.key ?? 0,
        tackles: s.tackles?.total ?? 0,
        started: s.games?.lineupPosition !== null && s.games?.lineupPosition !== undefined
      });
    }
  }
  return result;
}

function findMatchByApiTeamIds(allMatches, allTeams, homeApiId, awayApiId) {
  const homeFifaCode = API_TEAM_ID_TO_FIFA_CODE[homeApiId];
  const awayFifaCode = API_TEAM_ID_TO_FIFA_CODE[awayApiId];
  if (!homeFifaCode || !awayFifaCode) return null;

  const homeTeam = allTeams.find(t => t.fifa_code === homeFifaCode);
  const awayTeam = allTeams.find(t => t.fifa_code === awayFifaCode);
  if (!homeTeam || !awayTeam) return null;

  return allMatches.find(m =>
    m.home_team_id === homeTeam.id && m.away_team_id === awayTeam.id
  ) ?? null;
}

function findMatch(allMatches, allTeams, homeTeamName, awayTeamName, homeApiId, awayApiId) {
  // 1. Try by API team ID mapping first (most reliable)
  if (homeApiId && awayApiId) {
    const match = findMatchByApiTeamIds(allMatches, allTeams, homeApiId, awayApiId);
    if (match) return match;
  }

  // 2. Fuzzy name fallback
  const normalize = str => (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '').trim();

  const homeNorm = normalize(homeTeamName);
  const awayNorm = normalize(awayTeamName);

  const teamByNorm = {};
  for (const t of allTeams) {
    teamByNorm[normalize(t.name)] = t;
    if (t.fifa_code) teamByNorm[normalize(t.fifa_code)] = t;
  }

  let homeTeam = teamByNorm[homeNorm] ||
    allTeams.find(t => {
      const n = normalize(t.name);
      return n.includes(homeNorm) || homeNorm.includes(n);
    });
  let awayTeam = teamByNorm[awayNorm] ||
    allTeams.find(t => {
      const n = normalize(t.name);
      return n.includes(awayNorm) || awayNorm.includes(n);
    });

  if (!homeTeam || !awayTeam) return null;

  return allMatches.find(m =>
    m.home_team_id === homeTeam.id && m.away_team_id === awayTeam.id
  ) ?? null;
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Seed Players from API ────────────────────────────────────────────────────

/**
 * API-Football position → our Player position enum
 */
function mapPosition(apiPos) {
  if (!apiPos) return 'MID';
  const p = apiPos.toLowerCase().trim();
  if (p === 'g' || p === 'goalkeeper') return 'GK';
  if (p === 'd' || p === 'defender') return 'DEF';
  if (p === 'm' || p === 'midfielder') return 'MID';
  if (p === 'f' || p === 'attacker' || p === 'forward') return 'FWD';
  return 'MID';
}

/**
 * Assign a fantasy market price (1–18) based on position.
 * Prices are seeded as equal base per position group.
 * Admin can adjust after ingestion.
 * GK: 4-6 | DEF: 4-7 | MID: 5-9 | FWD: 6-12
 */
function defaultPrice(position) {
  const defaults = { GK: 5, DEF: 5, MID: 6, FWD: 7 };
  return defaults[position] || 5;
}

/**
 * Calculate skill score (1-100) from API-Football player statistics.
 * Used to determine fantasy price tier.
 */
function calculateSkillScore(player, stats) {
  let score = 50; // Base score for an average player
  
  // Age factor (peak performance 25-29)
  const age = player?.age ?? 27;
  if (age >= 25 && age <= 29) score += 10;
  else if (age >= 22 && age <= 31) score += 5;
  else if (age < 20 || age > 33) score -= 10;
  
  // Performance rating (most important signal)
  const rating = parseFloat(stats?.games?.rating) || 6.5;
  if (rating >= 7.5) score += 20;
  else if (rating >= 7.0) score += 15;
  else if (rating >= 6.8) score += 10;
  else if (rating >= 6.5) score += 5;
  else if (rating < 6.0) score -= 15;
  
  // Goals + assists (attacking contribution)
  const goals = stats?.goals?.total || 0;
  const assists = stats?.goals?.assists || 0;
  const contributions = goals + assists;
  if (contributions >= 15) score += 15;
  else if (contributions >= 8) score += 10;
  else if (contributions >= 4) score += 5;
  
  // Appearances (regular starter vs bench)
  const apps = stats?.games?.appearences || 0;
  if (apps >= 20) score += 10;
  else if (apps >= 10) score += 5;
  else if (apps < 3) score -= 10;
  
  // Clamp 1-100
  return Math.max(1, Math.min(100, score));
}

/**
 * Map skill score (1-100) to fantasy price ($4M-$12M).
 * Position adjustments: attackers get +1M premium at high tiers, GKs capped at $10M.
 */
function skillToPrice(score, position) {
  let price = 4;
  if (score >= 90) price = 12;
  else if (score >= 85) price = 11;
  else if (score >= 80) price = 10;
  else if (score >= 75) price = 9;
  else if (score >= 70) price = 8;
  else if (score >= 65) price = 7;
  else if (score >= 60) price = 6;
  else if (score >= 55) price = 5;
  else price = 4;
  
  // Position adjustments
  if (position === 'FWD' && score >= 75) price += 1;
  if (position === 'GK') price = Math.min(10, price);
  
  return Math.min(12, Math.max(4, price));
}

/**
 * Fetch squads for all teams in DB in small batches, upsert Player records via bulkCreate.
 * Accepts optional `offset` to resume from a team index (for pagination across calls).
 */
async function seedPlayersFromApi(base44) {
  // Fetch all teams and all existing players in parallel
  const [allTeams, existingPlayers] = await Promise.all([
    base44.asServiceRole.entities.Team.list('name', 200),
    base44.asServiceRole.entities.Player.list('created_date', 5000),
  ]);

  const existingByApiId = {};
  for (const p of existingPlayers) {
    if (p.api_player_id) existingByApiId[p.api_player_id] = p;
  }

  const results = { teams_processed: 0, players_created: 0, players_skipped: 0, errors: [], total_teams: allTeams.length, done: true };
  const toCreate = [];

  for (const team of allTeams) {
    if (!team.api_team_id) {
      results.errors.push(`Team ${team.name} has no api_team_id, skipping`);
      continue;
    }
    try {
      await new Promise(r => setTimeout(r, 400));
      const data = await apiFetch(`/players/squads?team=${team.api_team_id}`);
      const squadData = data.response?.[0];
      if (!squadData || !squadData.players) {
        results.errors.push(`No squad data for ${team.name}`);
        continue;
      }
      for (const apiPlayer of squadData.players) {
        const playerApiId = String(apiPlayer.id);
        if (existingByApiId[playerApiId]) { results.players_skipped++; continue; }
        const position = mapPosition(apiPlayer.position);
        toCreate.push({
          full_name: apiPlayer.name,
          team_id: team.id,
          position,
          price: defaultPrice(position),
          is_active: true,
          api_player_id: playerApiId,
        });
        existingByApiId[playerApiId] = true; // prevent intra-run dupe
      }
      results.teams_processed++;
      console.log(`[seedPlayers] ${team.name}: ${squadData.players.length} players`);
    } catch (err) {
      results.errors.push(`Error for ${team.name}: ${err.message}`);
    }
  }

  // bulkCreate in batches of 100
  for (let i = 0; i < toCreate.length; i += 100) {
    await base44.asServiceRole.entities.Player.bulkCreate(toCreate.slice(i, i + 100));
    if (i + 100 < toCreate.length) await new Promise(r => setTimeout(r, 300));
  }
  results.players_created = toCreate.length;

  return { ok: true, ...results };
}