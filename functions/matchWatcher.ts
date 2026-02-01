import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * MatchWatcher - Job B
 * 
 * Schedule: Every 10 minutes
 * 
 * Responsibilities:
 * - Fetch and parse match data ONLY within cadence windows
 * - Enforce rate limits and URL whitelist validation
 * - Create IngestionEvent rows for each fetch
 * - Update MatchValidation with cross-checked data
 * - Create IngestionRun per execution
 * 
 * Conservative and idempotent.
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Admin-only job
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const startTime = new Date();
        const now = startTime;

        // Get all matches
        const allMatches = await base44.asServiceRole.entities.Match.list();
        
        // Get data sources
        const dataSources = await base44.asServiceRole.entities.DataSource.filter({ enabled: true });
        const dataSourcesMap = {};
        for (const ds of dataSources) {
            dataSourcesMap[ds.id] = ds;
        }

        let fetchesAttempted = 0;
        let fetchesSucceeded = 0;
        let fetchesFailed = 0;
        let fetchesBlocked = 0;
        let fetchesSkippedRateLimit = 0;
        let matchesUpdated = 0;

        const events = [];

        // Process each match
        for (const match of allMatches) {
            const kickoff = new Date(match.kickoff_at);
            const minutesSinceKickoff = (now - kickoff) / (1000 * 60);

            // Determine cadence window
            const cadenceWindow = getCadenceWindow(minutesSinceKickoff);
            
            if (!cadenceWindow) {
                continue; // Outside any window
            }

            // Get source links for this match
            const sourceLinks = await base44.asServiceRole.entities.MatchSourceLink.filter({
                match_id: match.id
            });

            // Filter links that have URLs
            const validLinks = sourceLinks.filter(sl => sl.url);

            for (const link of validLinks) {
                const source = dataSourcesMap[link.source_id];
                if (!source) continue;

                // Check rate limit
                const recentEvents = await base44.asServiceRole.entities.IngestionEvent.filter({
                    source_id: link.source_id
                }, '-fetched_at', 1);

                if (recentEvents.length > 0) {
                    const lastFetch = new Date(recentEvents[0].fetched_at);
                    const secondsSinceLastFetch = (now - lastFetch) / 1000;
                    
                    if (secondsSinceLastFetch < source.rate_limit_seconds) {
                        fetchesSkippedRateLimit++;
                        continue; // Too soon, respect rate limit
                    }
                }

                // Check if we should fetch based on cadence and previous attempts
                const matchEvents = await base44.asServiceRole.entities.IngestionEvent.filter({
                    match_id: match.id,
                    source_id: link.source_id
                });

                const eventsInCurrentWindow = matchEvents.filter(e => {
                    const fetchTime = new Date(e.fetched_at);
                    const fetchMinutesSinceKickoff = (fetchTime - kickoff) / (1000 * 60);
                    return getCadenceWindow(fetchMinutesSinceKickoff) === cadenceWindow;
                });

                // Apply attempt limits per window
                const attemptLimits = {
                    'lineup_besteffort': 1,
                    'lineup_confirm': 1,
                    'halftime': 1,
                    'fulltime': 2
                };

                if (eventsInCurrentWindow.length >= (attemptLimits[cadenceWindow] || 1)) {
                    continue; // Already attempted enough times in this window
                }

                // Validate URL against whitelist
                const urlValid = validateUrl(link.url, source);
                if (!urlValid) {
                    fetchesBlocked++;
                    
                    // Log blocked attempt
                    const event = await base44.asServiceRole.entities.IngestionEvent.create({
                        run_id: 'BLOCKED',
                        match_id: match.id,
                        source_id: link.source_id,
                        fetched_at: now.toISOString(),
                        http_status: 0,
                        parse_status: 'FAIL',
                        content_hash: '',
                        parsed_json: JSON.stringify({ error: 'URL blocked - not in whitelist' }),
                        error_message: 'URL does not match base_url + allowed_paths_regex'
                    });
                    events.push(event.id);
                    continue;
                }

                // Fetch the URL
                fetchesAttempted++;
                
                try {
                    const response = await fetch(link.url, {
                        headers: {
                            'User-Agent': 'CookUnity-WorldCup-Hub/1.0'
                        }
                    });

                    const content = await response.text();
                    const contentHash = await hashString(content);

                    // Parse the content (mock parsing for now)
                    let parsedData;
                    let parseStatus = 'OK';
                    let errorMessage = null;

                    try {
                        parsedData = parseMatchData(content, source.name, match.id);
                    } catch (parseError) {
                        parseStatus = 'FAIL';
                        errorMessage = parseError.message;
                        parsedData = { error: parseError.message };
                    }

                    // Create IngestionEvent
                    const event = await base44.asServiceRole.entities.IngestionEvent.create({
                        run_id: startTime.toISOString(), // Will update with actual run_id later
                        match_id: match.id,
                        source_id: link.source_id,
                        fetched_at: now.toISOString(),
                        http_status: response.status,
                        parse_status: parseStatus,
                        content_hash: contentHash,
                        parsed_json: JSON.stringify(parsedData),
                        error_message: errorMessage
                    });
                    events.push(event.id);

                    if (response.status === 200) {
                        fetchesSucceeded++;
                    } else {
                        fetchesFailed++;
                    }

                } catch (fetchError) {
                    fetchesFailed++;
                    
                    // Log failed fetch
                    const event = await base44.asServiceRole.entities.IngestionEvent.create({
                        run_id: startTime.toISOString(),
                        match_id: match.id,
                        source_id: link.source_id,
                        fetched_at: now.toISOString(),
                        http_status: 0,
                        parse_status: 'FAIL',
                        content_hash: '',
                        parsed_json: JSON.stringify({ error: fetchError.message }),
                        error_message: fetchError.message
                    });
                    events.push(event.id);
                }
            }

            // Cross-check and update MatchValidation
            if (validLinks.length > 0) {
                const updated = await crossCheckAndValidate(base44, match.id);
                if (updated) matchesUpdated++;
            }
        }

        // Create IngestionRun
        const finishedTime = new Date();
        const status = fetchesFailed > 0 ? 'PARTIAL' : 'SUCCESS';
        
        const summaryJson = JSON.stringify({
            job: 'MatchWatcher',
            fetches_attempted: fetchesAttempted,
            fetches_succeeded: fetchesSucceeded,
            fetches_failed: fetchesFailed,
            fetches_blocked: fetchesBlocked,
            fetches_skipped_ratelimit: fetchesSkippedRateLimit,
            matches_updated: matchesUpdated,
            events_created: events.length
        });

        const ingestionRun = await base44.asServiceRole.entities.IngestionRun.create({
            started_at: startTime.toISOString(),
            finished_at: finishedTime.toISOString(),
            status,
            summary_json: summaryJson
        });

        // Update all events with the run_id
        for (const eventId of events) {
            await base44.asServiceRole.entities.IngestionEvent.update(eventId, {
                run_id: ingestionRun.id
            });
        }

        return Response.json({
            success: true,
            job: 'MatchWatcher',
            fetches_attempted: fetchesAttempted,
            fetches_succeeded: fetchesSucceeded,
            fetches_failed: fetchesFailed,
            fetches_blocked: fetchesBlocked,
            matches_updated: matchesUpdated,
            status,
            ingestion_run_id: ingestionRun.id
        });

    } catch (error) {
        console.error('MatchWatcher error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Determine cadence window based on minutes since kickoff
 */
function getCadenceWindow(minutesSinceKickoff) {
    // Lineup best-effort: K-90m to K-60m
    if (minutesSinceKickoff >= -90 && minutesSinceKickoff <= -60) {
        return 'lineup_besteffort';
    }
    // Lineup confirm: K-20m to K-10m
    if (minutesSinceKickoff >= -20 && minutesSinceKickoff <= -10) {
        return 'lineup_confirm';
    }
    // Halftime: K+45m to K+70m
    if (minutesSinceKickoff >= 45 && minutesSinceKickoff <= 70) {
        return 'halftime';
    }
    // Full-time: K+100m to K+180m
    if (minutesSinceKickoff >= 100 && minutesSinceKickoff <= 180) {
        return 'fulltime';
    }
    return null;
}

/**
 * Validate URL against data source whitelist
 */
function validateUrl(url, source) {
    if (!url.startsWith(source.base_url)) {
        return false;
    }
    
    const path = url.substring(source.base_url.length);
    
    try {
        const regex = new RegExp(source.allowed_paths_regex);
        return regex.test(path);
    } catch (e) {
        console.error('Invalid regex in source:', source.name, e);
        return false;
    }
}

/**
 * Hash a string for content change detection
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse match data from different sources
 */
function parseMatchData(content, sourceName, matchId) {
    const upperSource = sourceName.toUpperCase();
    
    if (upperSource.includes('PROMIEDOS')) {
        return parsePromiedos(content, matchId);
    } else if (upperSource.includes('WIKIPEDIA')) {
        return parseWikipedia(content, matchId);
    } else if (upperSource.includes('FIFA')) {
        return parseFIFA(content, matchId);
    }
    
    throw new Error('Unknown source: ' + sourceName);
}

/**
 * Parse Promiedos HTML content
 */
function parsePromiedos(html, matchId) {
    const result = {
        source: 'PROMIEDOS',
        match_id: matchId,
        status: 'SCHEDULED',
        score: { home: null, away: null },
        lineups: null,
        events: [],
        mvp_player: null
    };

    try {
        // Extract status from common patterns
        if (html.includes('Finalizado') || html.includes('Final')) {
            result.status = 'FINAL';
        } else if (html.includes('En Vivo') || html.includes('En Juego')) {
            result.status = 'LIVE';
        }

        // Extract score using regex patterns
        // Pattern: <score>2</score> - <score>1</score>
        const scorePattern = /<span[^>]*class="[^"]*resultado[^"]*"[^>]*>(\d+)\s*-\s*(\d+)<\/span>/i;
        const scoreMatch = html.match(scorePattern);
        
        if (!scoreMatch) {
            // Alternative pattern: direct number extraction
            const altPattern = /(\d+)\s*-\s*(\d+)/;
            const altMatch = html.match(altPattern);
            if (altMatch && result.status !== 'SCHEDULED') {
                result.score.home = parseInt(altMatch[1]);
                result.score.away = parseInt(altMatch[2]);
            }
        } else {
            result.score.home = parseInt(scoreMatch[1]);
            result.score.away = parseInt(scoreMatch[2]);
        }

        // Extract events (goals, cards, subs)
        const eventPattern = /<div[^>]*class="[^"]*evento[^"]*"[^>]*>.*?(\d+)'.*?(GOL|TARJETA AMARILLA|TARJETA ROJA|CAMBIO|YC|RC|SUB).*?<\/div>/gi;
        let eventMatch;
        
        while ((eventMatch = eventPattern.exec(html)) !== null) {
            const minute = parseInt(eventMatch[1]);
            let type = eventMatch[2].toUpperCase();
            
            // Normalize event types
            if (type.includes('AMARILLA') || type === 'YC') type = 'YC';
            else if (type.includes('ROJA') || type === 'RC') type = 'RC';
            else if (type.includes('GOL')) type = 'GOAL';
            else if (type.includes('CAMBIO') || type === 'SUB') type = 'SUB';
            
            result.events.push({
                type,
                minute,
                team: null // Could be enhanced
            });
        }

    } catch (e) {
        console.error('Promiedos parse error:', e);
    }

    return result;
}

/**
 * Parse Wikipedia content (existing mock logic)
 */
function parseWikipedia(content, matchId) {
    return {
        source: 'WIKIPEDIA',
        match_id: matchId,
        status: 'SCHEDULED',
        score: { home: null, away: null },
        lineups: null,
        events: [],
        mvp_player: null
    };
}

/**
 * Parse FIFA content (existing mock logic)
 */
function parseFIFA(content, matchId) {
    return {
        source: 'FIFA',
        match_id: matchId,
        status: 'SCHEDULED',
        score: { home: null, away: null },
        lineups: null,
        events: [],
        mvp_player: null
    };
}

/**
 * Cross-check sources and update MatchValidation
 * Source priority: PRIMARY (PROMIEDOS) > FALLBACK (WIKIPEDIA)
 */
async function crossCheckAndValidate(base44, matchId) {
    // Get recent events for this match
    const events = await base44.asServiceRole.entities.IngestionEvent.filter(
        { match_id: matchId },
        '-fetched_at',
        10
    );

    if (events.length === 0) return false;

    // Parse the latest successful events
    const successfulEvents = events.filter(e => e.parse_status === 'OK');
    if (successfulEvents.length === 0) return false;

    const parsedData = successfulEvents.map(e => {
        try {
            return JSON.parse(e.parsed_json);
        } catch {
            return null;
        }
    }).filter(d => d !== null);

    if (parsedData.length === 0) return false;

    // Separate sources: PRIMARY (PROMIEDOS) and FALLBACK (WIKIPEDIA)
    const primaryData = parsedData.find(d => d.source === 'PROMIEDOS');
    const fallbackData = parsedData.find(d => d.source === 'WIKIPEDIA');

    // If no data from either source, skip
    if (!primaryData && !fallbackData) return false;

    // Determine status and score candidates
    let statusCandidate = primaryData?.status || fallbackData?.status || 'SCHEDULED';
    let scoreHomeCandidate = primaryData?.score?.home ?? fallbackData?.score?.home ?? null;
    let scoreAwayCandidate = primaryData?.score?.away ?? fallbackData?.score?.away ?? null;
    let confidenceScore = 0;
    const reasons = [];

    // Confidence rules based on PRIMARY/FALLBACK logic
    if (primaryData && primaryData.status === 'FINAL' && primaryData.score.home !== null) {
        // Rule 1: PRIMARY indicates FINAL with score
        confidenceScore = 80;
        reasons.push('PRIMARY (PROMIEDOS) reports FINAL status with score');

        // Rule 2: PRIMARY FINAL + FALLBACK FINAL match
        if (fallbackData && fallbackData.status === 'FINAL' && 
            fallbackData.score.home === primaryData.score.home &&
            fallbackData.score.away === primaryData.score.away) {
            confidenceScore = 100;
            reasons.push('PRIMARY and FALLBACK scores match');
        }
        // Rule 4: PRIMARY FINAL + FALLBACK conflict
        else if (fallbackData && fallbackData.status === 'FINAL' &&
                 fallbackData.score.home !== null &&
                 (fallbackData.score.home !== primaryData.score.home ||
                  fallbackData.score.away !== primaryData.score.away)) {
            confidenceScore = 0;
            reasons.push('CONFLICT: PRIMARY and FALLBACK final scores differ');
            reasons.push(`PRIMARY: ${primaryData.score.home}-${primaryData.score.away}`);
            reasons.push(`FALLBACK: ${fallbackData.score.home}-${fallbackData.score.away}`);
        }
        // Rule 3: PRIMARY FINAL but FALLBACK missing (already handled by default 80)
    } 
    // Rule 5: Only FALLBACK available and FINAL
    else if (!primaryData && fallbackData && fallbackData.status === 'FINAL' && fallbackData.score.home !== null) {
        confidenceScore = 70;
        statusCandidate = fallbackData.status;
        scoreHomeCandidate = fallbackData.score.home;
        scoreAwayCandidate = fallbackData.score.away;
        reasons.push('Only FALLBACK (WIKIPEDIA) available with FINAL status');
    }
    // Rule 6: Not FINAL - keep as LIVE/SCHEDULED
    else {
        if (primaryData) {
            confidenceScore = 50;
            reasons.push(`PRIMARY status: ${primaryData.status}`);
        } else if (fallbackData) {
            confidenceScore = 40;
            reasons.push(`FALLBACK status: ${fallbackData.status}`);
        }
    }

    // Check if validation already exists
    const existingValidations = await base44.asServiceRole.entities.MatchValidation.filter({
        match_id: matchId
    });

    const validationData = {
        match_id: matchId,
        status_candidate: statusCandidate,
        score_candidate_home: scoreHomeCandidate,
        score_candidate_away: scoreAwayCandidate,
        confidence_score: confidenceScore,
        reasons_json: JSON.stringify(reasons)
    };

    if (existingValidations.length > 0 && !existingValidations[0].locked_final) {
        // Update existing unlocked validation
        await base44.asServiceRole.entities.MatchValidation.update(
            existingValidations[0].id,
            validationData
        );
    } else if (existingValidations.length === 0) {
        // Create new validation
        await base44.asServiceRole.entities.MatchValidation.create(validationData);
    }

    return true;
}