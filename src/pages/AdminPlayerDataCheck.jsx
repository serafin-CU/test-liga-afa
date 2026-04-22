import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, TrendingUp, ChevronUp, ChevronDown, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const POS_COLORS = { GK: '#475CC7', DEF: '#218848', MID: '#9a6e00', FWD: '#AA0061' };

function StatCard({ label, value, accent = '#475CC7', sub }) {
    return (
        <div className="bg-white rounded-xl p-4 border" style={{ borderTop: `3px solid ${accent}` }}>
            <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
            <div className="text-2xl font-bold" style={{ color: '#2C2B2B' }}>{value ?? '—'}</div>
            {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
    );
}

function SortIcon({ field, sortField, sortDir }) {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-gray-300 inline ml-1" />;
    return sortDir === 'asc'
        ? <ChevronUp className="w-3 h-3 text-blue-500 inline ml-1" />
        : <ChevronDown className="w-3 h-3 text-blue-500 inline ml-1" />;
}

export default function AdminPlayerDataCheck() {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState('price');
    const [sortDir, setSortDir] = useState('desc');
    const [page, setPage] = useState(0);
    const [deduping, setDeduping] = useState(false);
    const [dedupeResult, setDedupeResult] = useState(null);
    const PAGE_SIZE = 20;
    const queryClient = useQueryClient();

    const { data: players = [], isLoading } = useQuery({
        queryKey: ['adminAllPlayers'],
        queryFn: () => base44.entities.Player.list(undefined, 3000)
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);

    // ── Stats ───────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        if (!players.length) return null;
        const withPrice = players.filter(p => p.price != null && p.price > 0);
        const prices = withPrice.map(p => p.price);
        const avg = prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(1) : 0;
        return {
            total: players.length,
            withPrice: withPrice.length,
            withoutPrice: players.length - withPrice.length,
            min: prices.length ? Math.min(...prices) : 0,
            max: prices.length ? Math.max(...prices) : 0,
            avg,
        };
    }, [players]);

    // ── Price histogram ─────────────────────────────────────────────────────
    const histogram = useMemo(() => {
        const buckets = {};
        for (const p of players) {
            const price = p.price ?? 0;
            buckets[price] = (buckets[price] || 0) + 1;
        }
        return Object.entries(buckets)
            .map(([price, count]) => ({ price: Number(price), count }))
            .sort((a, b) => a.price - b.price);
    }, [players]);

    // ── Field inspector ─────────────────────────────────────────────────────
    const fieldStats = useMemo(() => {
        const counts = {};
        for (const p of players) {
            for (const key of Object.keys(p)) {
                if (!counts[key]) counts[key] = { present: 0, missing: 0 };
                if (p[key] != null && p[key] !== '') counts[key].present++;
                else counts[key].missing++;
            }
        }
        return Object.entries(counts)
            .map(([field, c]) => ({ field, ...c }))
            .sort((a, b) => b.present - a.present);
    }, [players]);

    // ── Validation warnings ─────────────────────────────────────────────────
    const warnings = useMemo(() => {
        const overpriced = players.filter(p => p.price > 100);
        const zeroPriced = players.filter(p => !p.price || p.price === 0);
        const nameCounts = {};
        for (const p of players) nameCounts[p.full_name] = (nameCounts[p.full_name] || 0) + 1;
        const duplicates = players.filter(p => nameCounts[p.full_name] > 1);
        return { overpriced, zeroPriced, duplicates };
    }, [players]);

    // ── Sorted & filtered table ─────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return players.filter(p =>
            !q ||
            (p.full_name || '').toLowerCase().includes(q) ||
            (teamsMap[p.team_id]?.name || '').toLowerCase().includes(q) ||
            (p.position || '').toLowerCase().includes(q)
        );
    }, [players, search, teamsMap]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const va = a[sortField] ?? '';
            const vb = b[sortField] ?? '';
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDir === 'asc' ? va - vb : vb - va;
            }
            return sortDir === 'asc'
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    }, [filtered, sortField, sortDir]);

    const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const handleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
        setPage(0);
    };

    const handleDeduplicatePlayers = async () => {
        if (!window.confirm(
            `This will find all players with duplicate names and delete the ones WITHOUT an api_player_id (keeping the API-sourced version).\n\nIf ALL duplicates lack an api_player_id, the one with the most recent created_date is kept.\n\nContinue?`
        )) return;

        setDeduping(true);
        setDedupeResult(null);

        try {
            // Group by full_name
            const nameGroups = {};
            for (const p of players) {
                if (!nameGroups[p.full_name]) nameGroups[p.full_name] = [];
                nameGroups[p.full_name].push(p);
            }

            const toDelete = [];
            for (const [name, group] of Object.entries(nameGroups)) {
                if (group.length <= 1) continue;

                // Sort: API players first (have api_player_id), then by newest created_date
                const sorted = [...group].sort((a, b) => {
                    const aHasApi = !!a.api_player_id;
                    const bHasApi = !!b.api_player_id;
                    if (aHasApi && !bHasApi) return -1;
                    if (!aHasApi && bHasApi) return 1;
                    return new Date(b.created_date) - new Date(a.created_date);
                });

                // Keep the first (best), delete the rest
                const [_keep, ...rest] = sorted;
                toDelete.push(...rest);
            }

            // Delete in batches
            let deleted = 0;
            for (const p of toDelete) {
                await base44.entities.Player.delete(p.id);
                deleted++;
            }

            setDedupeResult({ deleted, total: toDelete.length });
            queryClient.invalidateQueries({ queryKey: ['adminAllPlayers'] });
        } catch (err) {
            setDedupeResult({ error: err.message });
        } finally {
            setDeduping(false);
        }
    };

    const Th = ({ field, label }) => (
        <th
            className="px-3 py-2 text-left text-xs font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-gray-800"
            onClick={() => handleSort(field)}
        >
            {label}<SortIcon field={field} sortField={sortField} sortDir={sortDir} />
        </th>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Users className="w-7 h-7 text-blue-500" /> Player Data Check
                </h1>
                <p className="text-gray-500 mt-1">Inspect all player records, prices and data quality</p>
            </div>

            {/* ── Summary Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Players" value={stats?.total} accent="#475CC7" />
                <StatCard label="With Price" value={stats?.withPrice} accent="#218848" />
                <StatCard label="Without Price" value={stats?.withoutPrice} accent="#dc2626" />
                <StatCard label="Min Price" value={stats?.min ? `$${stats.min}M` : '—'} accent="#9a6e00" />
                <StatCard label="Max Price" value={stats?.max ? `$${stats.max}M` : '—'} accent="#AA0061" />
                <StatCard label="Avg Price" value={stats?.avg ? `$${stats.avg}M` : '—'} accent="#6366f1" />
            </div>

            {/* ── Price Histogram ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="w-4 h-4 text-blue-500" /> Price Distribution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={histogram} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                            <XAxis dataKey="price" tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v, n, p) => [v, `Players at $${p.payload.price}M`]} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                                {histogram.map((entry) => (
                                    <Cell
                                        key={entry.price}
                                        fill={entry.price > 100 ? '#dc2626' : entry.price === 0 ? '#9ca3af' : '#475CC7'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-600 mr-1" />Normal</span>
                        <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-400 mr-1" />Price = 0</span>
                        <span><span className="inline-block w-3 h-3 rounded-sm bg-red-500 mr-1" />&gt;$100 (wrong)</span>
                    </div>
                </CardContent>
            </Card>

            {/* ── Validation Warnings ── */}
            {(warnings.overpriced.length > 0 || warnings.zeroPriced.length > 0 || warnings.duplicates.length > 0) && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base text-amber-800">
                            <AlertCircle className="w-4 h-4" /> Validation Warnings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {warnings.overpriced.length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-red-700 mb-1">⚠ Price &gt; 100 (probably stored wrong): {warnings.overpriced.length} players</div>
                                <div className="flex flex-wrap gap-1">
                                    {warnings.overpriced.slice(0, 20).map(p => (
                                        <Badge key={p.id} variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                                            {p.full_name} (${p.price})
                                        </Badge>
                                    ))}
                                    {warnings.overpriced.length > 20 && <Badge variant="outline" className="text-xs">+{warnings.overpriced.length - 20} more</Badge>}
                                </div>
                            </div>
                        )}
                        {warnings.zeroPriced.length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-amber-700 mb-1">⚠ Price = 0 or missing: {warnings.zeroPriced.length} players</div>
                                <div className="flex flex-wrap gap-1">
                                    {warnings.zeroPriced.slice(0, 20).map(p => (
                                        <Badge key={p.id} variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                            {p.full_name}
                                        </Badge>
                                    ))}
                                    {warnings.zeroPriced.length > 20 && <Badge variant="outline" className="text-xs">+{warnings.zeroPriced.length - 20} more</Badge>}
                                </div>
                            </div>
                        )}
                        {warnings.duplicates.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                    <div className="text-sm font-semibold text-amber-700">⚠ Duplicate names: {warnings.duplicates.length} players ({[...new Set(warnings.duplicates.map(p => p.full_name))].length} unique names)</div>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={deduping}
                                        onClick={handleDeduplicatePlayers}
                                        className="gap-1 h-7 text-xs"
                                    >
                                        {deduping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        Delete Non-API Duplicates
                                    </Button>
                                </div>
                                {dedupeResult && !dedupeResult.error && (
                                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                                        <CheckCircle2 className="w-3 h-3" /> Deleted {dedupeResult.deleted} duplicate players. Refresh to update stats.
                                    </div>
                                )}
                                {dedupeResult?.error && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                                        Error: {dedupeResult.error}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-1">
                                    {[...new Set(warnings.duplicates.map(p => p.full_name))].slice(0, 20).map(name => (
                                        <Badge key={name} variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                            {name}
                                        </Badge>
                                    ))}
                                    {[...new Set(warnings.duplicates.map(p => p.full_name))].length > 20 && (
                                        <Badge variant="outline" className="text-xs">+{[...new Set(warnings.duplicates.map(p => p.full_name))].length - 20} more</Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Field Inspector ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Field Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {fieldStats.map(({ field, present, missing }) => {
                            const pct = stats?.total ? Math.round((present / stats.total) * 100) : 0;
                            return (
                                <div key={field} className="text-xs bg-gray-50 border rounded-lg p-2">
                                    <div className="font-mono font-semibold text-gray-700 mb-1 truncate">{field}</div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#218848' : pct > 50 ? '#9a6e00' : '#dc2626' }} />
                                        </div>
                                        <span className="font-medium" style={{ color: pct === 100 ? '#218848' : pct > 50 ? '#9a6e00' : '#dc2626' }}>{pct}%</span>
                                    </div>
                                    <div className="text-gray-400">{present} / {present + missing}</div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* ── Player Table ── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-base">Players ({sorted.length})</CardTitle>
                        <Input
                            placeholder="Search by name, team, position..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(0); }}
                            className="w-64 h-8 text-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <Th field="full_name" label="Name" />
                                    <Th field="team_id" label="Team" />
                                    <Th field="position" label="Pos" />
                                    <Th field="price" label="Price" />
                                    <Th field="is_active" label="Active" />
                                    <Th field="api_player_id" label="API ID" />
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Inactive Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(p => {
                                    const team = teamsMap[p.team_id];
                                    const posColor = POS_COLORS[p.position] || '#6b7280';
                                    const priceWrong = p.price > 100;
                                    const priceMissing = !p.price || p.price === 0;
                                    return (
                                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium max-w-[180px] truncate">{p.full_name}</td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">{team?.name || <span className="text-red-400">Unknown</span>}</td>
                                            <td className="px-3 py-2">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: posColor + '20', color: posColor }}>
                                                    {p.position || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`font-mono font-semibold ${priceWrong ? 'text-red-600' : priceMissing ? 'text-gray-400' : 'text-gray-800'}`}>
                                                    {p.price != null ? `$${p.price}M` : '—'}
                                                    {priceWrong && ' ⚠'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`text-xs font-semibold ${p.is_active !== false ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {p.is_active !== false ? '✓' : '✗'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-400 font-mono">{p.api_player_id || '—'}</td>
                                            <td className="px-3 py-2 text-xs text-gray-400 max-w-[160px] truncate">{p.inactive_reason || '—'}</td>
                                        </tr>
                                    );
                                })}
                                {paginated.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">No players found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
                            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}</span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                                >← Prev</button>
                                <button
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                                >Next →</button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}