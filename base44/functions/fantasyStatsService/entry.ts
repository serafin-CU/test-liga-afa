import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fantasy Stats Service
 * Converts ingested match data into FantasyMatchPlayerStats
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, match_id, options } = await req.json();

        if (action === 'build_fantasy_stats') {
            const result = await buildFantasyStatsForMatch(base44, match_id, options || {});
            return Response.json(result);
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Fantasy stats service error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function buildFantasyStatsForMatch(base44, match_id, options = {}) {
    const {
        source_preference_order = ["PROMIEDOS", "WIKIPEDIA"],
        allow_manual_fallback = true,
        dry_run = false
    } = options;

    // Fetch match
    const match = await base44.asServiceRole.entities.Match.get(match_id);
    if (!match) {
        throw new Error('Match not found');
    }

    // Fetch latest successful ingestion events for this match
    const events = await base44.asServiceRole.entities.IngestionEvent.filter({
        match_id,
        parse_status: 'OK'
    });

    if (events.length === 0) {
        return { status: 'NO_SOURCE_DATA', match_id };
    }

    // Get data sources to resolve names
    const sources = await base44.asServiceRole.entities.DataSource.list();
    const sourcesMap = Object.fromEntries(sources.map(s => [s.id, s]));

    // Choose best source by preference order
    let chosenEvent = null;
    let chosenSourceName = null;

    for (const sourceName of source_preference_order) {
        const source = sources.find(s => s.name === sourceName);
        if (!source) continue;

        const sourceEvent = events
            .filter(e => e.source_id === source.id)
            .sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0];

        if (sourceEvent) {
            chosenEvent = sourceEvent;
            chosenSourceName = sourceName;
            break;
        }
    }

    if (!chosenEvent) {
        return { status: 'NO_SOURCE_DATA', match_id };
    }

    // Parse the JSON
    const parsed = JSON.parse(chosenEvent.parsed_json);

    // Fetch players and teams for resolution
    const allPlayers = await base44.asServiceRole.entities.Player.list();
    const teams = await base44.asServiceRole.entities.Team.list();

    // Build stats
    const statsMap = {}; // player_id -> stats object
    const unresolvedNames = [];
    const match_length = determineMatchLength(parsed);

    // Process lineups if present
    if (parsed.lineups) {
        for (const lineup of parsed.lineups) {
            const team_id = resolveTeamId(match, lineup.team_name, teams);
            if (!team_id) continue;

            for (const playerName of (lineup.starters || [])) {
                const player = resolvePlayer(allPlayers, match_id, team_id, playerName);
                if (player) {
                    if (!statsMap[player.id]) {
                        statsMap[player.id] = initPlayerStats(player.id, match_id, team_id);
                    }
                    statsMap[player.id].started = true;
                    statsMap[player.id].minute_in = 0;
                } else {
                    unresolvedNames.push({ team: lineup.team_name, name: playerName, context: 'lineup_starter' });
                }
            }

            for (const playerName of (lineup.bench || [])) {
                const player = resolvePlayer(allPlayers, match_id, team_id, playerName);
                if (player) {
                    if (!statsMap[player.id]) {
                        statsMap[player.id] = initPlayerStats(player.id, match_id, team_id);
                    }
                    statsMap[player.id].started = false;
                } else {
                    unresolvedNames.push({ team: lineup.team_name, name: playerName, context: 'lineup_bench' });
                }
            }
        }
    }

    // Process events
    for (const event of (parsed.events || [])) {
        const team_id = resolveTeamId(match, event.team, teams);
        if (!team_id) continue;

        if (event.type === 'GOAL') {
            const player = resolvePlayer(allPlayers, match_id, team_id, event.player);
            if (player) {
                if (!statsMap[player.id]) {
                    statsMap[player.id] = initPlayerStats(player.id, match_id, team_id);
                }
                statsMap[player.id].goals++;
            } else {
                unresolvedNames.push({ team: event.team, name: event.player, context: 'goal' });
            }
        }

        if (event.type === 'YC') {
            const player = resolvePlayer(allPlayers, match_id, team_id, event.player);
            if (player) {
                if (!statsMap[player.id]) {
                    statsMap[player.id] = initPlayerStats(player.id, match_id, team_id);
                }
                statsMap[player.id].yellow_cards++;
            } else {
                unresolvedNames.push({ team: event.team, name: event.player, context: 'yellow_card' });
            }
        }

        if (event.type === 'RC') {
            const player = resolvePlayer(allPlayers, match_id, team_id, event.player);
            if (player) {
                if (!statsMap[player.id]) {
                    statsMap[player.id] = initPlayerStats(player.id, match_id, team_id);
                }
                statsMap[player.id].red_cards = 1;
            } else {
                unresolvedNames.push({ team: event.team, name: event.player, context: 'red_card' });
            }
        }

        if (event.type === 'SUB') {
            const minute = event.minute || 0;

            if (event.player_out) {
                const playerOut = resolvePlayer(allPlayers, match_id, team_id, event.player_out);
                if (playerOut) {
                    if (!statsMap[playerOut.id]) {
                        statsMap[playerOut.id] = initPlayerStats(playerOut.id, match_id, team_id);
                    }
                    statsMap[playerOut.id].substituted_out = true;
                    statsMap[playerOut.id].minute_out = minute;
                } else {
                    unresolvedNames.push({ team: event.team, name: event.player_out, context: 'sub_out' });
                }
            }

            if (event.player_in) {
                const playerIn = resolvePlayer(allPlayers, match_id, team_id, event.player_in);
                if (playerIn) {
                    if (!statsMap[playerIn.id]) {
                        statsMap[playerIn.id] = initPlayerStats(playerIn.id, match_id, team_id);
                    }
                    statsMap[playerIn.id].substituted_in = true;
                    statsMap[playerIn.id].minute_in = minute;
                    statsMap[playerIn.id].started = false;
                } else {
                    unresolvedNames.push({ team: event.team, name: event.player_in, context: 'sub_in' });
                }
            }
        }
    }

    // Derive minutes played for all players
    for (const playerId in statsMap) {
        const stat = statsMap[playerId];
        
        // Set defaults
        if (stat.started && stat.minute_in === null) {
            stat.minute_in = 0;
        }
        if (stat.minute_in === null) {
            stat.minute_in = 0; // Fallback
        }
        if (stat.minute_out === null && !stat.substituted_out) {
            stat.minute_out = match_length;
        }
        if (stat.minute_out === null) {
            stat.minute_out = match_length; // Fallback
        }

        // Compute minutes
        const start = stat.minute_in;
        const end = stat.minute_out;
        stat.minutes_played = Math.max(0, Math.min(end - start, match_length));
    }

    // Log unresolved names
    if (unresolvedNames.length > 0) {
        await base44.asServiceRole.entities.AdminAuditLog.create({
            admin_user_id: null,
            actor_type: 'SYSTEM',
            action: 'UNRESOLVED_PLAYER_NAMES',
            entity_type: 'FantasyMatchPlayerStats',
            entity_id: match_id,
            reason: `${unresolvedNames.length} player names could not be resolved`,
            details_json: JSON.stringify({ unresolved: unresolvedNames, source: chosenSourceName })
        });
    }

    if (dry_run) {
        return {
            status: 'DRY_RUN',
            match_id,
            source_used: chosenSourceName,
            stats_count: Object.keys(statsMap).length,
            unresolved_names: unresolvedNames,
            match_length
        };
    }

    // Persist stats (idempotent upsert)
    let created_count = 0;
    let updated_count = 0;

    const existingStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id });
    const existingMap = Object.fromEntries(existingStats.map(s => [s.player_id, s]));

    for (const playerId in statsMap) {
        const stat = statsMap[playerId];
        const existing = existingMap[playerId];

        const data = {
            match_id,
            player_id: playerId,
            team_id: stat.team_id,
            started: stat.started,
            substituted_in: stat.substituted_in,
            substituted_out: stat.substituted_out,
            minute_in: stat.minute_in,
            minute_out: stat.minute_out,
            minutes_played: stat.minutes_played,
            goals: stat.goals,
            yellow_cards: stat.yellow_cards,
            red_cards: stat.red_cards,
            source: chosenSourceName
        };

        if (existing) {
            // Update only if new source has higher priority or manual fallback allowed
            const shouldUpdate = 
                (source_preference_order.indexOf(chosenSourceName) < source_preference_order.indexOf(existing.source)) ||
                (allow_manual_fallback && chosenSourceName === 'MANUAL');

            if (shouldUpdate) {
                await base44.asServiceRole.entities.FantasyMatchPlayerStats.update(existing.id, data);
                updated_count++;
            }
        } else {
            await base44.asServiceRole.entities.FantasyMatchPlayerStats.create(data);
            created_count++;
        }
    }

    return {
        status: 'SUCCESS',
        match_id,
        source_used: chosenSourceName,
        created_count,
        updated_count,
        unresolved_names: unresolvedNames,
        match_length
    };
}

function initPlayerStats(player_id, match_id, team_id) {
    return {
        player_id,
        match_id,
        team_id,
        started: false,
        substituted_in: false,
        substituted_out: false,
        minute_in: null,
        minute_out: null,
        minutes_played: 0,
        goals: 0,
        yellow_cards: 0,
        red_cards: 0
    };
}

function determineMatchLength(parsed) {
    let maxMinute = 90;

    if (parsed.events) {
        for (const event of parsed.events) {
            if (event.minute && event.minute > maxMinute) {
                maxMinute = event.minute;
            }
        }
    }

    return Math.min(Math.max(90, maxMinute), 130);
}

function resolveTeamId(match, teamName, teams) {
    if (!teamName) return null;

    // Try to match home/away team
    const homeTeam = teams.find(t => t.id === match.home_team_id);
    const awayTeam = teams.find(t => t.id === match.away_team_id);

    if (homeTeam && normalizeString(homeTeam.name).includes(normalizeString(teamName))) {
        return homeTeam.id;
    }
    if (awayTeam && normalizeString(awayTeam.name).includes(normalizeString(teamName))) {
        return awayTeam.id;
    }

    // Fallback: try any team match
    const normalized = normalizeString(teamName);
    const team = teams.find(t => normalizeString(t.name).includes(normalized) || normalized.includes(normalizeString(t.name)));
    return team?.id || null;
}

function resolvePlayer(allPlayers, match_id, team_id, rawName) {
    if (!rawName) return null;

    const normalized = normalizeString(rawName);
    const teamPlayers = allPlayers.filter(p => p.team_id === team_id);

    // Exact match
    let match = teamPlayers.find(p => normalizeString(p.full_name) === normalized);
    if (match) return match;

    // Contains match
    match = teamPlayers.find(p => normalizeString(p.full_name).includes(normalized) || normalized.includes(normalizeString(p.full_name)));
    if (match) return match;

    // Token overlap (best effort)
    const tokens = normalized.split(/\s+/).filter(t => t.length > 2);
    if (tokens.length > 0) {
        const candidates = teamPlayers.map(p => {
            const pTokens = normalizeString(p.full_name).split(/\s+/).filter(t => t.length > 2);
            const overlap = tokens.filter(t => pTokens.some(pt => pt.includes(t) || t.includes(pt))).length;
            return { player: p, overlap };
        }).filter(c => c.overlap > 0).sort((a, b) => b.overlap - a.overlap);

        if (candidates.length > 0 && candidates[0].overlap > 0) {
            return candidates[0].player;
        }
    }

    return null;
}

function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();
}