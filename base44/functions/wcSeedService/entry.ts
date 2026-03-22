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
// MD1: T1vT3 and T2vT4 per group — times derived from official ET schedule
const MD1_FIXTURES = [
    // June 11
    ['A', 'MEX', 'KOR', '2026-06-11T19:00:00Z'], // Mexico vs South Korea (MD1: T1vT3)
    ['A', 'RSA', 'PLD', '2026-06-12T02:00:00Z'], // South Africa vs Playoff D (T2vT4)
    // June 12
    ['B', 'CAN', 'QAT', '2026-06-12T19:00:00Z'], // Canada vs Qatar (T1vT3)
    ['B', 'PLA', 'SUI', '2026-06-13T01:00:00Z'], // Playoff A vs Switzerland (T2vT4)
    // June 13
    ['C', 'BRA', 'HAI', '2026-06-13T19:00:00Z'], // Brazil vs Haiti (T1vT3)
    ['C', 'MAR', 'SCO', '2026-06-13T22:00:00Z'], // Morocco vs Scotland (T2vT4)
    ['D', 'USA', 'AUS', '2026-06-14T01:00:00Z'], // USA vs Australia (T1vT3)
    ['D', 'PAR', 'PLC', '2026-06-14T04:00:00Z'], // Paraguay vs Playoff C (T2vT4)
    // June 14
    ['E', 'GER', 'CIV', '2026-06-14T17:00:00Z'], // Germany vs Ivory Coast (T1vT3)
    ['E', 'CUW', 'ECU', '2026-06-14T20:00:00Z'], // Curaçao vs Ecuador (T2vT4)
    ['F', 'NED', 'PLB', '2026-06-14T22:00:00Z'], // Netherlands vs Playoff B (T1vT3)
    ['F', 'JPN', 'TUN', '2026-06-15T04:00:00Z'], // Japan vs Tunisia (T2vT4)
    // June 15
    ['H', 'ESP', 'KSA', '2026-06-15T16:00:00Z'], // Spain vs Saudi Arabia (T1vT3)
    ['G', 'BEL', 'EGY', '2026-06-15T19:00:00Z'], // Belgium vs Egypt (T1vT3) — note: user listed BEL vs EGY as T1vT2
    ['H', 'CPV', 'URU', '2026-06-15T22:00:00Z'], // Cape Verde vs Uruguay (T2vT4)
    ['G', 'IRN', 'NZL', '2026-06-16T01:00:00Z'], // Iran vs New Zealand (T3vT4)
    // June 16
    ['I', 'FRA', 'SEN', '2026-06-16T19:00:00Z'], // France vs Senegal (T1vT2) — official fixture
    ['I', 'IC2', 'NOR', '2026-06-16T22:00:00Z'], // Intercontinental 2 vs Norway (T3vT4)
    ['J', 'ARG', 'AUT', '2026-06-17T01:00:00Z'], // Argentina vs Austria (T1vT3)
    ['J', 'ALG', 'JOR', '2026-06-17T04:00:00Z'], // Algeria vs Jordan (T2vT4)
    // June 17
    ['K', 'POR', 'UZB', '2026-06-17T17:00:00Z'], // Portugal vs Uzbekistan (T1vT3)
    ['L', 'ENG', 'GHA', '2026-06-17T20:00:00Z'], // England vs Ghana (T1vT3)
    ['L', 'CRO', 'PAN', '2026-06-17T23:00:00Z'], // Croatia vs Panama (T2vT4)
    ['K', 'IC1', 'COL', '2026-06-18T02:00:00Z'], // Intercontinental 1 vs Colombia (T2vT4)
];

// MD2 fixtures: T1vT4, T3vT2 — spaced June 18-23
const MD2_FIXTURES = [
    ['A', 'MEX', 'PLD', '2026-06-18T19:00:00Z'],
    ['A', 'KOR', 'RSA', '2026-06-19T02:00:00Z'],
    ['B', 'CAN', 'SUI', '2026-06-19T19:00:00Z'],
    ['B', 'QAT', 'PLA', '2026-06-20T01:00:00Z'],
    ['C', 'BRA', 'SCO', '2026-06-20T17:00:00Z'],
    ['C', 'HAI', 'MAR', '2026-06-20T20:00:00Z'],
    ['D', 'USA', 'PLC', '2026-06-20T22:00:00Z'],
    ['D', 'AUS', 'PAR', '2026-06-21T01:00:00Z'],
    ['E', 'GER', 'ECU', '2026-06-21T17:00:00Z'],
    ['E', 'CIV', 'CUW', '2026-06-21T20:00:00Z'],
    ['F', 'NED', 'TUN', '2026-06-21T22:00:00Z'],
    ['F', 'PLB', 'JPN', '2026-06-22T01:00:00Z'],
    ['G', 'BEL', 'IRN', '2026-06-22T17:00:00Z'],
    ['G', 'EGY', 'NZL', '2026-06-22T20:00:00Z'],
    ['H', 'ESP', 'URU', '2026-06-22T22:00:00Z'],
    ['H', 'KSA', 'CPV', '2026-06-23T01:00:00Z'],
    ['I', 'FRA', 'IC2', '2026-06-23T17:00:00Z'],
    ['I', 'SEN', 'NOR', '2026-06-23T20:00:00Z'],
    ['J', 'ARG', 'JOR', '2026-06-23T22:00:00Z'],
    ['J', 'AUT', 'ALG', '2026-06-24T01:00:00Z'],
    ['K', 'POR', 'COL', '2026-06-24T17:00:00Z'],
    ['K', 'UZB', 'IC1', '2026-06-24T20:00:00Z'],
    ['L', 'ENG', 'PAN', '2026-06-24T22:00:00Z'],
    ['L', 'GHA', 'CRO', '2026-06-25T01:00:00Z'],
];

// MD3 fixtures: T1vT2, T3vT4 — simultaneous kickoffs per group, June 25-27
const MD3_FIXTURES = [
    ['A', 'MEX', 'RSA', '2026-06-25T19:00:00Z'],
    ['A', 'KOR', 'PLD', '2026-06-25T19:00:00Z'],
    ['B', 'CAN', 'PLA', '2026-06-25T23:00:00Z'],
    ['B', 'QAT', 'SUI', '2026-06-25T23:00:00Z'],
    ['C', 'BRA', 'MAR', '2026-06-26T19:00:00Z'],
    ['C', 'HAI', 'SCO', '2026-06-26T19:00:00Z'],
    ['D', 'USA', 'PAR', '2026-06-26T23:00:00Z'],
    ['D', 'AUS', 'PLC', '2026-06-26T23:00:00Z'],
    ['E', 'GER', 'CUW', '2026-06-27T16:00:00Z'],
    ['E', 'CIV', 'ECU', '2026-06-27T16:00:00Z'],
    ['F', 'NED', 'JPN', '2026-06-27T20:00:00Z'],
    ['F', 'PLB', 'TUN', '2026-06-27T20:00:00Z'],
    ['G', 'BEL', 'NZL', '2026-06-28T16:00:00Z'],
    ['G', 'EGY', 'IRN', '2026-06-28T16:00:00Z'],
    ['H', 'ESP', 'CPV', '2026-06-28T20:00:00Z'],
    ['H', 'KSA', 'URU', '2026-06-28T20:00:00Z'],
    ['I', 'FRA', 'NOR', '2026-06-29T16:00:00Z'],
    ['I', 'SEN', 'IC2', '2026-06-29T16:00:00Z'],
    ['J', 'ARG', 'ALG', '2026-06-29T20:00:00Z'],
    ['J', 'AUT', 'JOR', '2026-06-29T20:00:00Z'],
    ['K', 'POR', 'IC1', '2026-06-30T16:00:00Z'],
    ['K', 'UZB', 'COL', '2026-06-30T16:00:00Z'],
    ['L', 'ENG', 'CRO', '2026-06-30T20:00:00Z'],
    ['L', 'GHA', 'PAN', '2026-06-30T20:00:00Z'],
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

        if (!['seed_wc2026', 'reseed_matches'].includes(body.action)) {
            return Response.json({ error: 'Invalid action. Use seed_wc2026 or reseed_matches' }, { status: 400 });
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