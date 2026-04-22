import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Microscope, Hash } from 'lucide-react';

// ── Mirror of the backend algorithm ──────────────────────────────────────────

function calculateSkillScoreBreakdown(playerInfo, stats) {
    const steps = [];
    let score = 50;
    steps.push({ label: 'Base score', delta: 50, running: 50 });

    const age = playerInfo?.age ?? 27;
    let ageDelta = 0;
    if (age >= 25 && age <= 29) ageDelta = 10;
    else if (age >= 22 && age <= 31) ageDelta = 5;
    else if (age < 20 || age > 33) ageDelta = -10;
    score += ageDelta;
    steps.push({ label: `Age factor (age ${age})`, delta: ageDelta, running: score });

    const rating = parseFloat(stats?.games?.rating) || 6.5;
    let ratingDelta = 0;
    if (rating >= 7.5) ratingDelta = 20;
    else if (rating >= 7.0) ratingDelta = 15;
    else if (rating >= 6.8) ratingDelta = 10;
    else if (rating >= 6.5) ratingDelta = 5;
    else if (rating < 6.0) ratingDelta = -15;
    score += ratingDelta;
    steps.push({ label: `Rating factor (rating ${rating})`, delta: ratingDelta, running: score });

    const goals = stats?.goals?.total || 0;
    const assists = stats?.goals?.assists || 0;
    const contributions = goals + assists;
    let gaDelta = 0;
    if (contributions >= 15) gaDelta = 15;
    else if (contributions >= 8) gaDelta = 10;
    else if (contributions >= 4) gaDelta = 5;
    score += gaDelta;
    steps.push({ label: `G+A factor (${goals}G + ${assists}A = ${contributions})`, delta: gaDelta, running: score });

    const apps = stats?.games?.appearences || 0;
    let appsDelta = 0;
    if (apps >= 20) appsDelta = 10;
    else if (apps >= 10) appsDelta = 5;
    else if (apps < 3) appsDelta = -10;
    score += appsDelta;
    steps.push({ label: `Appearances factor (${apps} apps)`, delta: appsDelta, running: score });

    const skillScore = Math.max(1, Math.min(100, score));
    return { steps, skillScore, rating, goals, assists, apps };
}

function skillToPrice(score, position) {
    let price = 4;
    if (score >= 90) price = 12;
    else if (score >= 85) price = 11;
    else if (score >= 80) price = 10;
    else if (score >= 75) price = 9;
    else if (score >= 70) price = 8;
    else if (score >= 65) price = 7;
    else if (score >= 60) price = 6;
    else if (score >= 55) price = 5;
    else price = 4;

    let posAdj = 0;
    if (position === 'FWD' && score >= 75) posAdj = 1;
    if (position === 'GK') price = Math.min(10, price);

    const finalPrice = Math.min(12, Math.max(4, price + posAdj));
    return { price: finalPrice, posAdj };
}

// ── Per-90 and participation helpers ─────────────────────────────────────────

function per90(value, minutes) {
    if (!minutes || minutes < 1) return null;
    return ((value / minutes) * 90).toFixed(2);
}

function ratingLabel(rating) {
    const r = parseFloat(rating);
    if (!r) return null;
    if (r >= 7.5) return { label: 'Elite', color: 'text-green-700' };
    if (r >= 7.0) return { label: 'Good', color: 'text-blue-600' };
    if (r >= 6.5) return { label: 'Average', color: 'text-gray-600' };
    if (r >= 6.0) return { label: 'Below avg', color: 'text-amber-600' };
    return { label: 'Poor', color: 'text-red-600' };
}

function ageCurveLabel(age) {
    if (!age) return null;
    if (age >= 25 && age <= 29) return { label: 'Peak (25–29)', color: 'text-green-700' };
    if (age >= 22 && age <= 31) return { label: 'Prime (22–31)', color: 'text-blue-600' };
    if (age < 20) return { label: 'Prospect (<20)', color: 'text-amber-600' };
    if (age > 33) return { label: 'Decline (>33)', color: 'text-red-600' };
    return { label: 'Fringe', color: 'text-gray-500' };
}

// ─────────────────────────────────────────────────────────────────────────────

function StatRow({ label, value }) {
    return (
        <div className="flex justify-between py-1 border-b border-gray-100 last:border-0 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-mono font-semibold text-gray-800">{value ?? '—'}</span>
        </div>
    );
}

function AlgoStep({ label, delta, running }) {
    const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400';
    const sign = delta > 0 ? '+' : '';
    return (
        <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0 text-sm">
            <span className="text-gray-600">{label}</span>
            <div className="flex items-center gap-3">
                <span className={`font-mono font-bold ${color}`}>{sign}{delta}</span>
                <span className="text-xs text-gray-400 font-mono w-8 text-right">= {running}</span>
            </div>
        </div>
    );
}

function DisambiguationTable({ matches, teamsMap, onSelect }) {
    return (
        <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50">
            <div className="px-4 py-2 bg-amber-100 text-xs font-bold text-amber-800 uppercase tracking-wide">
                Multiple players match — select one:
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-amber-200 text-xs text-amber-700 font-semibold">
                        <th className="text-left px-4 py-2">Name</th>
                        <th className="text-left px-4 py-2">Team</th>
                        <th className="text-left px-4 py-2">Pos</th>
                        <th className="text-left px-4 py-2">API ID</th>
                        <th className="text-left px-4 py-2">Price</th>
                        <th className="px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {matches.map(p => (
                        <tr key={p.id} className="border-b border-amber-100 last:border-0 hover:bg-amber-100 transition-colors">
                            <td className="px-4 py-2 font-medium text-gray-800">{p.full_name}</td>
                            <td className="px-4 py-2 text-gray-600">{teamsMap[p.team_id]?.name ?? '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{p.position}</td>
                            <td className="px-4 py-2 font-mono text-gray-500">{p.api_player_id ?? '—'}</td>
                            <td className="px-4 py-2 font-mono text-gray-700">{p.price != null ? `$${p.price}M` : '—'}</td>
                            <td className="px-4 py-2">
                                <Button size="sm" variant="outline" onClick={() => onSelect(p)}
                                    className="text-xs border-amber-400 text-amber-700 hover:bg-amber-200">
                                    Select
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DiagnosticResult({ result, teamsMap }) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-lg font-bold text-gray-800 border-b pb-2">
                {result.dbPlayer ? result.dbPlayer.full_name : <span className="text-gray-400 italic">Player not in database</span>}
                {result.dbPlayer && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                        {teamsMap[result.dbPlayer.team_id]?.name} · {result.dbPlayer.position}
                    </span>
                )}
            </div>

            {/* Side by side: DB vs API */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: DB */}
                <div className="bg-gray-50 rounded-xl border p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Database (current)</div>
                    {!result.dbPlayer ? (
                        <div className="text-sm text-red-500 italic">No record found in database for this API player ID.</div>
                    ) : (
                        <>
                            <StatRow label="Full name" value={result.dbPlayer.full_name} />
                            <StatRow label="Team" value={teamsMap[result.dbPlayer.team_id]?.name} />
                            <StatRow label="Position" value={result.dbPlayer.position} />
                            <StatRow label="Current price" value={result.dbPlayer.price != null ? `$${result.dbPlayer.price}M` : null} />
                            <StatRow label="Skill score (stored)" value={result.dbPlayer.skill_score} />
                            <StatRow label="Age (stored)" value={result.dbPlayer.age} />
                            <StatRow label="Nationality (stored)" value={result.dbPlayer.nationality} />
                            <StatRow label="API player ID" value={result.dbPlayer.api_player_id} />
                        </>
                    )}
                </div>

                {/* RIGHT: API */}
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                    <div className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-3">API-Football Response</div>
                    {!result.apiPlayer ? (
                        <div className="text-sm text-red-500">No data returned from API for this player/season.</div>
                    ) : (
                        <>
                            <div className="text-xs font-semibold text-gray-600 mb-2">Player Info</div>
                            <StatRow label="Age" value={result.playerInfo.age} />
                            <StatRow label="Nationality" value={result.playerInfo.nationality} />
                            <StatRow label="Height" value={result.playerInfo.height} />
                            <StatRow label="Weight" value={result.playerInfo.weight} />

                            {result.stats && (() => {
                                const s = result.stats;
                                const apps = s.games?.appearences || 0;
                                const mins = s.games?.minutes || 0;
                                const goals = s.goals?.total || 0;
                                const assists = s.goals?.assists || 0;
                                const rating = parseFloat(s.games?.rating) || null;
                                const leagueGames = 30;
                                const participationPct = leagueGames > 0 ? Math.round((apps / leagueGames) * 100) : null;
                                const minsPerGame = apps > 0 ? Math.round(mins / apps) : null;
                                const g90 = per90(goals, mins);
                                const a90 = per90(assists, mins);
                                const rl = ratingLabel(rating);
                                const al = ageCurveLabel(result.playerInfo.age);
                                return (
                                    <>
                                        <div className="text-xs font-semibold text-gray-600 mt-3 mb-2">Statistics — Season 2026</div>

                                        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-2 mb-1">Participation</div>
                                        <StatRow label="Appearances (raw)" value={apps || '—'} />
                                        <StatRow label="% of possible games" value={participationPct != null ? `${participationPct}% (${apps}/30)` : '—'} />
                                        <StatRow label="Total minutes" value={mins || '—'} />
                                        <StatRow label="Avg min/game" value={minsPerGame != null ? `${minsPerGame} min` : '—'} />

                                        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-3 mb-1">Per-90 Metrics</div>
                                        <StatRow label="Goals/90" value={g90 ?? '—'} />
                                        <StatRow label="Assists/90" value={a90 ?? '—'} />
                                        <StatRow label="G+A/90" value={(g90 != null && a90 != null) ? (parseFloat(g90) + parseFloat(a90)).toFixed(2) : '—'} />

                                        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-3 mb-1">Quality</div>
                                        <div className="flex justify-between py-1 border-b border-gray-100 text-sm">
                                            <span className="text-gray-500">Rating</span>
                                            <span className="flex items-center gap-2">
                                                <span className="font-mono font-semibold text-gray-800">{rating ?? '—'}</span>
                                                {rl && <span className={`text-xs font-bold ${rl.color}`}>{rl.label}</span>}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-gray-100 text-sm">
                                            <span className="text-gray-500">Age curve</span>
                                            <span className="flex items-center gap-2">
                                                <span className="font-mono font-semibold text-gray-800">{result.playerInfo.age ?? '—'}</span>
                                                {al && <span className={`text-xs font-bold ${al.color}`}>{al.label}</span>}
                                            </span>
                                        </div>

                                        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-3 mb-1">Other (raw totals)</div>
                                        <StatRow label="Goals conceded" value={s.goals?.conceded} />
                                        <StatRow label="Shots total / on target" value={`${s.shots?.total ?? '—'} / ${s.shots?.on ?? '—'}`} />
                                        <StatRow label="Passes total / accuracy" value={`${s.passes?.total ?? '—'} / ${s.passes?.accuracy ?? '—'}%`} />
                                        <StatRow label="Key passes" value={s.passes?.key} />
                                        <StatRow label="Tackles" value={s.tackles?.total} />
                                        <StatRow label="Yellow / Red cards" value={`${s.cards?.yellow ?? 0} / ${s.cards?.red ?? 0}`} />
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>

            {/* Algorithm Breakdown — only if we have a DB player */}
            {result.dbPlayer && (
                <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Algorithm Breakdown</div>
                    {result.steps.map((step, i) => (
                        <AlgoStep key={i} label={step.label} delta={step.delta} running={step.running} />
                    ))}
                    <div className="mt-3 pt-3 border-t border-indigo-200 flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total skill score (clamped 1–100)</span>
                        <span className="font-mono text-xl font-bold text-indigo-700">{result.skillScore}</span>
                    </div>
                    {result.posAdj !== 0 && (
                        <div className="flex justify-between items-center mt-1 text-sm">
                            <span className="text-gray-500">Position adjustment ({result.dbPlayer.position})</span>
                            <span className={`font-mono font-bold ${result.posAdj > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {result.posAdj > 0 ? '+' : ''}{result.posAdj}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-200">
                        <span className="font-semibold text-gray-700">Computed price</span>
                        <span className="font-mono text-xl font-bold text-green-700">${result.computedPrice}M</span>
                    </div>
                    {result.computedPrice !== result.dbPlayer.price && (
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            ⚠ Stored price (${result.dbPlayer.price}M) differs from computed price (${result.computedPrice}M) — price may not have been recalculated yet.
                        </div>
                    )}
                    {result.computedPrice === result.dbPlayer.price && (
                        <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            ✓ Stored price matches computed price.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

async function fetchDiagnostic(dbPlayer, apiPlayerId) {
    const res = await base44.functions.invoke('apiFutbol', {
        action: 'get_player_info',
        player_id: apiPlayerId,
        season: 2026,
    });
    const apiPlayer = res.data?.response?.[0] ?? null;
    const stats = apiPlayer?.statistics?.[0] ?? {};
    const playerInfo = apiPlayer?.player ?? {};

    if (dbPlayer) {
        const { steps, skillScore } = calculateSkillScoreBreakdown(playerInfo, stats);
        const { price: computedPrice, posAdj } = skillToPrice(skillScore, dbPlayer.position);
        return { dbPlayer, apiPlayer, stats, playerInfo, steps, skillScore, computedPrice, posAdj };
    }
    // No DB player — still show API data, no algo breakdown
    return { dbPlayer: null, apiPlayer, stats, playerInfo, steps: [], skillScore: null, computedPrice: null, posAdj: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerDeepDive({ players, teamsMap }) {
    const [nameQuery, setNameQuery] = useState('');
    const [apiIdQuery, setApiIdQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [ambiguous, setAmbiguous] = useState(null); // array of matching players

    const reset = () => { setResult(null); setError(null); setAmbiguous(null); };

    const runDiagnostic = async (dbPlayer, apiPlayerId) => {
        setLoading(true);
        setAmbiguous(null);
        setResult(null);
        setError(null);
        try {
            const r = await fetchDiagnostic(dbPlayer, apiPlayerId);
            setResult(r);
        } catch (err) {
            setError(`API error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleInspectByName = async () => {
        reset();
        const q = nameQuery.trim().toLowerCase();
        if (!q) return;

        const matches = players.filter(p => (p.full_name || '').toLowerCase().includes(q));
        if (matches.length === 0) {
            setError(`No player found matching "${nameQuery}"`);
            return;
        }
        if (matches.length > 1) {
            setAmbiguous(matches);
            return;
        }
        const match = matches[0];
        if (!match.api_player_id) {
            setError(`Player "${match.full_name}" has no api_player_id — cannot fetch API data.`);
            return;
        }
        await runDiagnostic(match, match.api_player_id);
    };

    const handleInspectByApiId = async () => {
        reset();
        const id = apiIdQuery.trim();
        if (!id) return;

        // Find DB player (exact match on api_player_id)
        const dbPlayer = players.find(p => String(p.api_player_id) === id) ?? null;
        if (!dbPlayer) {
            // Show notice but still make the API call
            setError(`No player in database with api_player_id = ${id} — showing API data only.`);
        }
        await runDiagnostic(dbPlayer, id);
    };

    const handleSelectAmbiguous = async (player) => {
        setAmbiguous(null);
        if (!player.api_player_id) {
            setError(`Player "${player.full_name}" has no api_player_id — cannot fetch API data.`);
            return;
        }
        await runDiagnostic(player, player.api_player_id);
    };

    return (
        <Card className="border-indigo-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-indigo-700">
                    <Microscope className="w-4 h-4" /> Player Stats Deep Dive
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search by name */}
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Search by player name (partial match):</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. Paredes, Messi, De Paul..."
                            value={nameQuery}
                            onChange={e => setNameQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleInspectByName()}
                            className="flex-1"
                        />
                        <Button onClick={handleInspectByName} disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Inspect Player
                        </Button>
                    </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <div className="flex-1 border-t border-gray-200" />
                    <span>or</span>
                    <div className="flex-1 border-t border-gray-200" />
                </div>

                {/* Search by API ID */}
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Search by API Player ID (exact match):</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. 2937"
                            type="number"
                            value={apiIdQuery}
                            onChange={e => setApiIdQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleInspectByApiId()}
                            className="flex-1"
                        />
                        <Button onClick={handleInspectByApiId} disabled={loading} variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                            Inspect by API ID
                        </Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                )}

                {/* Disambiguation table */}
                {ambiguous && (
                    <DisambiguationTable matches={ambiguous} teamsMap={teamsMap} onSelect={handleSelectAmbiguous} />
                )}

                {/* Results */}
                {result && <DiagnosticResult result={result} teamsMap={teamsMap} />}
            </CardContent>
        </Card>
    );
}