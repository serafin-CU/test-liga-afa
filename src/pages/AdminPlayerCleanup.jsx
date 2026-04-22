import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Users, AlertCircle } from 'lucide-react';

function LogBox({ logs }) {
    const ref = useRef(null);
    React.useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [logs]);
    if (!logs.length) return null;
    return (
        <div ref={ref} className="mt-3 bg-gray-900 text-green-300 font-mono text-xs rounded-lg p-3 max-h-48 overflow-y-auto">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
    );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-bold text-gray-900 mb-2">Confirm Destructive Action</div>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">{message}</div>
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" onClick={onConfirm}>Yes, proceed</Button>
                </div>
            </div>
        </div>
    );
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function AdminPlayerCleanup() {
    const queryClient = useQueryClient();
    const [confirm, setConfirm] = useState(null); // { message, onConfirm }

    // Per-operation state
    const [op1, setOp1] = useState({ running: false, logs: [], done: false });
    const [op2, setOp2] = useState({ running: false, logs: [], done: false });
    const [op3, setOp3] = useState({ running: false, logs: [], done: false, orphans: [] });
    const [op4, setOp4] = useState({ running: false, logs: [], done: false });

    const addLog = (setter, msg) => setter(prev => ({ ...prev, logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] }));

    const { data: players = [], isLoading: playersLoading } = useQuery({
        queryKey: ['cleanupPlayers'],
        queryFn: () => base44.entities.Player.list(undefined, 3000)
    });
    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const askConfirm = (message) => new Promise(resolve => {
        setConfirm({ message, onConfirm: () => { setConfirm(null); resolve(true); }, onCancel: () => { setConfirm(null); resolve(false); } });
    });

    // ── Op 1: Delete players without api_player_id ──────────────────────────
    const handleDeleteNoApiId = async () => {
        const targets = players.filter(p => !p.api_player_id);
        const ok = await askConfirm(`This will permanently delete ${targets.length} players that have no api_player_id (old manual seeds).\n\nThis CANNOT be undone.`);
        if (!ok) return;

        setOp1({ running: true, logs: [], done: false });
        addLog(setOp1, `Found ${targets.length} players without api_player_id`);

        const BATCH = 50;
        let deleted = 0;
        for (let i = 0; i < targets.length; i += BATCH) {
            const batch = targets.slice(i, i + BATCH);
            for (const p of batch) {
                await base44.entities.Player.delete(p.id);
                deleted++;
                await sleep(150);
            }
            addLog(setOp1, `Deleted ${deleted}/${targets.length}...`);
            await sleep(300);
        }

        addLog(setOp1, `✓ Done. Deleted ${deleted} players.`);
        setOp1(prev => ({ ...prev, running: false, done: true }));
        queryClient.invalidateQueries({ queryKey: ['cleanupPlayers'] });
        queryClient.invalidateQueries({ queryKey: ['adminAllPlayers'] });
    };

    // ── Op 2: Delete duplicate players ─────────────────────────────────────
    const handleDeleteDuplicates = async () => {
        // Group by api_player_id first, then by full_name+team_id
        const byApiId = {};
        const byNameTeam = {};
        const toDelete = new Set();

        for (const p of players) {
            if (p.api_player_id) {
                if (!byApiId[p.api_player_id]) byApiId[p.api_player_id] = [];
                byApiId[p.api_player_id].push(p);
            } else {
                const key = `${p.full_name}|${p.team_id}`;
                if (!byNameTeam[key]) byNameTeam[key] = [];
                byNameTeam[key].push(p);
            }
        }

        // For api_player_id dupes: keep newest
        for (const [apiId, group] of Object.entries(byApiId)) {
            if (group.length <= 1) continue;
            const sorted = [...group].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            sorted.slice(1).forEach(p => toDelete.add(p));
        }

        // For name+team dupes: keep newest
        for (const [key, group] of Object.entries(byNameTeam)) {
            if (group.length <= 1) continue;
            const sorted = [...group].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            sorted.slice(1).forEach(p => toDelete.add(p));
        }

        const targets = [...toDelete];
        if (targets.length === 0) {
            setOp2({ running: false, logs: ['No duplicates found.'], done: true });
            return;
        }

        const ok = await askConfirm(`Found ${targets.length} duplicate player records.\n\nKeep strategy:\n• Same api_player_id → keep newest\n• Same name+team (no api id) → keep newest\n\nDelete ${targets.length} duplicates?`);
        if (!ok) return;

        setOp2({ running: true, logs: [], done: false });
        addLog(setOp2, `Found ${targets.length} duplicates to delete`);

        let deleted = 0;
        for (const p of targets) {
            await base44.entities.Player.delete(p.id);
            deleted++;
            await sleep(150);
            if (deleted % 20 === 0) addLog(setOp2, `Deleted ${deleted}/${targets.length}...`);
        }

        addLog(setOp2, `✓ Done. Deleted ${deleted} duplicates.`);
        setOp2(prev => ({ ...prev, running: false, done: true }));
        queryClient.invalidateQueries({ queryKey: ['cleanupPlayers'] });
        queryClient.invalidateQueries({ queryKey: ['adminAllPlayers'] });
    };

    // ── Op 3: Validate team references ─────────────────────────────────────
    const handleValidateTeams = async () => {
        setOp3({ running: true, logs: [], done: false, orphans: [] });
        addLog(setOp3, `Checking ${players.length} players against ${teams.length} teams...`);

        const teamIds = new Set(teams.map(t => t.id));
        const orphans = players.filter(p => !teamIds.has(p.team_id));

        addLog(setOp3, `Found ${orphans.length} players with broken team references`);

        if (orphans.length > 0) {
            const sample = orphans.slice(0, 5).map(p => `  • ${p.full_name} (team_id: ${p.team_id})`).join('\n');
            addLog(setOp3, `Sample orphans:\n${sample}`);
        } else {
            addLog(setOp3, `✓ All player team references are valid!`);
        }

        setOp3(prev => ({ ...prev, running: false, done: true, orphans }));
    };

    const handleDeleteOrphans = async () => {
        const orphans = op3.orphans;
        if (!orphans.length) return;
        const ok = await askConfirm(`Delete ${orphans.length} players with invalid team references?`);
        if (!ok) return;

        setOp3(prev => ({ ...prev, running: true }));
        addLog(setOp3, `Deleting ${orphans.length} orphan players...`);
        let deleted = 0;
        for (const p of orphans) {
            await base44.entities.Player.delete(p.id);
            deleted++;
            await sleep(150);
            if (deleted % 20 === 0) addLog(setOp3, `Deleted ${deleted}/${orphans.length}...`);
        }
        addLog(setOp3, `✓ Done. Deleted ${deleted} orphans.`);
        setOp3(prev => ({ ...prev, running: false, orphans: [] }));
        queryClient.invalidateQueries({ queryKey: ['cleanupPlayers'] });
        queryClient.invalidateQueries({ queryKey: ['adminAllPlayers'] });
    };

    // ── Op 4: Full refresh from API ─────────────────────────────────────────
    const handleFullRefresh = async () => {
        const ok = await askConfirm(
            `⚠ NUCLEAR OPTION ⚠\n\nThis will:\n1. Delete ALL ${players.length} current players\n2. Re-import all players from API-Football\n\nFantasy squads referencing deleted players may break.\n\nThis will take 2-5 minutes. Are you absolutely sure?`
        );
        if (!ok) return;

        const ok2 = await askConfirm(`Last chance: delete ALL players and re-import from API?`);
        if (!ok2) return;

        setOp4({ running: true, logs: [], done: false });
        addLog(setOp4, `Starting full player refresh...`);

        try {
            // Step 1: Delete all players in batches
            addLog(setOp4, `Step 1: Deleting all ${players.length} players...`);
            const BATCH = 10;
            let deleted = 0;
            for (let i = 0; i < players.length; i += BATCH) {
                const batch = players.slice(i, i + BATCH);
                for (const p of batch) {
                    await base44.entities.Player.delete(p.id);
                    await sleep(200);
                }
                deleted += batch.length;
                addLog(setOp4, `Deleted ${deleted}/${players.length} players...`);
                await sleep(1000);
            }
            addLog(setOp4, `✓ All players deleted. Starting API import...`);

            // Step 2: Re-import via apiFutbol function
            addLog(setOp4, `Step 2: Seeding players from API-Football (this takes ~3 min)...`);
            const res = await base44.functions.invoke('apiFutbol', { action: 'seed_players' });
            const data = res.data;

            if (data?.ok || data?.seeded !== undefined) {
                addLog(setOp4, `✓ Import complete! Created: ${data.seeded ?? data.created ?? '?'} players`);
                if (data.skipped) addLog(setOp4, `  Skipped (already exist): ${data.skipped}`);
                if (data.errors?.length) addLog(setOp4, `  Errors: ${data.errors.length} — ${data.errors[0]}`);
            } else {
                addLog(setOp4, `Response: ${JSON.stringify(data).slice(0, 200)}`);
            }

            addLog(setOp4, `✓ Full refresh complete.`);
            setOp4(prev => ({ ...prev, running: false, done: true }));
            queryClient.invalidateQueries({ queryKey: ['cleanupPlayers'] });
            queryClient.invalidateQueries({ queryKey: ['adminAllPlayers'] });
        } catch (err) {
            addLog(setOp4, `✗ Error: ${err.message}`);
            setOp4(prev => ({ ...prev, running: false }));
        }
    };

    const noApiIdCount = players.filter(p => !p.api_player_id).length;
    const teamIds = new Set(teams.map(t => t.id));
    const orphanCount = players.filter(p => !teamIds.has(p.team_id)).length;

    // Duplicate count estimate
    const dupCount = (() => {
        const byApiId = {};
        const byNameTeam = {};
        let count = 0;
        for (const p of players) {
            if (p.api_player_id) {
                if (!byApiId[p.api_player_id]) byApiId[p.api_player_id] = 0;
                byApiId[p.api_player_id]++;
            } else {
                const key = `${p.full_name}|${p.team_id}`;
                if (!byNameTeam[key]) byNameTeam[key] = 0;
                byNameTeam[key]++;
            }
        }
        for (const c of Object.values(byApiId)) if (c > 1) count += c - 1;
        for (const c of Object.values(byNameTeam)) if (c > 1) count += c - 1;
        return count;
    })();

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={confirm.onCancel} />}

            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Trash2 className="w-7 h-7 text-red-500" /> Player Data Cleanup
                </h1>
                <p className="text-gray-500 mt-1">Fix data quality issues in the player database</p>
            </div>

            {/* Current status */}
            {!playersLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Players', value: players.length, color: '#475CC7' },
                        { label: 'No API ID', value: noApiIdCount, color: noApiIdCount > 0 ? '#dc2626' : '#218848' },
                        { label: 'Duplicates', value: dupCount, color: dupCount > 0 ? '#dc2626' : '#218848' },
                        { label: 'Bad Team Refs', value: orphanCount, color: orphanCount > 0 ? '#dc2626' : '#218848' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl p-4 border" style={{ borderTop: `3px solid ${s.color}` }}>
                            <div className="text-xs text-gray-500">{s.label}</div>
                            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Op 1 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="w-4 h-4 text-red-500" /> Delete Players Without API ID
                    </CardTitle>
                    <CardDescription>
                        Removes all {noApiIdCount} players with no <code>api_player_id</code> — these are stale manual seeds not linked to any real API data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        disabled={op1.running || noApiIdCount === 0}
                        onClick={handleDeleteNoApiId}
                        className="gap-2"
                    >
                        {op1.running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Trash2 className="w-4 h-4" /> Delete {noApiIdCount} Players Without API ID</>}
                    </Button>
                    {op1.done && <div className="flex items-center gap-2 mt-2 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> Complete</div>}
                    <LogBox logs={op1.logs} />
                </CardContent>
            </Card>

            {/* Op 2 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Delete Duplicate Players
                    </CardTitle>
                    <CardDescription>
                        Finds ~{dupCount} duplicate records (same <code>api_player_id</code> or same name+team). Keeps the newest copy.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        disabled={op2.running || dupCount === 0}
                        onClick={handleDeleteDuplicates}
                        className="gap-2"
                    >
                        {op2.running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Trash2 className="w-4 h-4" /> Delete ~{dupCount} Duplicates</>}
                    </Button>
                    {op2.done && <div className="flex items-center gap-2 mt-2 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> Complete</div>}
                    <LogBox logs={op2.logs} />
                </CardContent>
            </Card>

            {/* Op 3 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> Validate Team References
                    </CardTitle>
                    <CardDescription>
                        Checks every player's <code>team_id</code> against the Team table. Flags and optionally deletes orphans.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            disabled={op3.running}
                            onClick={handleValidateTeams}
                            className="gap-2"
                        >
                            {op3.running ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</> : 'Check Team References'}
                        </Button>
                        {op3.orphans.length > 0 && (
                            <Button
                                variant="destructive"
                                disabled={op3.running}
                                onClick={handleDeleteOrphans}
                                className="gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Delete {op3.orphans.length} Orphans
                            </Button>
                        )}
                    </div>
                    {op3.done && op3.orphans.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> All team references valid</div>
                    )}
                    {op3.orphans.length > 0 && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                            <div className="font-semibold mb-1">{op3.orphans.length} orphan players:</div>
                            {op3.orphans.slice(0, 30).map(p => (
                                <div key={p.id} className="text-xs font-mono">{p.full_name} — team_id: {p.team_id}</div>
                            ))}
                            {op3.orphans.length > 30 && <div className="text-xs text-gray-500 mt-1">...and {op3.orphans.length - 30} more</div>}
                        </div>
                    )}
                    <LogBox logs={op3.logs} />
                </CardContent>
            </Card>

            {/* Op 4 */}
            <Card className="border-red-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-red-700">
                        <RefreshCw className="w-4 h-4" /> Full Player Refresh from API
                    </CardTitle>
                    <CardDescription>
                        <span className="text-red-600 font-semibold">⚠ Nuclear option.</span> Deletes ALL players then re-imports from API-Football via the <code>apiFutbol</code> seed function. Fantasy squads may break. Takes ~3 minutes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        disabled={op4.running}
                        onClick={handleFullRefresh}
                        className="gap-2 bg-red-700 hover:bg-red-800"
                    >
                        {op4.running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running (this takes ~3 min)...</> : <><RefreshCw className="w-4 h-4" /> Full Refresh — Delete All & Re-import</>}
                    </Button>
                    {op4.done && <div className="flex items-center gap-2 mt-2 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> Complete</div>}
                    <LogBox logs={op4.logs} />
                </CardContent>
            </Card>
        </div>
    );
}