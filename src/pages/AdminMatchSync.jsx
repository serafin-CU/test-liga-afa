import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Square, Zap, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const CU = { green: '#218848', red: '#dc2626', blue: '#475CC7', orange: '#FFB81C', charcoal: '#2C2B2B' };

const AUTOMATION_ID = null; // set via state from list call

function StatusBadge({ status }) {
    if (status === 'FINAL') return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">FINAL</Badge>;
    if (status === 'LIVE') return <Badge className="text-xs bg-red-100 text-red-700 border-red-200 animate-pulse">EN VIVO</Badge>;
    return <Badge variant="outline" className="text-xs text-gray-500">PROG.</Badge>;
}

function RunStatusIcon({ status }) {
    if (status === 'SUCCESS') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    if (status === 'FAIL') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    if (status === 'PARTIAL') return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
    return <Clock className="w-4 h-4 text-gray-400 shrink-0" />;
}

export default function AdminMatchSync() {
    const queryClient = useQueryClient();
    const logBottomRef = useRef(null);

    const [syncing, setSyncing] = useState(false);
    const [autoRunning, setAutoRunning] = useState(false);
    const [automationId, setAutomationId] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [nextSync, setNextSync] = useState(null);
    const [togglingAuto, setTogglingAuto] = useState(false);

    // Fetch matches
    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['adminSyncMatches'],
        queryFn: () => base44.entities.Match.list('-kickoff_at', 20),
        refetchInterval: 30000
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['allTeams'],
        queryFn: () => base44.entities.Team.list()
    });

    // Fetch sync log (IngestionRuns)
    const { data: logData, refetch: refetchLog } = useQuery({
        queryKey: ['syncLog'],
        queryFn: () => base44.functions.invoke('matchSyncService', { action: 'get_log' }).then(r => r.data),
        refetchInterval: 15000
    });
    const runs = logData?.runs || [];

    // Load automation state
    useEffect(() => {
        base44.functions.invoke('adminMatchSyncControl', { action: 'get_status' })
            .then(r => {
                setAutoRunning(r.data?.is_active ?? false);
                setAutomationId(r.data?.automation_id ?? null);
                setLastSync(r.data?.last_run ?? null);
            })
            .catch(() => {});
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!autoRunning || !lastSync) { setNextSync(null); return; }
        const tick = () => {
            const nextAt = moment(lastSync).add(2, 'hours');
            const diff = nextAt.diff(moment());
            if (diff <= 0) setNextSync('Inminente');
            else setNextSync(moment.utc(diff).format('H[h] mm[m] ss[s]'));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [autoRunning, lastSync]);

    // Auto-scroll log
    useEffect(() => {
        logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [runs.length]);

    const teamsMap = React.useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);

    const handleRunNow = async () => {
        setSyncing(true);
        try {
            const res = await base44.functions.invoke('matchSyncService', { action: 'sync_matches' });
            const s = res.data?.summary;
            toast.success(`Sync completado: ${s?.synced ?? 0} partidos, ${s?.status_updates ?? 0} actualizados`);
            setLastSync(new Date().toISOString());
            queryClient.invalidateQueries(['adminSyncMatches']);
            refetchLog();
        } catch (err) {
            toast.error('Error en sync: ' + (err.message || 'desconocido'));
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleAuto = async (start) => {
        setTogglingAuto(true);
        try {
            const res = await base44.functions.invoke('adminMatchSyncControl', {
                action: start ? 'start' : 'stop',
                automation_id: automationId
            });
            setAutoRunning(start);
            if (res.data?.automation_id) setAutomationId(res.data.automation_id);
            toast.success(start ? 'Auto-sync iniciado' : 'Auto-sync detenido');
        } catch (err) {
            toast.error('Error: ' + (err.message || 'desconocido'));
        } finally {
            setTogglingAuto(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                    Match Sync Control
                </h1>
                <p className="text-sm text-gray-500 mt-1">Sincronización automática de partidos desde API-Football</p>
            </div>

            {/* Control Panel */}
            <div className="rounded-2xl border bg-white p-5 space-y-5">
                {/* Status indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-4 h-4 rounded-full shrink-0 ${autoRunning ? 'bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                        <div>
                            <div className="text-lg font-bold" style={{ color: autoRunning ? CU.green : CU.red }}>
                                Auto-sync: {autoRunning ? 'RUNNING' : 'STOPPED'}
                            </div>
                            <div className="text-xs text-gray-400 space-x-3">
                                <span>Intervalo: cada 2 horas</span>
                                {lastSync && <span>· Último: {moment(lastSync).fromNow()}</span>}
                                {autoRunning && nextSync && <span>· Próximo: en {nextSync}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap gap-3">
                    <Button
                        onClick={() => handleToggleAuto(true)}
                        disabled={autoRunning || togglingAuto}
                        className="gap-2 text-white"
                        style={{ background: CU.green }}
                    >
                        {togglingAuto && !autoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start Auto-Sync
                    </Button>
                    <Button
                        onClick={() => handleToggleAuto(false)}
                        disabled={!autoRunning || togglingAuto}
                        variant="destructive"
                        className="gap-2"
                    >
                        {togglingAuto && autoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        Stop Auto-Sync
                    </Button>
                    <Button
                        onClick={handleRunNow}
                        disabled={syncing}
                        className="gap-2 text-white"
                        style={{ background: CU.blue }}
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Run Sync Now
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { queryClient.invalidateQueries(['adminSyncMatches']); refetchLog(); }}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Recent Matches */}
            <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold" style={{ fontFamily: "'DM Serif Display', serif" }}>Últimos 20 Partidos</h2>
                    {matchesLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase border-b bg-gray-50">
                                <th className="px-4 py-2 text-left">Kickoff</th>
                                <th className="px-4 py-2 text-left">Partido</th>
                                <th className="px-4 py-2 text-center">Estado</th>
                                <th className="px-4 py-2 text-center">API Fixture</th>
                                <th className="px-4 py-2 text-right">Actualizado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin partidos</td></tr>
                            )}
                            {matches.map(m => {
                                const home = teamsMap[m.home_team_id];
                                const away = teamsMap[m.away_team_id];
                                return (
                                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                            {moment(m.kickoff_at).format('DD/MM HH:mm')}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                            {home?.name || home?.fifa_code || '?'} <span className="text-gray-400 text-xs">vs</span> {away?.name || away?.fifa_code || '?'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <StatusBadge status={m.status} />
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-mono text-gray-400">
                                            {m.api_fixture_id || <span className="text-red-300">—</span>}
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
                <div className="px-5 py-3 border-b">
                    <h2 className="font-semibold" style={{ fontFamily: "'DM Serif Display', serif" }}>Activity Log (últimas 30 ejecuciones)</h2>
                </div>
                <div className="overflow-y-auto max-h-80 font-mono text-xs p-4 space-y-2 bg-gray-950">
                    {runs.length === 0 && (
                        <p className="text-gray-500">Sin registros aún. Ejecutá un sync para ver actividad.</p>
                    )}
                    {runs.map((run, i) => {
                        let parsed = {};
                        try { parsed = JSON.parse(run.summary_json || '{}'); } catch {}
                        return (
                            <div key={run.id || i} className="flex items-start gap-2">
                                <RunStatusIcon status={run.status} />
                                <div className="flex-1">
                                    <span className="text-gray-400">{moment(run.started_at).format('DD/MM HH:mm:ss')}</span>
                                    {' '}
                                    <span className={run.status === 'SUCCESS' ? 'text-green-400' : run.status === 'FAIL' ? 'text-red-400' : 'text-yellow-400'}>
                                        [{run.status}]
                                    </span>
                                    {' '}
                                    <span className="text-gray-300">
                                        {parsed.synced != null
                                            ? `synced=${parsed.synced} status_updates=${parsed.status_updates} score_updates=${parsed.score_updates} errors=${parsed.errors?.length ?? 0}`
                                            : parsed.message || run.summary_json}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={logBottomRef} />
                </div>
            </div>
        </div>
    );
}