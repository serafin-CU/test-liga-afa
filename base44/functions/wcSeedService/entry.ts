import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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

// MD1: 1v3, 2v4 | MD2: 1v4, 3v2 | MD3: 1v2, 3v4  (0-indexed)
const MATCHDAY_PAIRS = {
    GROUP_MD1: [[0, 2], [1, 3]],
    GROUP_MD2: [[0, 3], [2, 1]],
    GROUP_MD3: [[0, 1], [2, 3]],
};

// 4 days per MD, 6 matches/day staggered
const MD_DATES = {
    GROUP_MD1: ['2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'],
    GROUP_MD2: ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'],
    GROUP_MD3: ['2026-06-25', '2026-06-26', '2026-06-27'],
};
const SLOT_TIMES = ['13:00', '16:00', '19:00', '22:00', '01:00', '04:00'];

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

        if (body.action !== 'seed_wc2026') {
            return Response.json({ error: 'Invalid action. Use seed_wc2026' }, { status: 400 });
        }

        // ── 1. Clean slate: delete existing matches, players, teams ──
        // Fetch all in parallel, then delete sequentially per type
        console.log('Fetching existing data for deletion...');
        const [existingMatches, existingPlayers, existingTeams] = await Promise.all([
            base44.asServiceRole.entities.Match.list(),
            base44.asServiceRole.entities.Player.list(),
            base44.asServiceRole.entities.Team.list(),
        ]);

        console.log(`Deleting ${existingMatches.length} matches, ${existingPlayers.length} players, ${existingTeams.length} teams...`);
        for (const m of existingMatches) await base44.asServiceRole.entities.Match.delete(m.id);
        for (const p of existingPlayers) await base44.asServiceRole.entities.Player.delete(p.id);
        for (const t of existingTeams) await base44.asServiceRole.entities.Team.delete(t.id);

        // ── 2. Create teams ──
        console.log('Creating teams...');
        let teams_created = 0;
        let players_created = 0;
        let matches_created = 0;

        // Map: fifa_code -> created team record
        const teamMap = {};

        // Bulk create all teams at once
        const allTeamData = GROUPS.flatMap(g => g.teams.map(t => ({
            name: t.name,
            fifa_code: t.code,
            is_qualified: t.qualified,
        })));
        const createdTeams = await base44.asServiceRole.entities.Team.bulkCreate(allTeamData);
        teams_created = createdTeams.length;

        // Build fifa_code -> team record map
        for (const t of createdTeams) {
            teamMap[t.fifa_code] = t;
        }

        // ── 3. Bulk create 14 players per team ──
        const allPlayerData = [];
        for (const group of GROUPS) {
            for (const t of group.teams) {
                const team = teamMap[t.code];
                allPlayerData.push(...buildPlayersForTeam(team.id, t.code));
            }
        }
        // Batch in chunks of 100 to avoid payload limits
        for (let i = 0; i < allPlayerData.length; i += 100) {
            const chunk = allPlayerData.slice(i, i + 100);
            const created = await base44.asServiceRole.entities.Player.bulkCreate(chunk);
            players_created += created.length;
        }

        // ── 4. Create group stage matches ──
        console.log('Creating matches...');

        // Flatten all 72 matches across all groups and MDs, then assign slots
        // 12 groups × 2 matches per MD × 3 MDs = 72 matches
        // Each MD spans 4 days × 6 slots = 24 slots (we have 24 matches per MD)

        const allMatchData = [];
        for (const [phase, pairs] of Object.entries(MATCHDAY_PAIRS)) {
            const dates = MD_DATES[phase];
            let slotIndex = 0;

            for (const group of GROUPS) {
                const groupTeams = group.teams;
                for (const [hiIdx, awIdx] of pairs) {
                    const homeTeam = teamMap[groupTeams[hiIdx].code];
                    const awayTeam = teamMap[groupTeams[awIdx].code];

                    const dayIdx = Math.floor(slotIndex / SLOT_TIMES.length) % dates.length;
                    const timeIdx = slotIndex % SLOT_TIMES.length;
                    const kickoff = new Date(`${dates[dayIdx]}T${SLOT_TIMES[timeIdx]}:00Z`);

                    allMatchData.push({
                        phase,
                        kickoff_at: kickoff.toISOString(),
                        home_team_id: homeTeam.id,
                        away_team_id: awayTeam.id,
                        status: 'SCHEDULED',
                        venue: `Group ${group.name} - ${phase} Match`,
                    });
                    slotIndex++;
                }
            }
        }

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