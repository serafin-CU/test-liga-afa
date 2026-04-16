import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Square, Zap, RefreshCw } from 'lucide-react';
import moment from 'moment';

const CU = { green: '#218848', red: '#dc2626', blue: '#475CC7', charcoal: '#2C2B2B' };

function formatCountdown(seconds) {
    if (seconds > 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `in ${h}h ${m}m`;
    }
    if (seconds > 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `in ${m}m ${s}s`;
    }
    return `in ${seconds}s`;
}

function StatusBadge({ status }) {
    if (status === 'FINAL') return <Badge className="text-xs bg-green-100 text-green-700 border-green-200 border">FINAL</Badge>;
    if (status === 'LIVE')  return <Badge className="text-xs bg-red-100 text-red-700 border-red-200 border animate-pulse">EN VIVO</Badge>;
    return <Badge variant="outline" className="text-xs text-gray-400">PROG.</Badge>;
}

function logColor(msg) {
    if (msg.includes('✓') || msg.includes('✅') || msg.includes('complete') || msg.includes('🟢')) return 'text-green-400';
    if (msg.includes('✗') || msg.includes('❌') || msg.includes('error') || msg.includes('Error') || msg.includes('🔴')) return 'text-red-400';
    return 'text-blue-300';
}

export default function AdminMatchSync() {
    const queryClient = useQueryClient();
    const logBottomRef = useRef(null);

    const [autoSync, setAutoSync] = useState(false);
    const [nextSyncIn, setNextSyncIn] = useState(7200);
    const [activityLog, setActivityLog] = useState([]);
    const [syncing, setSyncing] = useState(false);

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['adminMatches'],
        queryFn: () => base44.entities.Match.list('-kickoff_at', 20),
        refetchInterval: 30000
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['allTeams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: results = [] } = useQuery({
        queryKey: ['matchResults'],
        queryFn: () => base44.entities.MatchResultFinal.list()
    });

    const teamsMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);
    const resultsMap = useMemo(() => Object.fromEntries(results.map(r => [r.match_id, r])), [results]);

    const addLog = useCallback((message) => {
        setActivityLog(prev => [...prev, { id: Date.now() + Math.random(), message }].slice(-30));
    }, []);

    useEffect(() => {
        logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activityLog]);

    useEffect(() => {
        if (!autoSync || nextSyncIn <= 0) return;
        const timer = setTimeout(() => setNextSyncIn(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [autoSync, nextSyncIn]);

    const runSync = useCallback(async () => {
        setSyncing(true);
        setNextSyncIn(7200);
        const ts = new Date().toLocaleTimeString('es-AR');
        addLog(`[${ts}] 🔄 Starting sync...`);

        try {
            const res = await base44.functions.invoke('syncMatches', {});
            const data = res.data;

            (data.log || []).forEach(msg => addLog(`[${ts}] ${msg}`));

            if (data.success) {
                addLog(`[${ts}] ✅ Sync complete: ${data.updatedCount} updated, ${data.scoredCount} scored`);
            } else {
                addLog(`[${ts}] ❌ Sync failed: ${data.error}`);
            }

            queryClient.invalidateQueries(['adminMatches']);
            queryClient.invalidateQueries(['matchResults']);
        } catch (error) {
            addLog(`[${ts}] ❌ Sync failed: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    }, [addLog, queryClient]);

    useEffect(() => {
        if (!autoSync) return;
        runSync();
        const interval = setInterval(runSync, 7200000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSync]);

    const handleStart = () => {
        setAutoSync(true);
        addLog(`[${new Date().toLocaleTimeString('es-AR')}] 🟢 Auto-sync started`);
    };

    const handleStop = () => {
        setAutoSync(false);
        addLog(`[${new Date().toLocaleTimeString('es-AR')}] 🔴 Auto-sync stopped`);
    };

    const handleRunNow = () => {
        addLog(`[${new Date().toLocaleTimeString('es-AR')}] ⚡ Manual sync triggered`);
        runSync();
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: CU.charcoal }}>Match Sync Control</h1>
                <p className="text-sm text-gray-500 mt-1">Sincronización automática de partidos desde API-Football</p>
            </div>

            {/* Control Panel */}
            <div className="rounded-2xl border bg-white p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-4 h-4 rounded-full shrink-0 transition-colors ${autoSync ? 'bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                        <div>
                            <div className="text-lg font-bold" style={{ color: autoSync ? CU.green : CU.red }}>
                                Auto-sync: {autoSync ? 'RUNNING' : 'STOPPED'}
                            </div>
                            <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                <span>Intervalo: cada 2 horas</span>
                                {autoSync && <span>· Próximo sync: <span className="font-mono text-gray-600">{formatCountdown(nextSyncIn)}</span></span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button
                        onClick={handleStart}
                        disabled={autoSync || syncing}
                        className="gap-2 text-white font-semibold px-5"
                        style={{ background: autoSync ? '#aaa' : CU.green }}
                    >
                        <Play className="w-4 h-4" />
                        Start Auto-Sync
                    </Button>
                    <Button
                        onClick={handleStop}
                        disabled={!autoSync}
                        variant="destructive"
                        className="gap-2 font-semibold px-5"
                    >
                        <Square className="w-4 h-4" />
                        Stop Auto-Sync
                    </Button>
                    <Button
                        onClick={handleRunNow}
                        disabled={syncing}
                        className="gap-2 text-white font-semibold px-5"
                        style={{ background: CU.blue }}
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Run Sync Now
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries(['adminMatches'])}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Recent Matches */}
            <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Últimos 20 Partidos</h2>
                    {matchesLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase border-b">
                                <th className="px-4 py-2 text-left font-medium">Kickoff</th>
                                <th className="px-4 py-2 text-left font-medium">Partido</th>
                                <th className="px-4 py-2 text-center font-medium">Estado</th>
                                <th className="px-4 py-2 text-center font-medium">Score</th>
                                <th className="px-4 py-2 text-right font-medium">Actualizado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.length === 0 && !matchesLoading && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin partidos</td></tr>
                            )}
                            {matches.map(m => {
                                const home = teamsMap[m.home_team_id];
                                const away = teamsMap[m.away_team_id];
                                const result = resultsMap[m.id];
                                return (
                                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                            {moment(m.kickoff_at).format('DD/MM HH:mm')}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                            <span>{home?.name || home?.fifa_code || '?'}</span>
                                            <span className="text-gray-400 text-xs mx-2">vs</span>
                                            <span>{away?.name || away?.fifa_code || '?'}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <StatusBadge status={m.status} />
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono text-sm font-bold">
                                            {result
                                                ? <span style={{ color: CU.charcoal }}>{result.home_goals} – {result.away_goals}</span>
                                                : <span className="text-gray-300">–</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
                                            {moment(m.updated_date).fromNow()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Activity Log */}
            <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700">Activity Log</h2>
                    <span className="text-xs text-gray-400">{activityLog.length}/30 entries</span>
                </div>
                <div className="overflow-y-auto max-h-80 bg-gray-950 font-mono text-xs p-4 space-y-1">
                    {activityLog.length === 0 && (
                        <p className="text-gray-600">No activity yet. Start auto-sync or run manually.</p>
                    )}
                    {activityLog.map(entry => (
                        <div key={entry.id} className={`leading-relaxed ${logColor(entry.message)}`}>
                            {entry.message}
                        </div>
                    ))}
                    <div ref={logBottomRef} />
                </div>
            </div>
        </div>
    );
}