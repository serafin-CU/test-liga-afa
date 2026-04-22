import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminSquadReset() {
    const [loading, setLoading] = useState(false);
    const [squads, setSquads] = useState(null);
    const [error, setError] = useState(null);
    const [resetting, setResetting] = useState(null); // squad_id being reset
    const [resetResults, setResetResults] = useState({});
    const [phaseFilter, setPhaseFilter] = useState('APERTURA_ZONE');
    const [showSquads, setShowSquads] = useState(false);

    const handleLoadSquads = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await base44.functions.invoke('fantasyService', {
                action: 'admin_list_squads',
                phase: phaseFilter || undefined
            });
            setSquads(res.data?.squads || []);
            setShowSquads(true);
        } catch (err) {
            setError(err.message || 'Error loading squads');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (squad) => {
        if (!window.confirm(`Reset squad for ${squad.user_email}? This will delete all their players and set status back to DRAFT.`)) return;
        setResetting(squad.id);
        try {
            const res = await base44.functions.invoke('fantasyService', {
                action: 'admin_reset_squad',
                squad_id: squad.id
            });
            setResetResults(prev => ({ ...prev, [squad.id]: { ok: true, deleted: res.data?.deleted_players } }));
            // Refresh squad list
            setSquads(prev => prev.map(s => s.id === squad.id ? { ...s, status: 'DRAFT', total_cost: 0 } : s));
        } catch (err) {
            setResetResults(prev => ({ ...prev, [squad.id]: { ok: false, error: err.message } }));
        } finally {
            setResetting(null);
        }
    };

    const phases = ['APERTURA_ZONE', 'GROUP_MD1', 'GROUP_MD2', 'GROUP_MD3', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-orange-500" /> Squad Reset Tool
                </CardTitle>
                <CardDescription>
                    Reset any user's finalized squad back to DRAFT. Use during testing or to allow corrections.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={phaseFilter}
                        onChange={e => setPhaseFilter(e.target.value)}
                        className="border rounded px-3 py-1.5 text-sm"
                    >
                        <option value="">All phases</option>
                        {phases.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Button onClick={handleLoadSquads} disabled={loading} variant="outline" className="gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        Load Squads
                    </Button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                {squads !== null && (
                    <div>
                        <button
                            onClick={() => setShowSquads(!showSquads)}
                            className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2"
                        >
                            {showSquads ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {squads.length} squads found
                        </button>

                        {showSquads && (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">User</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Phase</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                                            <th className="text-left px-3 py-2 font-semibold text-gray-600">Cost</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {squads.map(squad => {
                                            const result = resetResults[squad.id];
                                            return (
                                                <tr key={squad.id} className="border-b last:border-0 hover:bg-gray-50">
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium">{squad.user_name || '—'}</div>
                                                        <div className="text-xs text-gray-400">{squad.user_email}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-gray-500">{squad.phase}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            squad.status === 'FINAL'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-yellow-100 text-yellow-700'
                                                        }`}>{squad.status}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs">${squad.total_cost}M</td>
                                                    <td className="px-3 py-2 text-right">
                                                        {result ? (
                                                            result.ok
                                                                ? <span className="text-xs text-green-600 flex items-center gap-1 justify-end"><CheckCircle2 className="w-3 h-3" /> Reset ({result.deleted} players deleted)</span>
                                                                : <span className="text-xs text-red-600">{result.error}</span>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={resetting === squad.id || squad.status === 'DRAFT'}
                                                                onClick={() => handleReset(squad)}
                                                                className="gap-1 text-xs h-7"
                                                            >
                                                                {resetting === squad.id
                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                    : <RotateCcw className="w-3 h-3" />}
                                                                Reset to Draft
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}