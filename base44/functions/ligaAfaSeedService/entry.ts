import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ZONA_A = [
    { name: 'Boca Juniors', code: 'BOC', group: 'A' },
    { name: 'Independiente', code: 'IND', group: 'A' },
    { name: 'San Lorenzo', code: 'SLO', group: 'A' },
    { name: 'Vélez Sarsfield', code: 'VEL', group: 'A' },
    { name: 'Deportivo Riestra', code: 'RIE', group: 'A' },
    { name: 'Talleres', code: 'TAL', group: 'A' },
    { name: 'Instituto', code: 'INS', group: 'A' },
    { name: 'Platense', code: 'PLA', group: 'A' },
    { name: 'Estudiantes LP', code: 'EDL', group: 'A' },
    { name: 'Gimnasia Mendoza', code: 'GME', group: 'A' },
    { name: 'Lanús', code: 'LAN', group: 'A' },
    { name: "Newell's Old Boys", code: 'NEW', group: 'A' },
    { name: 'Defensa y Justicia', code: 'DYJ', group: 'A' },
    { name: 'Central Córdoba SdE', code: 'CCO', group: 'A' },
    { name: 'Unión', code: 'UNI', group: 'A' },
];

const ZONA_B = [
    { name: 'River Plate', code: 'RIV', group: 'B' },
    { name: 'Racing Club', code: 'RAC', group: 'B' },
    { name: 'Huracán', code: 'HUR', group: 'B' },
    { name: 'Barracas Central', code: 'BAR', group: 'B' },
    { name: 'Belgrano', code: 'BEL', group: 'B' },
    { name: 'Estudiantes RC', code: 'ERC', group: 'B' },
    { name: 'Argentinos Juniors', code: 'ARG', group: 'B' },
    { name: 'Tigre', code: 'TIG', group: 'B' },
    { name: 'Gimnasia LP', code: 'GLP', group: 'B' },
    { name: 'Independiente Rivadavia', code: 'IRV', group: 'B' },
    { name: 'Banfield', code: 'BAN', group: 'B' },
    { name: 'Rosario Central', code: 'ROS', group: 'B' },
    { name: 'Aldosivi', code: 'ALD', group: 'B' },
    { name: 'Atlético Tucumán', code: 'ATU', group: 'B' },
    { name: 'Sarmiento', code: 'SAR', group: 'B' },
];

const ALL_TEAMS = [...ZONA_A, ...ZONA_B];

// Fecha 10 fixtures: [homeCode, awayCode, kickoff_utc]
const FECHA_10 = [
    ['IND', 'RAC', '2026-04-05T18:00:00Z'],
    ['TAL', 'BOC', '2026-04-05T20:15:00Z'],
    ['INS', 'DYJ', '2026-04-05T22:30:00Z'],
    ['UNI', 'RIE', '2026-04-06T16:00:00Z'],
    ['SLO', 'EDL', '2026-04-06T18:15:00Z'],
    ['CCO', 'NEW', '2026-04-06T20:30:00Z'],
    ['GME', 'VEL', '2026-04-06T22:45:00Z'],
    ['LAN', 'PLA', '2026-04-07T16:00:00Z'],
    ['RIV', 'BEL', '2026-04-07T18:15:00Z'],
    ['ALD', 'ERC', '2026-04-07T18:15:00Z'],
    ['BAR', 'SAR', '2026-04-07T20:30:00Z'],
    ['GLP', 'HUR', '2026-04-07T20:30:00Z'],
    ['ROS', 'ATU', '2026-04-07T22:45:00Z'],
    ['TIG', 'IRV', '2026-04-07T22:45:00Z'],
    ['ARG', 'BAN', '2026-04-05T16:00:00Z'],
];

// Fecha 11 fixtures: [homeCode, awayCode, kickoff_utc]
const FECHA_11 = [
    ['VEL', 'LAN', '2026-04-12T16:00:00Z'],
    ['NEW', 'GME', '2026-04-12T18:15:00Z'],
    ['EDL', 'CCO', '2026-04-12T20:30:00Z'],
    ['RIE', 'SLO', '2026-04-12T22:45:00Z'],
    ['DYJ', 'UNI', '2026-04-13T16:00:00Z'],
    ['BOC', 'INS', '2026-04-13T20:30:00Z'],
    ['IND', 'TAL', '2026-04-14T16:00:00Z'],
    ['BAN', 'TIG', '2026-04-12T16:00:00Z'],
    ['IRV', 'ROS', '2026-04-12T18:15:00Z'],
    ['ATU', 'GLP', '2026-04-12T20:30:00Z'],
    ['HUR', 'BAR', '2026-04-12T22:45:00Z'],
    ['SAR', 'ALD', '2026-04-13T18:15:00Z'],
    ['ERC', 'RIV', '2026-04-13T16:00:00Z'],
    ['BEL', 'RAC', '2026-04-14T18:15:00Z'],
    ['BOC', 'RIV', '2026-04-13T20:30:00Z'], // Superclásico
];

function randomPrice() {
    return Math.floor(Math.random() * 8) + 5; // 5 to 12
}

function buildPlayersForTeam(teamId, teamCode) {
    const slots = [
        { pos: 'GK', count: 1 },
        { pos: 'DEF', count: 5 },
        { pos: 'MID', count: 4 },
        { pos: 'FWD', count: 4 },
    ];
    const players = [];
    for (const { pos, count } of slots) {
        for (let i = 1; i <= count; i++) {
            players.push({
                full_name: `${teamCode} ${pos} ${i}`,
                team_id: teamId,
                position: pos,
                price: randomPrice(),
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

        if (body.action !== 'seed_teams_and_matches') {
            return Response.json({ error: 'Invalid action. Use seed_teams_and_matches' }, { status: 400 });
        }

        // ── 1. Wipe existing teams, players, matches ──
        console.log('Clearing existing data...');
        const [existingTeams, existingPlayers, existingMatches] = await Promise.all([
            base44.asServiceRole.entities.Team.list(),
            base44.asServiceRole.entities.Player.list(),
            base44.asServiceRole.entities.Match.list(),
        ]);

        async function deleteInChunks(entity, items) {
            for (let i = 0; i < items.length; i += 20) {
                const chunk = items.slice(i, i + 20);
                await Promise.all(chunk.map(x => entity.delete(x.id)));
                if (i + 20 < items.length) await new Promise(r => setTimeout(r, 300));
            }
        }

        await Promise.all([
            deleteInChunks(base44.asServiceRole.entities.Match, existingMatches),
            deleteInChunks(base44.asServiceRole.entities.Player, existingPlayers),
            deleteInChunks(base44.asServiceRole.entities.Team, existingTeams),
        ]);

        // ── 2. Create teams ──
        console.log('Creating 30 Liga AFA teams...');
        const teamData = ALL_TEAMS.map(t => ({
            name: t.name,
            fifa_code: t.code,
            is_qualified: true,
            group_code: t.group,
        }));
        const createdTeams = await base44.asServiceRole.entities.Team.bulkCreate(teamData);
        const teamMap = {};
        for (const t of createdTeams) teamMap[t.fifa_code] = t;
        console.log(`Created ${createdTeams.length} teams`);

        // ── 3. Create 14 players per team ──
        console.log('Creating players...');
        const allPlayerData = [];
        for (const t of ALL_TEAMS) {
            allPlayerData.push(...buildPlayersForTeam(teamMap[t.code].id, t.code));
        }
        let players_created = 0;
        for (let i = 0; i < allPlayerData.length; i += 100) {
            const chunk = allPlayerData.slice(i, i + 100);
            const created = await base44.asServiceRole.entities.Player.bulkCreate(chunk);
            players_created += created.length;
        }
        console.log(`Created ${players_created} players`);

        // ── 4. Create matches ──
        console.log('Creating matches...');
        const fecha10Matches = FECHA_10.map(([home, away, kickoff]) => ({
            phase: 'APERTURA_ZONE',
            kickoff_at: kickoff,
            home_team_id: teamMap[home].id,
            away_team_id: teamMap[away].id,
            status: 'SCHEDULED',
            venue: `Fecha 10`,
        }));
        const fecha11Matches = FECHA_11.map(([home, away, kickoff]) => ({
            phase: 'APERTURA_ZONE',
            kickoff_at: kickoff,
            home_team_id: teamMap[home].id,
            away_team_id: teamMap[away].id,
            status: 'SCHEDULED',
            venue: `Fecha 11`,
        }));

        const allMatchData = [...fecha10Matches, ...fecha11Matches];
        const createdMatches = await base44.asServiceRole.entities.Match.bulkCreate(allMatchData);
        console.log(`Created ${createdMatches.length} matches`);

        // ── 5. Update AppConfig ──
        const configs = await base44.asServiceRole.entities.AppConfig.list();
        const configData = {
            tournament_start_at: '2026-04-05T16:00:00Z',
            tournament_phase: 'APERTURA_ZONE',
            transfer_window_state: 'OPEN',
            squad_lock_at: '2026-04-04T12:00:00Z',
        };
        if (configs.length > 0) {
            await base44.asServiceRole.entities.AppConfig.update(configs[0].id, configData);
        } else {
            await base44.asServiceRole.entities.AppConfig.create(configData);
        }

        return Response.json({
            success: true,
            message: 'Liga AFA Apertura data seeded successfully',
            summary: {
                teams_created: createdTeams.length,
                players_created,
                matches_created: createdMatches.length,
                fecha_10_matches: fecha10Matches.length,
                fecha_11_matches: fecha11Matches.length,
            },
        });

    } catch (error) {
        console.error('ligaAfaSeedService error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});