import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * rebuildFromApi - Complete data rebuild from API-Football
 * Admin only. Fetches all 16 rounds of AFA Apertura 2025, rebuilds:
 * - Teams (30 real teams from API)
 * - Matches (240 real fixtures with real dates)
 * - MatchResultFinal (for all finished matches)
 * Clears all old match/team/player stats data.
 * Preserves: FantasySquad, FantasySquadPlayer, ProdePrediction, User, PointsLedger, BadgeAward
 */

const LEAGUE_ID = 128;
const SEASON = 2026;
const ROUND_FORMAT = 'Regular%20Season'; // 2026 uses "Regular Season - N" format
const TOTAL_ROUNDS = 27; // AFA Liga Profesional full season rounds

// API-Football team ID -> short code mapping (verified from live API preview - 2026 season)
const API_TEAM_MAP = {
  451: { name: 'Boca Juniors',              fifa_code: 'BOC' },
  453: { name: 'Independiente',             fifa_code: 'IND' },
  460: { name: 'San Lorenzo',               fifa_code: 'SLO' },
  438: { name: 'Velez Sarsfield',           fifa_code: 'VEL' },
  476: { name: 'Deportivo Riestra',         fifa_code: 'RIE' },
  456: { name: 'Talleres Cordoba',          fifa_code: 'TAL' },
  478: { name: 'Instituto Cordoba',         fifa_code: 'INS' },
  1064: { name: 'Platense',                 fifa_code: 'PLA' },
  450: { name: 'Estudiantes LP',            fifa_code: 'EDL' },
  434: { name: 'Gimnasia LP',               fifa_code: 'GLP' },
  446: { name: 'Lanus',                     fifa_code: 'LAN' },
  457: { name: 'Newells Old Boys',          fifa_code: 'NEW' },
  442: { name: 'Defensa Y Justicia',        fifa_code: 'DYJ' },
  1065: { name: 'Central Cordoba SdE',      fifa_code: 'CCO' },
  441: { name: 'Union Santa Fe',            fifa_code: 'UNI' },
  435: { name: 'River Plate',               fifa_code: 'RIV' },
  436: { name: 'Racing Club',               fifa_code: 'RAC' },
  445: { name: 'Huracan',                   fifa_code: 'HUR' },
  2432: { name: 'Barracas Central',         fifa_code: 'BAR' },
  440: { name: 'Belgrano Cordoba',          fifa_code: 'BEL' },
  461: { name: 'San Martin SJ',             fifa_code: 'SMJ' },
  458: { name: 'Argentinos Juniors',        fifa_code: 'ARG' },
  452: { name: 'Tigre',                     fifa_code: 'TIG' },
  439: { name: 'Godoy Cruz',                fifa_code: 'GCR' },
  473: { name: 'Independ. Rivadavia',       fifa_code: 'IRV' },
  437: { name: 'Rosario Central',           fifa_code: 'ROS' },
  449: { name: 'Banfield',                  fifa_code: 'BAN' },
  463: { name: 'Aldosivi',                  fifa_code: 'ALD' },
  455: { name: 'Atletico Tucuman',          fifa_code: 'ATU' },
  474: { name: 'Sarmiento Junin',           fifa_code: 'SAR' },
  // 2026 new teams
  1066: { name: 'Gimnasia Mendoza',         fifa_code: 'GIM' },
  2424: { name: 'Estudiantes RC',           fifa_code: 'ERC' },
};

async function fetchFromApi(url) {
  const apiKey = Deno.env.get('API_FUTBOL');
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  });
  return res.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchRound(round) {
  const url = `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=${ROUND_FORMAT}%20-%20${round}`;
  const data = await fetchFromApi(url);
  return data.response || [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full_rebuild';

    if (action === 'full_rebuild') {
      const result = await fullRebuild(base44);
      return Response.json(result);
    }

    if (action === 'preview') {
      // Fetch round 1 and available rounds
      const [fixtures, roundsData] = await Promise.all([
        fetchRound(1),
        fetchFromApi(`https://v3.football.api-sports.io/leagues/rounds?league=${LEAGUE_ID}&season=${SEASON}`)
      ]);
      const teams = {};
      fixtures.forEach(f => {
        teams[f.teams.home.id] = f.teams.home.name;
        teams[f.teams.away.id] = f.teams.away.name;
      });
      return Response.json({ season: SEASON, round_1_fixtures: fixtures.length, available_rounds: roundsData.response || [], teams });
    }

    return Response.json({ error: 'Unknown action. Use: full_rebuild, preview' }, { status: 400 });

  } catch (err) {
    console.error('[rebuildFromApi] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function fullRebuild(base44) {
  const log = [];

  // ─── STEP 1: Fetch all fixtures from API ───────────────────────────────────
  log.push('Fetching all rounds from API-Football...');
  const allFixtures = [];
  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const fixtures = await fetchRound(round);
    if (fixtures.length === 0) {
      log.push(`Round ${round} returned 0 fixtures — stopping fetch at round ${round - 1}`);
      break;
    }
    allFixtures.push(...fixtures.map(f => ({ ...f, _round: round })));
    console.log(`[rebuildFromApi] Round ${round}: ${fixtures.length} fixtures`);
    await sleep(200); // small delay between API calls
  }
  log.push(`Fetched ${allFixtures.length} total fixtures`);

  // ─── STEP 2: Extract unique teams from fixtures ─────────────────────────────
  const apiTeams = {}; // id -> { id, name, logo }
  for (const f of allFixtures) {
    if (!apiTeams[f.teams.home.id]) apiTeams[f.teams.home.id] = f.teams.home;
    if (!apiTeams[f.teams.away.id]) apiTeams[f.teams.away.id] = f.teams.away;
  }
  const uniqueTeams = Object.values(apiTeams);
  log.push(`Found ${uniqueTeams.length} unique teams`);

  // ─── STEP 3: Clear old data (preserve FantasySquad, FantasySquadPlayer, ProdePrediction, PointsLedger, BadgeAward) ───
  log.push('Clearing old match/team/result data...');
  
  // Get all old matches so we can clear related data
  const [oldMatches, oldResults, oldValidations, oldIngEvents, oldIngRuns, oldStats, oldJobs] = await Promise.all([
    base44.asServiceRole.entities.Match.filter({}, 'kickoff_at', 1000),
    base44.asServiceRole.entities.MatchResultFinal.filter({}, 'finalized_at', 1000),
    base44.asServiceRole.entities.MatchValidation.filter({}, 'created_date', 500),
    base44.asServiceRole.entities.IngestionEvent.filter({}, 'fetched_at', 500),
    base44.asServiceRole.entities.IngestionRun.filter({}, 'started_at', 200),
    base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({}, 'created_date', 2000),
    base44.asServiceRole.entities.ScoringJob.filter({}, 'created_date', 1000),
  ]);

  // Delete using bulkDelete (sequential batches of 50 to avoid rate limits)
  const deleteInBatches = async (items, entity, label) => {
    let deleted = 0;
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50);
      await Promise.all(batch.map(item => entity.delete(item.id).catch(() => {})));
      deleted += batch.length;
      if (i + 50 < items.length) await sleep(500);
    }
    log.push(`Deleted ${deleted} ${label}`);
  };

  await deleteInBatches(oldResults, base44.asServiceRole.entities.MatchResultFinal, 'MatchResultFinals');
  await deleteInBatches(oldValidations, base44.asServiceRole.entities.MatchValidation, 'MatchValidations');
  await deleteInBatches(oldIngEvents, base44.asServiceRole.entities.IngestionEvent, 'IngestionEvents');
  await deleteInBatches(oldIngRuns, base44.asServiceRole.entities.IngestionRun, 'IngestionRuns');
  await deleteInBatches(oldStats, base44.asServiceRole.entities.FantasyMatchPlayerStats, 'FantasyMatchPlayerStats');
  await deleteInBatches(oldJobs, base44.asServiceRole.entities.ScoringJob, 'ScoringJobs');
  await deleteInBatches(oldMatches, base44.asServiceRole.entities.Match, 'Matches');

  const oldTeams = await base44.asServiceRole.entities.Team.filter({}, 'name', 200);
  await deleteInBatches(oldTeams, base44.asServiceRole.entities.Team, 'Teams');

  const oldPlayers = await base44.asServiceRole.entities.Player.filter({}, 'created_date', 2000);
  await deleteInBatches(oldPlayers, base44.asServiceRole.entities.Player, 'Players');

  // ─── STEP 4: Create new teams (bulkCreate) ───────────────────────────────────
  log.push('Creating new teams...');
  const teamDataList = uniqueTeams.map(apiTeam => {
    const mapped = API_TEAM_MAP[apiTeam.id];
    return {
      name: apiTeam.name,
      fifa_code: mapped ? mapped.fifa_code : apiTeam.name.substring(0, 3).toUpperCase(),
      is_qualified: true,
      api_team_id: String(apiTeam.id),
      logo_url: apiTeam.logo || null,
    };
  });
  const createdTeams = await base44.asServiceRole.entities.Team.bulkCreate(teamDataList);
  const teamIdMap = {}; // apiTeamId -> our DB team id
  createdTeams.forEach((ct, idx) => {
    teamIdMap[uniqueTeams[idx].id] = ct.id;
  });
  log.push(`Created ${createdTeams.length} teams`);

  // ─── STEP 5: Create new matches (bulkCreate in batches of 50) ───────────────
  log.push('Creating new matches...');
  const matchesToCreate = [];
  const finishedFixtures = []; // track which fixtures are finished, to create results after

  for (const f of allFixtures) {
    const homeTeamId = teamIdMap[f.teams.home.id];
    const awayTeamId = teamIdMap[f.teams.away.id];
    if (!homeTeamId || !awayTeamId) {
      log.push(`WARN: Missing team mapping for fixture ${f.fixture.id} (${f.teams.home.name} vs ${f.teams.away.name})`);
      continue;
    }
    const apiStatus = f.fixture.status.short;
    const isFinal = ['FT', 'AET', 'PEN'].includes(apiStatus);
    const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'INT'].includes(apiStatus);
    matchesToCreate.push({
      _fixtureId: f.fixture.id,
      _isFinal: isFinal,
      _homeGoals: f.goals.home,
      _awayGoals: f.goals.away,
      _date: f.fixture.date,
      phase: 'APERTURA_ZONE',
      kickoff_at: f.fixture.date,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      status: isFinal ? 'FINAL' : isLive ? 'LIVE' : 'SCHEDULED',
      venue: `Fecha ${f._round}`,
      api_fixture_id: String(f.fixture.id),
    });
  }

  // bulkCreate in chunks of 50
  const createdMatches = [];
  for (let i = 0; i < matchesToCreate.length; i += 50) {
    const batch = matchesToCreate.slice(i, i + 50);
    const dbData = batch.map(m => ({
      phase: m.phase, kickoff_at: m.kickoff_at, home_team_id: m.home_team_id,
      away_team_id: m.away_team_id, status: m.status, venue: m.venue, api_fixture_id: m.api_fixture_id
    }));
    const created = await base44.asServiceRole.entities.Match.bulkCreate(dbData);
    created.forEach((c, idx) => createdMatches.push({ ...batch[idx], dbId: c.id }));
    if (i + 50 < matchesToCreate.length) await sleep(300);
  }
  log.push(`Created ${createdMatches.length} matches`);

  // ─── STEP 6: Create MatchResultFinals (bulkCreate) ───────────────────────────
  log.push('Creating match results...');
  const fixtureResultsToCreate = createdMatches
    .filter(m => m._isFinal && m._homeGoals !== null && m._awayGoals !== null)
    .map(m => ({
      match_id: m.dbId,
      home_goals: m._homeGoals,
      away_goals: m._awayGoals,
      finalized_at: new Date(m._date).toISOString(),
    }));

  for (let i = 0; i < fixtureResultsToCreate.length; i += 50) {
    const batch = fixtureResultsToCreate.slice(i, i + 50);
    await base44.asServiceRole.entities.MatchResultFinal.bulkCreate(batch);
    if (i + 50 < fixtureResultsToCreate.length) await sleep(300);
  }
  log.push(`Created ${fixtureResultsToCreate.length} MatchResultFinals`);

  // ─── DONE ────────────────────────────────────────────────────────────────────
  return {
    success: true,
    log,
    summary: {
      fixtures_fetched: allFixtures.length,
      teams_created: Object.keys(teamIdMap).length,
      matches_created: createdMatches.length,
      results_created: fixtureResultsToCreate.length,
    }
  };
}