import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function AdminFantasyLedgerViewer() {
    const [selectedMatchId, setSelectedMatchId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('match') || null;
    });
    const [selectedPhase, setSelectedPhase] = useState('all');
    const [selectedSourceType, setSelectedSourceType] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [showAllModes, setShowAllModes] = useState(true);
    const [showVoids, setShowVoids] = useState(true);
    const queryClient = useQueryClient();

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

    const { data: allLedger = [] } = useQuery({
        queryKey: ['fantasyLedger'],
        queryFn: async () => {
            const allEntries = await base44.entities.PointsLedger.list();
            // Show FANTASY and PENALTY modes
            return allEntries.filter(e => 
                e.mode?.startsWith('FANTASY') || e.mode === 'PENALTY'
            );
        }
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list()
    });

    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));

    const getMatchLabel = (match) => {
        const homeTeam = teamsMap[match.home_team_id];
        const awayTeam = teamsMap[match.away_team_id];
        const homeName = homeTeam?.fifa_code || homeTeam?.name || 'TBD';
        const awayName = awayTeam?.fifa_code || awayTeam?.name || 'TBD';
        const date = new Date(match.kickoff_at).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const shortId = match.id.slice(-8);
        return `${date}  ${homeName} vs ${awayName} (${match.phase}) · ${shortId}`;
    };

    const filteredLedger = (() => {
        let filtered = allLedger;
        
        // Filter by user
        if (selectedUserId !== 'all') {
            filtered = filtered.filter(e => e.user_id === selectedUserId);
        }

        // Filter by match
        if (selectedMatchId) {
            filtered = filtered.filter(e => {
                if (e.source_id && e.source_id.includes(selectedMatchId)) return true;
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.match_id === selectedMatchId;
                } catch {
                    return false;
                }
            });
        }

        // Filter by phase
        if (selectedPhase !== 'all') {
            filtered = filtered.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.phase === selectedPhase;
                } catch {
                    return false;
                }
            });
        }

        // Filter by source type
        if (selectedSourceType !== 'all') {
            filtered = filtered.filter(e => e.source_type === selectedSourceType);
        }
        
        // Filter voids
        if (!showVoids) {
            filtered = filtered.filter(e => {
                try {
                    const breakdown = JSON.parse(e.breakdown_json);
                    return breakdown.type !== 'VOID';
                } catch {
                    return true;
                }
            });
        }
        
        return filtered;
    })();
    
    // Compute net points for selected match
    const netPoints = selectedMatchId ? filteredLedger.reduce((sum, e) => sum + e.points, 0) : null;

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Fantasy Ledger Viewer</h1>
                <Button 
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['fantasyLedger'] })}
                    variant="outline"
                    size="sm"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">User Filter</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All users" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Phase Filter</label>
                            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All phases" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Phases</SelectItem>
                                    <SelectItem value="GROUP_MD1">GROUP_MD1</SelectItem>
                                    <SelectItem value="GROUP_MD2">GROUP_MD2</SelectItem>
                                    <SelectItem value="GROUP_MD3">GROUP_MD3</SelectItem>
                                    <SelectItem value="ROUND_OF_32">ROUND_OF_32</SelectItem>
                                    <SelectItem value="ROUND_OF_16">ROUND_OF_16</SelectItem>
                                    <SelectItem value="QUARTERFINALS">QUARTERFINALS</SelectItem>
                                    <SelectItem value="SEMIFINALS">SEMIFINALS</SelectItem>
                                    <SelectItem value="FINAL">FINAL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Source Type Filter</label>
                            <Select value={selectedSourceType} onValueChange={setSelectedSourceType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="FANTASY_MATCH">FANTASY_MATCH</SelectItem>
                                    <SelectItem value="TRANSFER_PENALTY">TRANSFER_PENALTY</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Match Filter</label>
                            <Select value={selectedMatchId || 'all'} onValueChange={(val) => setSelectedMatchId(val === 'all' ? null : val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All matches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Matches</SelectItem>
                                    {finalizedMatches.map(match => (
                                        <SelectItem key={match.id} value={match.id}>
                                            {getMatchLabel(match)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="showAllModes" 
                                checked={showAllModes}
                                onChange={(e) => setShowAllModes(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="showAllModes" className="text-sm font-medium">
                                Show all FANTASY modes (FANTASY, FANTASY_VOID, etc.)
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="showVoids" 
                                checked={showVoids}
                                onChange={(e) => setShowVoids(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="showVoids" className="text-sm font-medium">
                                Show voids
                            </label>
                        </div>
                    </div>
                    
                    {selectedMatchId && netPoints !== null && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-900">
                                Net Points for Selected Match
                            </div>
                            <div className={`text-2xl font-bold ${netPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {netPoints > 0 ? '+' : ''}{netPoints}
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                                {showVoids ? 'Including void entries' : 'Excluding void entries'}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ledger Entries ({filteredLedger.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredLedger.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No ledger entries found. Run "Dev Fantasy Setup" or use "Fantasy Scoring Controls" to create entries.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Phase</TableHead>
                                    <TableHead>Source Type</TableHead>
                                    <TableHead>Source ID</TableHead>
                                    <TableHead>Points</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLedger.map(entry => {
                                    const user = usersMap[entry.user_id];
                                    let breakdown = {};
                                    try {
                                        breakdown = JSON.parse(entry.breakdown_json);
                                    } catch {}

                                    const isVoid = breakdown.type === 'VOID';
                                    const isPenalty = entry.source_type === 'TRANSFER_PENALTY';

                                    return (
                                        <TableRow key={entry.id} className={isVoid ? 'bg-red-50' : isPenalty ? 'bg-orange-50' : ''}>
                                            <TableCell className="font-medium text-xs">
                                                {user?.email || entry.user_id}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{entry.mode}</TableCell>
                                            <TableCell className="text-xs font-semibold">
                                                {breakdown.phase || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs">{entry.source_type}</TableCell>
                                            <TableCell className="text-xs font-mono truncate max-w-[120px]" title={entry.source_id}>
                                                {entry.source_id}
                                            </TableCell>
                                            <TableCell className={`font-semibold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {entry.points > 0 ? '+' : ''}{entry.points}
                                            </TableCell>
                                            <TableCell>
                                                {isVoid ? (
                                                    <Badge variant="destructive">VOID</Badge>
                                                ) : isPenalty ? (
                                                    <Badge className="bg-orange-600">PENALTY</Badge>
                                                ) : (
                                                    <Badge className="bg-green-600">AWARD</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {isVoid ? (
                                                    `Voided ${breakdown.voided_points} pts`
                                                ) : isPenalty ? (
                                                    <div className="space-y-0.5">
                                                        <div><strong>Transfers:</strong> {breakdown.transfers_count}</div>
                                                        <div><strong>Free:</strong> {breakdown.free_transfers}</div>
                                                        <div><strong>Excess:</strong> {breakdown.excess_transfers}</div>
                                                        {breakdown.penalty_breakdown && (
                                                            <div className="text-xs font-mono text-orange-800 mt-1">
                                                                {breakdown.penalty_breakdown}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : breakdown.captain ? (
                                                    <div className="space-y-0.5">
                                                        <div>{breakdown.per_player?.length || 0} players</div>
                                                        {breakdown.captain.player_name && (
                                                            <div className="text-blue-700">
                                                                <strong>C:</strong> {breakdown.captain.player_name}
                                                            </div>
                                                        )}
                                                        {breakdown.captain.delta_from_multiplier > 0 && (
                                                            <div className="text-green-700 font-semibold">
                                                                +{breakdown.captain.delta_from_multiplier} (2x)
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    `${breakdown.per_player?.length || 0} players`
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {new Date(entry.created_date).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}