import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Microscope } from 'lucide-react';

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

export default function PlayerDeepDive({ players, teamsMap }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleInspect = async () => {
        setError(null);
        setResult(null);

        const q = query.trim().toLowerCase();
        if (!q) return;

        const match = players.find(p => (p.full_name || '').toLowerCase().includes(q));
        if (!match) {
            setError(`No player found matching "${query}"`);
            return;
        }
        if (!match.api_player_id) {
            setError(`Player "${match.full_name}" has no api_player_id — cannot fetch API data.`);
            return;
        }

        setLoading(true);
        try {
            const res = await base44.functions.invoke('apiFutbol', {
                action: 'get_player_info',
                player_id: match.api_player_id,
                season: 2026,
            });
            const apiPlayer = res.data?.response?.[0] ?? null;

            const stats = apiPlayer?.statistics?.[0] ?? {};
            const playerInfo = apiPlayer?.player ?? {};

            const { steps, skillScore } = calculateSkillScoreBreakdown(playerInfo, stats);
            const { price: computedPrice, posAdj } = skillToPrice(skillScore, match.position);

            setResult({ dbPlayer: match, apiPlayer, stats, playerInfo, steps, skillScore, computedPrice, posAdj });
        } catch (err) {
            setError(`API error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-indigo-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-indigo-700">
                    <Microscope className="w-4 h-4" /> Player Stats Deep Dive
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search row */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Search player by name (partial match)..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleInspect()}
                        className="flex-1"
                    />
                    <Button onClick={handleInspect} disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Inspect Player
                    </Button>
                </div>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                )}

                {result && (
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="text-lg font-bold text-gray-800 border-b pb-2">
                            {result.dbPlayer.full_name}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                {teamsMap[result.dbPlayer.team_id]?.name} · {result.dbPlayer.position}
                            </span>
                        </div>

                        {/* Side by side: DB vs API */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* LEFT: DB */}
                            <div className="bg-gray-50 rounded-xl border p-4">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Database (current)</div>
                                <StatRow label="Full name" value={result.dbPlayer.full_name} />
                                <StatRow label="Team" value={teamsMap[result.dbPlayer.team_id]?.name} />
                                <StatRow label="Position" value={result.dbPlayer.position} />
                                <StatRow label="Current price" value={result.dbPlayer.price != null ? `$${result.dbPlayer.price}M` : null} />
                                <StatRow label="Skill score (stored)" value={result.dbPlayer.skill_score} />
                                <StatRow label="Age (stored)" value={result.dbPlayer.age} />
                                <StatRow label="Nationality (stored)" value={result.dbPlayer.nationality} />
                                <StatRow label="API player ID" value={result.dbPlayer.api_player_id} />
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

                                        {result.stats && (
                                            <>
                                                <div className="text-xs font-semibold text-gray-600 mt-3 mb-2">Statistics (season 2026)</div>
                                                <StatRow label="Appearances" value={result.stats.games?.appearences} />
                                                <StatRow label="Minutes" value={result.stats.games?.minutes} />
                                                <StatRow label="Rating" value={result.stats.games?.rating} />
                                                <StatRow label="Goals" value={result.stats.goals?.total} />
                                                <StatRow label="Assists" value={result.stats.goals?.assists} />
                                                <StatRow label="Goals conceded" value={result.stats.goals?.conceded} />
                                                <StatRow label="Shots total" value={result.stats.shots?.total} />
                                                <StatRow label="Shots on target" value={result.stats.shots?.on} />
                                                <StatRow label="Passes total" value={result.stats.passes?.total} />
                                                <StatRow label="Passes accuracy" value={result.stats.passes?.accuracy} />
                                                <StatRow label="Key passes" value={result.stats.passes?.key} />
                                                <StatRow label="Tackles" value={result.stats.tackles?.total} />
                                                <StatRow label="Yellow cards" value={result.stats.cards?.yellow} />
                                                <StatRow label="Red cards" value={result.stats.cards?.red} />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Algorithm Breakdown */}
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
                    </div>
                )}
            </CardContent>
        </Card>
    );
}