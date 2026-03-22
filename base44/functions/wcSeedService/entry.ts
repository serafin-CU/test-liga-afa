import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Groups: teams ordered as [T1(pot1), T2(pot2), T3(pot3), T4(pot4)]
// Pairings: MD1: T1vT3, T2vT4 | MD2: T1vT4, T3vT2 | MD3: T1vT2, T3vT4
const GROUPS = [
    { name: 'A', teams: [{ name: 'Mexico', code: 'MEX', qualified: true }, { name: 'South Africa', code: 'RSA', qualified: true }, { name: 'South Korea', code: 'KOR', qualified: true }, { name: 'TBD Playoff D', code: 'PLD', qualified: false }] },
    { name: 'B', teams: [{ name: 'Canada', code: 'CAN', qualified: true }, { name: 'TBD Playoff A', code: 'PLA', qualified: false }, { name: 'Qatar', code: 'QAT', qualified: true }, { name: 'Switzerland', code: 'SUI', qualified: true }] },
    { name: 'C', teams: [{ name: 'Brazil', code: 'BRA', qualified: true }, { name: 'Morocco', code: 'MAR', qualified: true }, { name: 'Haiti', code: 'HAI', qualified: true }, { name: 'Scotland', code: 'SCO', qualified: true }] },
    { name: 'D', teams: [{ name: 'United States', code: 'USA', qualified: true }, { name: 'Paraguay', code: 'PAR', qualified: true }, { name: 'Australia', code: 'AUS', qualified: true }, { name: 'TBD Playoff C', code: 'PLC', qualified: false }] },
    { name: 'E', teams: [{ name: 'Germany', code: 'GER', qualified: true }, { name: 'Curaçao', code: 'CUW', qualified: true }, { name: 'Ivory Coast', code: 'CIV', qualified: true }, { name: 'Ecuador', code: 'ECU', qualified: true }] },
    { name: 'F', teams: [{ name: 'Netherlands', code: 'NED', qualified: true }, { name: 'Japan', code: 'JPN', qualified: true }, { name: 'TBD Playoff B', code: 'PLB', qualified: false }, { name: 'Tunisia', code: 'TUN', qualified: true }] },
    { name: 'G', teams: [{ name: 'Belgium', code: 'BEL', qualified: true }, { name: 'Egypt', code: 'EGY', qualified: true }, { name: 'Iran', code: 'IRN', qualified: true }, { name: 'New Zealand', code: 'NZL', qualified: true }] },
    { name: 'H', teams: [{ name: 'Spain', code: 'ESP', qualified: true }, { name: 'Cape Verde', code: 'CPV', qualified: true }, { name: 'Saudi Arabia', code: 'KSA', qualified: true }, { name: 'Uruguay', code: 'URU', qualified: true }] },
    { name: 'I', teams: [{ name: 'France', code: 'FRA', qualified: true }, { name: 'Senegal', code: 'SEN', qualified: true }, { name: 'TBD Intercontinental 2', code: 'IC2', qualified: false }, { name: 'Norway', code: 'NOR', qualified: true }] },
    { name: 'J', teams: [{ name: 'Argentina', code: 'ARG', qualified: true }, { name: 'Algeria', code: 'ALG', qualified: true }, { name: 'Austria', code: 'AUT', qualified: true }, { name: 'Jordan', code: 'JOR', qualified: true }] },
    { name: 'K', teams: [{ name: 'Portugal', code: 'POR', qualified: true }, { name: 'TBD Intercontinental 1', code: 'IC1', qualified: false }, { name: 'Uzbekistan', code: 'UZB', qualified: true }, { name: 'Colombia', code: 'COL', qualified: true }] },
    { name: 'L', teams: [{ name: 'England', code: 'ENG', qualified: true }, { name: 'Croatia', code: 'CRO', qualified: true }, { name: 'Ghana', code: 'GHA', qualified: true }, { name: 'Panama', code: 'PAN', qualified: true }] },
];

// Real MD1 fixtures: [groupCode, homeCode, awayCode, kickoff_utc]
const MD1_FIXTURES = [
    // June 11
    ['A', 'MEX', 'RSA', '2026-06-11T19:00:00Z'], // Mexico vs South Africa
    ['A', 'KOR', 'PLD', '2026-06-12T02:00:00Z'], // South Korea vs UEFA Playoff D
    // June 12
    ['B', 'CAN', 'PLA', '2026-06-12T19:00:00Z'], // Canada vs UEFA Playoff A
    ['B', 'QAT', 'SUI', '2026-06-13T01:00:00Z'], // Qatar vs Switzerland
    // June 13
    ['C', 'BRA', 'MAR', '2026-06-13T19:00:00Z'], // Brazil vs Morocco
    ['C', 'HAI', 'SCO', '2026-06-13T22:00:00Z'], // Haiti vs Scotland
    ['D', 'USA', 'PAR', '2026-06-14T01:00:00Z'], // USA vs Paraguay
    ['D', 'AUS', 'PLC', '2026-06-14T04:00:00Z'], // Australia vs UEFA Playoff C
    // June 14
    ['E', 'GER', 'CUW', '2026-06-14T17:00:00Z'], // Germany vs Curaçao
    ['F', 'NED', 'JPN', '2026-06-14T20:00:00Z'], // Netherlands vs Japan
    ['F', 'PLB', 'TUN', '2026-06-14T22:00:00Z'], // UEFA Playoff B vs Tunisia
    ['E', 'CIV', 'ECU', '2026-06-15T04:00:00Z'], // Ivory Coast vs Ecuador
    // June 15
    ['H', 'ESP', 'CPV', '2026-06-15T16:00:00Z'], // Spain vs Cape Verde
    ['G', 'BEL', 'EGY', '2026-06-15T19:00:00Z'], // Belgium vs Egypt
    ['H', 'KSA', 'URU', '2026-06-15T22:00:00Z'], // Saudi Arabia vs Uruguay
    ['G', 'IRN', 'NZL', '2026-06-16T01:00:00Z'], // Iran vs New Zealand
    // June 16
    ['I', 'FRA', 'SEN', '2026-06-16T19:00:00Z'], // France vs Senegal
    ['I', 'IC2', 'NOR', '2026-06-16T22:00:00Z'], // Intercontinental Playoff 2 vs Norway
    ['J', 'ARG', 'ALG', '2026-06-17T01:00:00Z'], // Argentina vs Algeria
    ['J', 'AUT', 'JOR', '2026-06-17T04:00:00Z'], // Austria vs Jordan
    // June 17
    ['K', 'POR', 'IC1', '2026-06-17T17:00:00Z'], // Portugal vs Intercontinental Playoff 1
    ['L', 'ENG', 'CRO', '2026-06-17T20:00:00Z'], // England vs Croatia
    ['L', 'GHA', 'PAN', '2026-06-17T23:00:00Z'], // Ghana vs Panama
    ['K', 'UZB', 'COL', '2026-06-18T02:00:00Z'], // Uzbekistan vs Colombia
];

// MD2 fixtures — June 18-23
const MD2_FIXTURES = [
    ['A', 'PLD', 'RSA', '2026-06-18T19:00:00Z'], // UEFA Playoff D vs South Africa
    ['A', 'MEX', 'KOR', '2026-06-19T02:00:00Z'], // Mexico vs South Korea
    ['B', 'SUI', 'PLA', '2026-06-19T19:00:00Z'], // Switzerland vs UEFA Playoff A
    ['B', 'CAN', 'QAT', '2026-06-20T01:00:00Z'], // Canada vs Qatar
    ['C', 'SCO', 'MAR', '2026-06-20T17:00:00Z'], // Scotland vs Morocco
    ['C', 'BRA', 'HAI', '2026-06-20T20:00:00Z'], // Brazil vs Haiti
    ['D', 'PLC', 'PAR', '2026-06-20T22:00:00Z'], // UEFA Playoff C vs Paraguay
    ['D', 'USA', 'AUS', '2026-06-21T01:00:00Z'], // USA vs Australia
    ['E', 'GER', 'CIV', '2026-06-21T17:00:00Z'], // Germany vs Ivory Coast
    ['E', 'ECU', 'CUW', '2026-06-21T20:00:00Z'], // Ecuador vs Curaçao
    ['F', 'NED', 'PLB', '2026-06-21T22:00:00Z'], // Netherlands vs UEFA Playoff B
    ['F', 'TUN', 'JPN', '2026-06-22T01:00:00Z'], // Tunisia vs Japan
    ['G', 'BEL', 'IRN', '2026-06-22T17:00:00Z'], // Belgium vs Iran
    ['G', 'NZL', 'EGY', '2026-06-22T20:00:00Z'], // New Zealand vs Egypt
    ['H', 'ESP', 'KSA', '2026-06-22T22:00:00Z'], // Spain vs Saudi Arabia
    ['H', 'URU', 'CPV', '2026-06-23T01:00:00Z'], // Uruguay vs Cape Verde
    ['I', 'FRA', 'IC2', '2026-06-23T17:00:00Z'], // France vs Intercontinental Playoff 2
    ['I', 'NOR', 'SEN', '2026-06-23T20:00:00Z'], // Norway vs Senegal
    ['J', 'ARG', 'AUT', '2026-06-23T22:00:00Z'], // Argentina vs Austria
    ['J', 'JOR', 'ALG', '2026-06-24T01:00:00Z'], // Jordan vs Algeria
    ['K', 'POR', 'UZB', '2026-06-24T17:00:00Z'], // Portugal vs Uzbekistan
    ['K', 'COL', 'IC1', '2026-06-24T20:00:00Z'], // Colombia vs Intercontinental Playoff 1
    ['L', 'ENG', 'GHA', '2026-06-24T22:00:00Z'], // England vs Ghana
    ['L', 'PAN', 'CRO', '2026-06-25T01:00:00Z'], // Panama vs Croatia
];

// MD3 fixtures — simultaneous kickoffs per group, June 25-30
const MD3_FIXTURES = [
    ['A', 'PLD', 'MEX', '2026-06-25T19:00:00Z'], // UEFA Playoff D vs Mexico
    ['A', 'KOR', 'RSA', '2026-06-25T19:00:00Z'], // South Korea vs South Africa
    ['B', 'PLA', 'QAT', '2026-06-25T23:00:00Z'], // UEFA Playoff A vs Qatar
    ['B', 'SUI', 'CAN', '2026-06-25T23:00:00Z'], // Switzerland vs Canada
    ['C', 'MAR', 'HAI', '2026-06-26T19:00:00Z'], // Morocco vs Haiti
    ['C', 'SCO', 'BRA', '2026-06-26T19:00:00Z'], // Scotland vs Brazil
    ['D', 'PLC', 'USA', '2026-06-26T23:00:00Z'], // UEFA Playoff C vs USA
    ['D', 'PAR', 'AUS', '2026-06-26T23:00:00Z'], // Paraguay vs Australia
    ['E', 'CUW', 'CIV', '2026-06-27T16:00:00Z'], // Curaçao vs Ivory Coast
    ['E', 'ECU', 'GER', '2026-06-27T16:00:00Z'], // Ecuador vs Germany
    ['F', 'TUN', 'NED', '2026-06-27T20:00:00Z'], // Tunisia vs Netherlands
    ['F', 'JPN', 'PLB', '2026-06-27T20:00:00Z'], // Japan vs UEFA Playoff B
    ['G', 'NZL', 'BEL', '2026-06-28T16:00:00Z'], // New Zealand vs Belgium
    ['G', 'EGY', 'IRN', '2026-06-28T16:00:00Z'], // Egypt vs Iran
    ['H', 'CPV', 'KSA', '2026-06-28T20:00:00Z'], // Cape Verde vs Saudi Arabia
    ['H', 'URU', 'ESP', '2026-06-28T20:00:00Z'], // Uruguay vs Spain
    ['I', 'NOR', 'FRA', '2026-06-29T16:00:00Z'], // Norway vs France
    ['I', 'SEN', 'IC2', '2026-06-29T16:00:00Z'], // Senegal vs Intercontinental Playoff 2
    ['J', 'JOR', 'ARG', '2026-06-29T20:00:00Z'], // Jordan vs Argentina
    ['J', 'ALG', 'AUT', '2026-06-29T20:00:00Z'], // Algeria vs Austria
    ['K', 'IC1', 'UZB', '2026-06-30T16:00:00Z'], // Intercontinental Playoff 1 vs Uzbekistan
    ['K', 'COL', 'POR', '2026-06-30T16:00:00Z'], // Colombia vs Portugal
    ['L', 'PAN', 'ENG', '2026-06-30T20:00:00Z'], // Panama vs England
    ['L', 'CRO', 'GHA', '2026-06-30T20:00:00Z'], // Croatia vs Ghana
];

const POSITION_PRICES = {
    GK: [5, 6],
    DEF: [6, 7, 8],
    MID: [7, 8, 9],
    FWD: [8, 10, 12],
};

function randomPrice(position) {
    const opts = POSITION_PRICES[position];
    return opts[Math.floor(Math.random() * opts.length)];
}

function buildPlayersForTeam(teamId, teamCode) {
    const players = [];
    const positions = [
        { pos: 'GK', count: 2 },
        { pos: 'DEF', count: 4 },
        { pos: 'MID', count: 4 },
        { pos: 'FWD', count: 4 },
    ];
    for (const { pos, count } of positions) {
        for (let i = 1; i <= count; i++) {
            players.push({
                full_name: `${teamCode} ${pos} ${i}`,
                team_id: teamId,
                position: pos,
                price: randomPrice(pos),
                is_active: true,
            });
        }
    }
    return players;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();

        if (!['seed_wc2026', 'reseed_matches', 'reset_test_data', 'purge_stale_ledger'].includes(body.action)) {
            return Response.json({ error: 'Invalid action. Use seed_wc2026, reseed_matches, reset_test_data, or purge_stale_ledger' }, { status: 400 });
        }

        // ── purge_stale_ledger: delete all PointsLedger entries except those created in the last 30 minutes ──
        if (body.action === 'purge_stale_ledger') {
            console.log('Purging stale PointsLedger entries...');
            const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const allEntries = await base44.asServiceRole.entities.PointsLedger.list();
            const toDelete = allEntries.filter(e => e.created_date < cutoff);

            for (let i = 0; i < toDelete.length; i += 20) {
                const chunk = toDelete.slice(i, i + 20);
                await Promise.all(chunk.map(e => base44.asServiceRole.entities.PointsLedger.delete(e.id)));
                if (i + 20 < toDelete.length) await new Promise(r => setTimeout(r, 300));
            }

            console.log(`Purged ${toDelete.length} stale ledger entries, kept ${allEntries.length - toDelete.length} recent ones.`);
            return Response.json({
                success: true,
                message: `Purged ${toDelete.length} stale PointsLedger entries (kept ${allEntries.length - toDelete.length} from last 30 min)`,
                deleted: toDelete.length,
                kept: allEntries.length - toDelete.length,
            });
        }

        // ── reset_test_data: wipe scores/squads/badges, reset match statuses ──
        if (body.action === 'reset_test_data') {
            console.log('Resetting test data...');

            async function deleteAll(entity) {
                const items = await entity.list();
                for (let i = 0; i < items.length; i += 20) {
                    const chunk = items.slice(i, i + 20);
                    await Promise.all(chunk.map(x => entity.delete(x.id)));
                    if (i + 20 < items.length) await new Promise(r => setTimeout(r, 300));
                }
                return items.length;
            }

            const [
                pointsDeleted,
                badgesDeleted,
                scoringJobsDeleted,
                matchResultsDeleted,
                playerStatsDeleted,
                matchValidationsDeleted,
                squadPlayersDeleted,
                squadsDeleted,
            ] = await Promise.all([
                deleteAll(base44.asServiceRole.entities.PointsLedger),
                deleteAll(base44.asServiceRole.entities.BadgeAward),
                deleteAll(base44.asServiceRole.entities.ScoringJob),
                deleteAll(base44.asServiceRole.entities.MatchResultFinal),
                deleteAll(base44.asServiceRole.entities.FantasyMatchPlayerStats),
                deleteAll(base44.asServiceRole.entities.MatchValidation),
                deleteAll(base44.asServiceRole.entities.FantasySquadPlayer),
                deleteAll(base44.asServiceRole.entities.FantasySquad),
            ]);

            // Reset all match statuses to SCHEDULED
            const allMatches = await base44.asServiceRole.entities.Match.list();
            for (let i = 0; i < allMatches.length; i += 20) {
                const chunk = allMatches.slice(i, i + 20);
                await Promise.all(chunk.map(m => base44.asServiceRole.entities.Match.update(m.id, { status: 'SCHEDULED' })));
                if (i + 20 < allMatches.length) await new Promise(r => setTimeout(r, 300));
            }

            console.log('Reset complete.');

            return Response.json({
                success: true,
                message: 'Test data reset successfully',
                summary: {
                    points_ledger_deleted: pointsDeleted,
                    badges_deleted: badgesDeleted,
                    scoring_jobs_deleted: scoringJobsDeleted,
                    match_results_deleted: matchResultsDeleted,
                    player_stats_deleted: playerStatsDeleted,
                    match_validations_deleted: matchValidationsDeleted,
                    squad_players_deleted: squadPlayersDeleted,
                    squads_deleted: squadsDeleted,
                    matches_reset_to_scheduled: allMatches.length,
                },
            });
        }

        const reseedMatchesOnly = body.action === 'reseed_matches';

        // ── 1. Fetch existing data ──
        console.log('Fetching existing data...');
        const fetchTargets = reseedMatchesOnly
            ? [base44.asServiceRole.entities.Match.list(), Promise.resolve([]), Promise.resolve([])]
            : [
                base44.asServiceRole.entities.Match.list(),
                base44.asServiceRole.entities.Player.list(),
                base44.asServiceRole.entities.Team.list(),
              ];
        const [existingMatches, existingPlayers, existingTeams] = await Promise.all(fetchTargets);

        console.log(`Deleting ${existingMatches.length} matches, ${existingPlayers.length} players, ${existingTeams.length} teams...`);

        async function deleteInChunks(entity, items, chunkSize = 10, delayMs = 500) {
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                await Promise.all(chunk.map(x => entity.delete(x.id)));
                if (i + chunkSize < items.length) await new Promise(r => setTimeout(r, delayMs));
            }
        }

        await deleteInChunks(base44.asServiceRole.entities.Match, existingMatches);
        if (!reseedMatchesOnly) {
            await deleteInChunks(base44.asServiceRole.entities.Player, existingPlayers);
            await deleteInChunks(base44.asServiceRole.entities.Team, existingTeams);
        }

        let teams_created = 0;
        let players_created = 0;
        let matches_created = 0;
        const teamMap = {};

        if (reseedMatchesOnly) {
            // Load existing teams into map
            const allTeams = await base44.asServiceRole.entities.Team.list();
            for (const t of allTeams) teamMap[t.fifa_code] = t;
            console.log(`Loaded ${allTeams.length} existing teams for match seeding`);
        } else {
            // ── 2. Create teams ──
            console.log('Creating teams...');
            const allTeamData = GROUPS.flatMap(g => g.teams.map(t => ({
                name: t.name,
                fifa_code: t.code,
                is_qualified: t.qualified,
            })));
            const createdTeams = await base44.asServiceRole.entities.Team.bulkCreate(allTeamData);
            teams_created = createdTeams.length;
            for (const t of createdTeams) teamMap[t.fifa_code] = t;

            // ── 3. Bulk create 14 players per team ──
            const allPlayerData = [];
            for (const group of GROUPS) {
                for (const t of group.teams) {
                    allPlayerData.push(...buildPlayersForTeam(teamMap[t.code].id, t.code));
                }
            }
            for (let i = 0; i < allPlayerData.length; i += 100) {
                const chunk = allPlayerData.slice(i, i + 100);
                const created = await base44.asServiceRole.entities.Player.bulkCreate(chunk);
                players_created += created.length;
            }
        }

        // ── 4. Create group stage matches from real fixtures ──
        console.log('Creating matches...');

        function buildMatchesFromFixtures(fixtureList, phase) {
            return fixtureList.map(([groupName, homeCode, awayCode, kickoff_utc]) => ({
                phase,
                kickoff_at: kickoff_utc,
                home_team_id: teamMap[homeCode].id,
                away_team_id: teamMap[awayCode].id,
                status: 'SCHEDULED',
                venue: `Group ${groupName} - ${phase}`,
            }));
        }

        const allMatchData = [
            ...buildMatchesFromFixtures(MD1_FIXTURES, 'GROUP_MD1'),
            ...buildMatchesFromFixtures(MD2_FIXTURES, 'GROUP_MD2'),
            ...buildMatchesFromFixtures(MD3_FIXTURES, 'GROUP_MD3'),
        ];

        const createdMatches = await base44.asServiceRole.entities.Match.bulkCreate(allMatchData);
        matches_created = createdMatches.length;

        // ── 5. Update AppConfig ──
        console.log('Updating AppConfig...');
        const configs = await base44.asServiceRole.entities.AppConfig.list();
        const configData = {
            tournament_start_at: '2026-06-11T13:00:00Z',
            tournament_phase: 'PRE_TOURNAMENT',
            transfer_window_state: 'OPEN',
            squad_lock_at: '2026-06-10T22:00:00Z',
        };
        if (configs.length > 0) {
            await base44.asServiceRole.entities.AppConfig.update(configs[0].id, configData);
        } else {
            await base44.asServiceRole.entities.AppConfig.create(configData);
        }

        console.log(`Done: ${teams_created} teams, ${players_created} players, ${matches_created} matches`);

        return Response.json({
            success: true,
            message: 'WC 2026 data seeded successfully',
            summary: { teams_created, players_created, matches_created },
        });

    } catch (error) {
        console.error('wcSeedService error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});