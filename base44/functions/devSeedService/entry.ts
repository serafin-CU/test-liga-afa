import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEV_SEED_MARKER = 'DEV_SEED_v1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { action } = await req.json();

        if (action === 'seed') {
            return await seedDevData(base44);
        } else if (action === 'delete') {
            return await deleteDevData(base44);
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('DevSeedService error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function seedDevData(base44) {
    const seedId = DEV_SEED_MARKER;
    
    // Check if dev seed already exists
    const existingTeams = await base44.asServiceRole.entities.Team.filter({});
    const hasDevSeed = existingTeams.some(t => t.name && t.name.includes('[DEV-'));
    
    if (hasDevSeed) {
        return Response.json({
            success: false,
            message: 'Dev seed already exists. Delete it before reseeding.',
            counts: { created: 0, reused: 0, skipped: 0 }
        });
    }

    let created_count = 0;
    let reused_count = 0;
    let skipped_count = 0;

    // 1. Ensure AppConfig exists
    const configs = await base44.asServiceRole.entities.AppConfig.list();
    if (configs.length === 0) {
        const tournamentStart = new Date();
        tournamentStart.setDate(tournamentStart.getDate() + 60);
        
        const squadLock = new Date(tournamentStart);
        squadLock.setDate(squadLock.getDate() - 7);

        await base44.asServiceRole.entities.AppConfig.create({
            tournament_start_at: tournamentStart.toISOString(),
            squad_lock_at: squadLock.toISOString(),
            tournament_phase: 'PRE_TOURNAMENT',
            transfer_window_state: 'OPEN'
        });
        created_count++;
    } else {
        reused_count++;
    }

    // 2. Create or reuse DataSources
    const sources = await base44.asServiceRole.entities.DataSource.list();
    let fifaSource = sources.find(s => s.name === 'FIFA');
    let wikiSource = sources.find(s => s.name === 'WIKIPEDIA');

    if (!fifaSource) {
        fifaSource = await base44.asServiceRole.entities.DataSource.create({
            name: 'FIFA',
            base_url: 'https://www.fifa.com',
            allowed_paths_regex: '/.*',
            rate_limit_seconds: 30,
            enabled: true,
            notes: JSON.stringify({ dev_seed_id: seedId })
        });
        created_count++;
    } else {
        reused_count++;
    }

    if (!wikiSource) {
        wikiSource = await base44.asServiceRole.entities.DataSource.create({
            name: 'WIKIPEDIA',
            base_url: 'https://en.wikipedia.org',
            allowed_paths_regex: '/wiki/.*',
            rate_limit_seconds: 30,
            enabled: true,
            notes: JSON.stringify({ dev_seed_id: seedId })
        });
        created_count++;
    } else {
        reused_count++;
    }

    // 3. Create or reuse Teams
    const teams = await base44.asServiceRole.entities.Team.list();
    let usaTeam = teams.find(t => t.fifa_code === 'USA');
    let argTeam = teams.find(t => t.fifa_code === 'ARG');

    if (!usaTeam) {
        usaTeam = await base44.asServiceRole.entities.Team.create({
            name: `USA [DEV-${seedId}]`,
            fifa_code: 'USA',
            is_qualified: true
        });
        created_count++;
    } else {
        reused_count++;
    }

    if (!argTeam) {
        argTeam = await base44.asServiceRole.entities.Team.create({
            name: `ARG [DEV-${seedId}]`,
            fifa_code: 'ARG',
            is_qualified: true
        });
        created_count++;
    } else {
        reused_count++;
    }

    // 4. Create or reuse Players
    const players = await base44.asServiceRole.entities.Player.list();
    const usaPlayers = players.filter(p => p.team_id === usaTeam.id);
    const argPlayers = players.filter(p => p.team_id === argTeam.id);

    if (usaPlayers.length < 4) {
        const usaPlayerData = [
            { full_name: `USA GK [DEV-${seedId}]`, position: 'GK', price: 6 },
            { full_name: `USA DEF [DEV-${seedId}]`, position: 'DEF', price: 7 },
            { full_name: `USA MID [DEV-${seedId}]`, position: 'MID', price: 8 },
            { full_name: `USA FWD [DEV-${seedId}]`, position: 'FWD', price: 9 }
        ];

        for (const pd of usaPlayerData) {
            await base44.asServiceRole.entities.Player.create({
                ...pd,
                team_id: usaTeam.id,
                is_active: true
            });
            created_count++;
        }
    } else {
        reused_count += usaPlayers.length;
    }

    if (argPlayers.length < 4) {
        const argPlayerData = [
            { full_name: `ARG GK [DEV-${seedId}]`, position: 'GK', price: 6 },
            { full_name: `ARG DEF [DEV-${seedId}]`, position: 'DEF', price: 7 },
            { full_name: `ARG MID [DEV-${seedId}]`, position: 'MID', price: 9 },
            { full_name: `ARG FWD [DEV-${seedId}]`, position: 'FWD', price: 10 }
        ];

        for (const pd of argPlayerData) {
            await base44.asServiceRole.entities.Player.create({
                ...pd,
                team_id: argTeam.id,
                is_active: true
            });
            created_count++;
        }
    } else {
        reused_count += argPlayers.length;
    }

    // 5. Create or reuse Matches
    const now = new Date();
    const future = new Date(now);
    future.setHours(future.getHours() + 4);
    const past = new Date(now);
    past.setHours(past.getHours() - 6);

    const existingMatches = await base44.asServiceRole.entities.Match.filter({
        home_team_id: usaTeam.id,
        away_team_id: argTeam.id,
        phase: 'GROUP_MD1'
    });

    let match1, match2;

    const futureMatch = existingMatches.find(m => m.venue?.includes('FUTURE'));
    const pastMatch = existingMatches.find(m => m.venue?.includes('PAST'));

    if (!futureMatch) {
        match1 = await base44.asServiceRole.entities.Match.create({
            phase: 'GROUP_MD1',
            kickoff_at: future.toISOString(),
            home_team_id: usaTeam.id,
            away_team_id: argTeam.id,
            status: 'SCHEDULED',
            venue: `DEV-${seedId}-FUTURE`
        });
        created_count++;
    } else {
        match1 = futureMatch;
        reused_count++;
    }

    if (!pastMatch) {
        match2 = await base44.asServiceRole.entities.Match.create({
            phase: 'GROUP_MD1',
            kickoff_at: past.toISOString(),
            home_team_id: usaTeam.id,
            away_team_id: argTeam.id,
            status: 'SCHEDULED',
            venue: `DEV-${seedId}-PAST`
        });
        created_count++;
    } else {
        match2 = pastMatch;
        reused_count++;
    }

    // 6. Ensure MatchSourceLinks (always 2 per match)
    const matches = [match1, match2];
    
    for (const match of matches) {
        // FIFA link
        const existingFifa = await base44.asServiceRole.entities.MatchSourceLink.filter({
            match_id: match.id,
            source_id: fifaSource.id
        });

        if (existingFifa.length === 0) {
            await base44.asServiceRole.entities.MatchSourceLink.create({
                match_id: match.id,
                source_id: fifaSource.id,
                url: null,
                is_primary: true
            });
            created_count++;
        } else {
            reused_count++;
        }

        // Wikipedia link
        const existingWiki = await base44.asServiceRole.entities.MatchSourceLink.filter({
            match_id: match.id,
            source_id: wikiSource.id
        });

        if (existingWiki.length === 0) {
            await base44.asServiceRole.entities.MatchSourceLink.create({
                match_id: match.id,
                source_id: wikiSource.id,
                url: null,
                is_primary: false
            });
            created_count++;
        } else {
            reused_count++;
        }
    }

    return Response.json({
        success: true,
        message: 'Dev data seeded successfully',
        counts: {
            created: created_count,
            reused: reused_count,
            skipped: skipped_count
        }
    });
}

async function deleteDevData(base44) {
    let deleted_count = 0;

    // Find all dev-seeded records (by marker in name/venue/notes)
    const teams = await base44.asServiceRole.entities.Team.list();
    const devTeams = teams.filter(t => t.name && t.name.includes('[DEV-'));

    if (devTeams.length === 0) {
        return Response.json({
            success: false,
            message: 'No dev seed data found',
            counts: { deleted: 0 }
        });
    }

    const devTeamIds = devTeams.map(t => t.id);

    // Delete MatchSourceLinks for dev matches
    const matches = await base44.asServiceRole.entities.Match.list();
    const devMatches = matches.filter(m => 
        devTeamIds.includes(m.home_team_id) || devTeamIds.includes(m.away_team_id)
    );
    const devMatchIds = devMatches.map(m => m.id);

    for (const matchId of devMatchIds) {
        const links = await base44.asServiceRole.entities.MatchSourceLink.filter({ match_id: matchId });
        for (const link of links) {
            await base44.asServiceRole.entities.MatchSourceLink.delete(link.id);
            deleted_count++;
        }
    }

    // Delete Matches
    for (const match of devMatches) {
        await base44.asServiceRole.entities.Match.delete(match.id);
        deleted_count++;
    }

    // Delete Players
    const players = await base44.asServiceRole.entities.Player.list();
    const devPlayers = players.filter(p => devTeamIds.includes(p.team_id));
    for (const player of devPlayers) {
        await base44.asServiceRole.entities.Player.delete(player.id);
        deleted_count++;
    }

    // Delete Teams
    for (const team of devTeams) {
        await base44.asServiceRole.entities.Team.delete(team.id);
        deleted_count++;
    }

    // Delete DataSources (if tagged)
    const sources = await base44.asServiceRole.entities.DataSource.list();
    for (const source of sources) {
        if (source.notes) {
            try {
                const notes = JSON.parse(source.notes);
                if (notes.dev_seed_id) {
                    await base44.asServiceRole.entities.DataSource.delete(source.id);
                    deleted_count++;
                }
            } catch (e) {
                // Skip if notes is not JSON
            }
        }
    }

    return Response.json({
        success: true,
        message: 'Dev seed data deleted successfully',
        counts: {
            deleted: deleted_count
        }
    });
}