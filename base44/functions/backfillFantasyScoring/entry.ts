import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Backfill Fantasy Stats + Scoring for all finalized matches that have no FantasyMatchPlayerStats yet.
 * Inlines ingest + stats build + fantasy scoring logic to avoid cross-function auth issues.
 * Safe to re-run (idempotent per match). Admin-only.
 */

const API_BASE = 'https://v3.football.api-sports.io';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let user = null;
        try { user = await base44.auth.me(); } catch {}
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const { dry_run = false, force_rescore = false, match_id_filter = null, venue_filter = null, batch_size = 5, offset = 0 } = body;

        // Pre-load all data to avoid per-iteration rate limits
        const [allResults, allMatches, allExistingStats, allPlayers, allTeams, dataSources] = await Promise.all([
            base44.asServiceRole.entities.MatchResultFinal.list('finalized_at', 500),
            base44.asServiceRole.entities.Match.list('kickoff_at', 500),
            base44.asServiceRole.entities.FantasyMatchPlayerStats.list(undefined, 5000),
            base44.asServiceRole.entities.Player.list(undefined, 3000),
            base44.asServiceRole.entities.Team.list(),
            base44.asServiceRole.entities.DataSource.list()
        ]);

        const matchesById = Object.fromEntries(allMatches.map(m => [m.id, m]));
        const statsMatchIds = new Set(allExistingStats.map(s => s.match_id));

        // Get or create API_FUTBOL data source
        let apiSource = dataSources.find(s => s.name === 'API_FUTBOL');
        if (!apiSource) {
            apiSource = await base44.asServiceRole.entities.DataSource.create({
                name: 'API_FUTBOL', base_url: API_BASE,
                allowed_paths_regex: '.*', enabled: true,
                rate_limit_seconds: 5, notes: 'API-Football v3'
            });
        }

        // Build a set of match_ids for the venue filter
        const venueMatchIds = venue_filter
            ? new Set(allMatches.filter(m => m.venue === venue_filter).map(m => m.id))
            : null;

        const allFiltered = match_id_filter
            ? allResults.filter(r => r.match_id === match_id_filter)
            : allResults.filter(r => {
                if (venueMatchIds && !venueMatchIds.has(r.match_id)) return false;
                return !statsMatchIds.has(r.match_id) || force_rescore;
              });

        const filtered = allFiltered.slice(offset, offset + batch_size);

        console.log(`[backfillFantasy] Total pending: ${allFiltered.length}, processing ${filtered.length} (offset=${offset})`);

        const summary = { total: filtered.length, skipped: 0, ingest_ok: 0, ingest_fail: 0, stats_ok: 0, stats_fail: 0, scored_ok: 0, scored_fail: 0, already_scored: 0, errors: [] };

        const apiKey = Deno.env.get('API_FUTBOL');

        for (const result of filtered) {
            const mid = result.match_id;
            const match = matchesById[mid];

            if (!match) {
                summary.errors.push({ match_id: mid, step: 'match_lookup', error: 'Match not found' });
                continue;
            }
            if (!match.api_fixture_id) {
                summary.skipped++;
                continue;
            }

            if (dry_run) {
                console.log(`[backfillFantasy] DRY_RUN: match ${mid} fixture ${match.api_fixture_id}`);
                summary.stats_ok++;
                continue;
            }

            // ── Step 1: Ingest fixture from API-Football ──────────────────────
            let ingestOk = false;
            try {
                const fid = match.api_fixture_id;
                const [eventsRes, lineupsRes, playerStatsRes, fixtureRes] = await Promise.all([
                    apiFetch(apiKey, `/fixtures/events?fixture=${fid}`),
                    apiFetch(apiKey, `/fixtures/lineups?fixture=${fid}`),
                    apiFetch(apiKey, `/fixtures/players?fixture=${fid}`),
                    apiFetch(apiKey, `/fixtures?id=${fid}`)
                ]);

                const fixture = fixtureRes.response?.[0];
                if (!fixture) throw new Error('Fixture not found in API');

                const parsedJson = {
                    source: 'API_FUTBOL', fixture_id: fid,
                    status: mapStatus(fixture.fixture?.status?.short),
                    score: { home: fixture.goals?.home, away: fixture.goals?.away },
                    home_team: fixture.teams?.home?.name,
                    away_team: fixture.teams?.away?.name,
                    events: normalizeEvents(eventsRes.response || []),
                    lineups: normalizeLineups(lineupsRes.response || []),
                    player_stats: normalizePlayerStats(playerStatsRes.response || []),
                    fetched_at: new Date().toISOString()
                };

                const contentHash = await hashString(JSON.stringify(parsedJson));
                const run = await base44.asServiceRole.entities.IngestionRun.create({
                    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
                    status: 'SUCCESS',
                    summary_json: JSON.stringify({ job: 'backfillFantasy', fixture_id: fid, match_id: mid })
                });

                const existingEvents = await base44.asServiceRole.entities.IngestionEvent.filter({ match_id: mid, source_id: apiSource.id });
                if (existingEvents.length > 0) {
                    await base44.asServiceRole.entities.IngestionEvent.update(existingEvents[0].id, {
                        run_id: run.id, fetched_at: new Date().toISOString(),
                        http_status: 200, parse_status: 'OK',
                        content_hash: contentHash, parsed_json: JSON.stringify(parsedJson), error_message: null
                    });
                } else {
                    await base44.asServiceRole.entities.IngestionEvent.create({
                        run_id: run.id, match_id: mid, source_id: apiSource.id,
                        fetched_at: new Date().toISOString(), http_status: 200,
                        parse_status: 'OK', content_hash: contentHash,
                        parsed_json: JSON.stringify(parsedJson), error_message: null
                    });
                }

                summary.ingest_ok++;
                ingestOk = true;
                console.log(`[backfillFantasy] Match ${mid}: ingested (${parsedJson.player_stats.length} players)`);
            } catch (err) {
                summary.ingest_fail++;
                summary.errors.push({ match_id: mid, step: 'ingest', error: err.message });
                console.error(`[backfillFantasy] Match ${mid}: ingest failed - ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 800));

            // ── Step 2: Build FantasyMatchPlayerStats ─────────────────────────
            let statsOk = false;
            try {
                const ingestionEvents = await base44.asServiceRole.entities.IngestionEvent.filter({ match_id: mid, parse_status: 'OK' });
                if (ingestionEvents.length === 0) throw new Error('No ingestion event found');

                const chosenEvent = ingestionEvents.sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0];
                const parsed = JSON.parse(chosenEvent.parsed_json);
                const match_length = determineMatchLength(parsed);

                const statsMap = {};

                // Use player_stats directly (API-Football format - most reliable)
                // Build an api_player_id → player map for fast lookup
                const playersByApiId = Object.fromEntries(allPlayers.filter(p => p.api_player_id).map(p => [p.api_player_id, p]));

                if (parsed.player_stats && parsed.player_stats.length > 0) {
                    for (const ps of parsed.player_stats) {
                        const team_id = resolveTeamId(match, ps.team_name, allTeams);
                        if (!team_id) continue;

                        // 1. Try resolve by api_player_id first (most reliable, avoids abbrev name mismatches)
                        let player = ps.api_player_id ? playersByApiId[String(ps.api_player_id)] : null;
                        // 2. Fall back to name fuzzy match
                        if (!player) player = resolvePlayer(allPlayers, team_id, ps.player_name);

                        // Auto-create player if still not found
                        if (!player && ps.player_name && ps.minutes_played > 0) {
                            const pos = mapApiPosition(ps.position);
                            player = await base44.asServiceRole.entities.Player.create({
                                full_name: ps.player_name, team_id, position: pos,
                                price: 5, is_active: true,
                                api_player_id: ps.api_player_id ? String(ps.api_player_id) : undefined
                            });
                            allPlayers.push(player);
                            if (ps.api_player_id) playersByApiId[String(ps.api_player_id)] = player;
                            console.log(`[backfillFantasy] Auto-created player: ${ps.player_name} (${pos}) api_pos="${ps.position}"`);
                        }
                        if (!player) continue;
                        statsMap[player.id] = {
                            player_id: player.id, match_id: mid, team_id,
                            started: ps.started || false,
                            substituted_in: false, substituted_out: false,
                            minute_in: ps.started ? 0 : null, minute_out: null,
                            minutes_played: ps.minutes_played || 0,
                            goals: ps.goals || 0,
                            assists: ps.assists || 0,
                            yellow_cards: ps.yellow_cards || 0,
                            red_cards: ps.red_cards || 0,
                            rating: ps.rating ?? null,
                            source: 'API_FUTBOL',
                            _direct: true
                        };
                    }
                }

                // Supplement with events for subs (minute_in/out)
                for (const event of (parsed.events || [])) {
                    const team_id = resolveTeamId(match, event.team, allTeams);
                    if (!team_id) continue;
                    if (event.type === 'SUB') {
                        if (event.player_out) {
                            const p = resolvePlayer(allPlayers, team_id, event.player_out);
                            if (p && statsMap[p.id]) { statsMap[p.id].substituted_out = true; statsMap[p.id].minute_out = event.minute || 90; }
                        }
                        if (event.player_in) {
                            const p = resolvePlayer(allPlayers, team_id, event.player_in);
                            if (p && statsMap[p.id]) { statsMap[p.id].substituted_in = true; statsMap[p.id].minute_in = event.minute || 0; }
                        }
                    }
                }

                // Fallback: process lineups if player_stats was empty
                if (Object.keys(statsMap).length === 0 && parsed.lineups) {
                    for (const lineup of parsed.lineups) {
                        const team_id = resolveTeamId(match, lineup.team_name, allTeams);
                        if (!team_id) continue;
                        for (const name of (lineup.starters || [])) {
                            const p = resolvePlayer(allPlayers, team_id, name);
                            if (p && !statsMap[p.id]) {
                                statsMap[p.id] = { player_id: p.id, match_id: mid, team_id, started: true, substituted_in: false, substituted_out: false, minute_in: 0, minute_out: match_length, minutes_played: match_length, goals: 0, yellow_cards: 0, red_cards: 0, source: 'API_FUTBOL' };
                            }
                        }
                    }
                    for (const event of (parsed.events || [])) {
                        const team_id = resolveTeamId(match, event.team, allTeams);
                        if (!team_id) continue;
                        if (event.type === 'GOAL') {
                            const p = resolvePlayer(allPlayers, team_id, event.player);
                            if (p && statsMap[p.id]) statsMap[p.id].goals++;
                        }
                        if (event.type === 'YC') {
                            const p = resolvePlayer(allPlayers, team_id, event.player);
                            if (p && statsMap[p.id]) statsMap[p.id].yellow_cards++;
                        }
                        if (event.type === 'RC') {
                            const p = resolvePlayer(allPlayers, team_id, event.player);
                            if (p && statsMap[p.id]) statsMap[p.id].red_cards = 1;
                        }
                    }
                    // Derive minutes for lineup-based stats
                    for (const pid in statsMap) {
                        const s = statsMap[pid];
                        if (!s._direct) {
                            s.minute_out = s.minute_out || match_length;
                            s.minutes_played = Math.max(0, (s.minute_out || match_length) - (s.minute_in || 0));
                        }
                    }
                }

                // Persist (idempotent upsert)
                const existingStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id: mid });
                const existingStatsMap = Object.fromEntries(existingStats.map(s => [s.player_id, s]));
                let created = 0, updated = 0;
                for (const pid in statsMap) {
                    const s = statsMap[pid];
                    const data = { match_id: mid, player_id: pid, team_id: s.team_id, started: s.started, substituted_in: s.substituted_in, substituted_out: s.substituted_out, minute_in: s.minute_in, minute_out: s.minute_out, minutes_played: s.minutes_played, goals: s.goals || 0, assists: s.assists || 0, yellow_cards: s.yellow_cards || 0, red_cards: s.red_cards || 0, rating: s.rating ?? null, source: 'API_FUTBOL' };
                    if (existingStatsMap[pid]) {
                        await base44.asServiceRole.entities.FantasyMatchPlayerStats.update(existingStatsMap[pid].id, data);
                        updated++;
                    } else {
                        await base44.asServiceRole.entities.FantasyMatchPlayerStats.create(data);
                        created++;
                    }
                }

                summary.stats_ok++;
                statsOk = true;
                console.log(`[backfillFantasy] Match ${mid}: stats built (${created} created, ${updated} updated)`);
            } catch (err) {
                summary.stats_fail++;
                summary.errors.push({ match_id: mid, step: 'build_stats', error: err.message });
                console.error(`[backfillFantasy] Match ${mid}: stats failed - ${err.message}`);
            }

            if (!statsOk) continue;

            // ── Step 3: Score Fantasy ─────────────────────────────────────────
            try {
                const phase = match.phase;
                const allSquads = await base44.asServiceRole.entities.FantasySquad.filter({ phase, status: 'FINAL' });
                if (allSquads.length === 0) {
                    summary.already_scored++;
                    console.log(`[backfillFantasy] Match ${mid}: no finalized squads for phase ${phase}`);
                    continue;
                }

                // Check for prior scoring
                const priorLedger = await base44.asServiceRole.entities.PointsLedger.filter({ mode: 'FANTASY', source_id: mid });
                if (priorLedger.length > 0 && !force_rescore) {
                    summary.already_scored++;
                    console.log(`[backfillFantasy] Match ${mid}: already scored`);
                    continue;
                }

                const matchStats = await base44.asServiceRole.entities.FantasyMatchPlayerStats.filter({ match_id: mid });
                const statsMap = Object.fromEntries(matchStats.map(s => [s.player_id, s]));
                const playersMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

                for (const squad of allSquads) {
                    const squadPlayers = await base44.asServiceRole.entities.FantasySquadPlayer.filter({ squad_id: squad.id });
                    const starters = squadPlayers.filter(sp => sp.slot_type === 'STARTER');
                    const captain = starters.find(sp => sp.is_captain);

                    let totalPts = 0;
                    const perPlayer = [];
                    for (const sp of starters) {
                        const player = playersMap[sp.player_id];
                        const stat = statsMap[sp.player_id];
                        if (!player || !stat) continue;
                        const pos = player.position;
                        const mins = stat.minutes_played || 0;
                        const goals = stat.goals || 0;
                        const yc = stat.yellow_cards || 0;
                        const rc = stat.red_cards || 0;
                        let pts = 0;
                        if (mins >= 60) pts += 1;
                        if (pos === 'FWD') pts += goals * 4;
                        else if (pos === 'MID') pts += goals * 5;
                        else pts += goals * 6;
                        pts += yc * -1;
                        pts += rc * -3;
                        const isCaptain = captain && sp.player_id === captain.player_id;
                        const finalPts = isCaptain ? pts * 2 : pts;
                        totalPts += finalPts;
                        perPlayer.push({ player_id: sp.player_id, player_name: player.full_name, pos, mins, goals, yc, rc, base_points: pts, multiplier: isCaptain ? 2 : 1, points: finalPts, is_captain: isCaptain });
                    }

                    await base44.asServiceRole.entities.PointsLedger.create({
                        user_id: squad.user_id,
                        mode: 'FANTASY',
                        source_type: 'FANTASY_MATCH',
                        source_id: mid,
                        points: totalPts,
                        breakdown_json: JSON.stringify({ type: 'AWARD', match_id: mid, phase, squad_id: squad.id, per_player: perPlayer, timestamp: new Date().toISOString() })
                    });
                }

                summary.scored_ok++;
                console.log(`[backfillFantasy] Match ${mid}: scored ${allSquads.length} squads`);
            } catch (err) {
                summary.scored_fail++;
                summary.errors.push({ match_id: mid, step: 'score', error: err.message });
                console.error(`[backfillFantasy] Match ${mid}: scoring failed - ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 600));
        }

        return Response.json({
            ok: true, dry_run, force_rescore,
            pagination: { offset, batch_size, processed: filtered.length, total_pending: allFiltered.length, next_offset: offset + filtered.length, has_more: offset + filtered.length < allFiltered.length },
            summary
        });

    } catch (error) {
        console.error('[backfillFantasy] Fatal error:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(apiKey, path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-apisports-key': apiKey } });
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status} for ${path}`);
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) throw new Error(`API error: ${JSON.stringify(json.errors)}`);
    return json;
}

function mapStatus(s) {
    const finals = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
    return finals.includes(s) ? 'FINAL' : ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s) ? 'LIVE' : 'SCHEDULED';
}

function normalizeEvents(rawEvents) {
    return rawEvents.map(e => {
        const evType = (e.type || '').toLowerCase();
        const detail = (e.detail || '').toLowerCase();
        let type = null;
        if (evType === 'goal') type = detail.includes('own goal') ? 'OWN_GOAL' : 'GOAL';
        else if (evType === 'card') type = detail.includes('yellow') ? 'YC' : 'RC';
        else if (evType === 'subst') type = 'SUB';
        if (!type) return null;
        const ev = { type, minute: e.time?.elapsed ?? 0, team: e.team?.name ?? null };
        if (type === 'GOAL' || type === 'OWN_GOAL') { ev.player = e.player?.name; ev.assist = e.assist?.name; }
        else if (type === 'YC' || type === 'RC') { ev.player = e.player?.name; }
        else if (type === 'SUB') { ev.player_in = e.assist?.name; ev.player_out = e.player?.name; }
        return ev;
    }).filter(Boolean);
}

function normalizeLineups(rawLineups) {
    return rawLineups.map(t => ({
        team_name: t.team?.name,
        starters: (t.startXI || []).map(p => p.player?.name).filter(Boolean),
        bench: (t.substitutes || []).map(p => p.player?.name).filter(Boolean)
    }));
}

function normalizePlayerStats(rawPlayerStats) {
    const result = [];
    for (const teamData of rawPlayerStats) {
        const teamName = teamData.team?.name ?? null;
        for (const pd of (teamData.players || [])) {
            const s = pd.statistics?.[0] ?? {};
            const ratingRaw = s.games?.rating;
            result.push({
                player_name: pd.player?.name ?? null,
                api_player_id: pd.player?.id ? String(pd.player.id) : null,
                team_name: teamName,
                position: s.games?.position ?? null,        // e.g. "Goalkeeper", "Defender"
                minutes_played: s.games?.minutes ?? 0,
                goals: s.goals?.total ?? 0,
                assists: s.goals?.assists ?? 0,
                yellow_cards: s.cards?.yellow ?? 0,
                red_cards: s.cards?.red ?? 0,
                rating: ratingRaw ? parseFloat(ratingRaw) : null,
                started: s.games?.lineupPosition != null
            });
        }
    }
    return result;
}

function determineMatchLength(parsed) {
    let max = 90;
    for (const ev of (parsed.events || [])) { if (ev.minute > max) max = ev.minute; }
    return Math.min(Math.max(90, max), 130);
}

function normalizeStr(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
}

function resolveTeamId(match, teamName, allTeams) {
    if (!teamName) return null;
    const norm = normalizeStr(teamName);
    const home = allTeams.find(t => t.id === match.home_team_id);
    const away = allTeams.find(t => t.id === match.away_team_id);
    if (home && normalizeStr(home.name).includes(norm)) return home.id;
    if (away && normalizeStr(away.name).includes(norm)) return away.id;
    if (home && norm.includes(normalizeStr(home.name))) return home.id;
    if (away && norm.includes(normalizeStr(away.name))) return away.id;
    return null;
}

function resolvePlayer(allPlayers, team_id, rawName) {
    if (!rawName) return null;
    const norm = normalizeStr(rawName);
    const teamPlayers = allPlayers.filter(p => p.team_id === team_id);

    // 1. Exact match
    let p = teamPlayers.find(p => normalizeStr(p.full_name) === norm);
    if (p) return p;

    // 2. Substring match
    p = teamPlayers.find(p => normalizeStr(p.full_name).includes(norm) || norm.includes(normalizeStr(p.full_name)));
    if (p) return p;

    // 3. Abbreviated name match: "G. Montiel" ↔ "Gonzalo Montiel"
    //    Match if every token in the shorter name matches the start of a token in the longer name
    const normTokens = norm.split(/\s+/);
    p = teamPlayers.find(candidate => {
        const candTokens = normalizeStr(candidate.full_name).split(/\s+/);
        // Try matching normTokens against candTokens (short → long)
        const matchAbbrev = (shortTokens, longTokens) =>
            shortTokens.length > 0 && shortTokens.every(st =>
                longTokens.some(lt => lt === st || (st.length <= 2 && lt.startsWith(st)) || lt.startsWith(st))
            );
        return matchAbbrev(normTokens, candTokens) || matchAbbrev(candTokens, normTokens);
    });
    if (p) return p;

    // 4. Token overlap (surname-based)
    const tokens = normTokens.filter(t => t.length > 2);
    if (tokens.length > 0) {
        const best = teamPlayers.map(p => {
            const pt = normalizeStr(p.full_name).split(/\s+/).filter(t => t.length > 2);
            const overlap = tokens.filter(t => pt.some(x => x.includes(t) || t.includes(x))).length;
            return { player: p, overlap };
        }).filter(c => c.overlap > 0).sort((a, b) => b.overlap - a.overlap)[0];
        if (best) return best.player;
    }
    return null;
}

function mapApiPosition(apiPos) {
    if (!apiPos) return 'MID';
    const p = apiPos.toLowerCase().trim();
    // Short codes: G, D, M, F
    if (p === 'g' || p === 'goalkeeper') return 'GK';
    if (p === 'd' || p === 'defender') return 'DEF';
    if (p === 'm' || p === 'midfielder') return 'MID';
    if (p === 'f' || p === 'attacker' || p === 'forward') return 'FWD';
    return 'MID';
}

async function hashString(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}