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
 * Parse match data (mock implementation - would need real parsing logic)
 */
function parseMatchData(content, sourceName, matchId) {
    // Mock parser - in production this would parse HTML/JSON from FIFA or Wikipedia
    // For now, return a normalized structure
    return {
        source: sourceName.toUpperCase().includes('FIFA') ? 'FIFA' : 'WIKIPEDIA',
        match_id: matchId,
        status: 'SCHEDULED', // Would parse from content
        score: { home: null, away: null },
        lineups: {
            home: { starters: [], bench: [] },
            away: { starters: [], bench: [] }
        },
        events: [],
        mvp_player: null,
        _note: 'Mock parser - needs real implementation'
    };
}

/**
 * Cross-check sources and update MatchValidation
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

    // Separate FIFA and Wikipedia data
    const fifaData = parsedData.find(d => d.source === 'FIFA');
    const wikiData = parsedData.find(d => d.source === 'WIKIPEDIA');

    // Calculate confidence scores
    let statusCandidate = fifaData?.status || wikiData?.status || 'SCHEDULED';
    let scoreHomeCandidate = fifaData?.score?.home ?? wikiData?.score?.home ?? null;
    let scoreAwayCandidate = fifaData?.score?.away ?? wikiData?.score?.away ?? null;
    let confidenceScore = 0;
    const reasons = [];

    // Score confidence logic
    if (fifaData && wikiData) {
        if (fifaData.score.home === wikiData.score.home && 
            fifaData.score.away === wikiData.score.away &&
            fifaData.score.home !== null) {
            confidenceScore = 100;
            reasons.push('FIFA and Wikipedia scores match');
        } else if (fifaData.score.home !== null) {
            confidenceScore = 70;
            reasons.push('FIFA score available, Wikipedia mismatch');
        } else if (wikiData.score.home !== null) {
            confidenceScore = 60;
            reasons.push('Only Wikipedia score available');
        }
    } else if (fifaData && fifaData.score.home !== null) {
        confidenceScore = 70;
        reasons.push('Only FIFA score available');
    } else if (wikiData && wikiData.score.home !== null) {
        confidenceScore = 60;
        reasons.push('Only Wikipedia score available');
    }

    // Status confidence
    if (fifaData?.status === 'FINAL' && wikiData?.status === 'FINAL') {
        confidenceScore = Math.max(confidenceScore, 100);
        reasons.push('Both sources report FINAL status');
    } else if (fifaData?.status === 'FINAL') {
        confidenceScore = Math.max(confidenceScore, 70);
        reasons.push('FIFA reports FINAL status');
    } else if (wikiData?.status === 'FINAL') {
        confidenceScore = Math.max(confidenceScore, 60);
        reasons.push('Wikipedia reports FINAL status');
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
        // Update existing
        await base44.asServiceRole.entities.MatchValidation.update(
            existingValidations[0].id,
            validationData
        );
    } else if (existingValidations.length === 0) {
        // Create new
        await base44.asServiceRole.entities.MatchValidation.create(validationData);
    }

    return true;
}