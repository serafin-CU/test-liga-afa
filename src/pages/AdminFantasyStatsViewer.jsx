import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminFantasyStatsViewer() {
    const [selectedMatchId, setSelectedMatchId] = useState(null);

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: stats = [], isLoading: statsLoading } = useQuery({
        queryKey: ['fantasyStats', selectedMatchId],
        queryFn: () => base44.entities.FantasyMatchPlayerStats.filter({ match_id: selectedMatchId }),
        enabled: !!selectedMatchId
    });

    const { data: players = [] } = useQuery({
        queryKey: ['players'],
        queryFn: () => base44.entities.Player.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const playersMap = Object.fromEntries(players.map(p => [p.id, p]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));

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

    const finalizedMatches = matches.filter(m => m.status === 'FINAL').sort((a, b) => 
        new Date(b.kickoff_at) - new Date(a.kickoff_at)
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Fantasy Match Stats Viewer</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Select Match</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={selectedMatchId || ''} onValueChange={setSelectedMatchId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a finalized match" />
                        </SelectTrigger>
                        <SelectContent>
                            {finalizedMatches.map(match => (
                                <SelectItem key={match.id} value={match.id}>
                                    {getMatchLabel(match)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedMatchId && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Player Statistics
                            {stats.length > 0 && (
                                <span className="ml-3 text-sm font-normal text-gray-600">
                                    ({stats.length} players)
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div>Loading stats...</div>
                        ) : stats.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                No stats available for this match
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Player</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Pos</TableHead>
                                        <TableHead>Started</TableHead>
                                        <TableHead>Sub In</TableHead>
                                        <TableHead>Sub Out</TableHead>
                                        <TableHead>Min In</TableHead>
                                        <TableHead>Min Out</TableHead>
                                        <TableHead>Minutes</TableHead>
                                        <TableHead>Goals</TableHead>
                                        <TableHead>YC</TableHead>
                                        <TableHead>RC</TableHead>
                                        <TableHead>Source</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.map(stat => {
                                        const player = playersMap[stat.player_id];
                                        const team = teamsMap[stat.team_id];
                                        return (
                                            <TableRow key={stat.id}>
                                                <TableCell className="font-medium">{player?.full_name || 'Unknown'}</TableCell>
                                                <TableCell>{team?.name || 'Unknown'}</TableCell>
                                                <TableCell>{player?.position}</TableCell>
                                                <TableCell>{stat.started ? '✓' : '-'}</TableCell>
                                                <TableCell>{stat.substituted_in ? '✓' : '-'}</TableCell>
                                                <TableCell>{stat.substituted_out ? '✓' : '-'}</TableCell>
                                                <TableCell>{stat.minute_in ?? '-'}</TableCell>
                                                <TableCell>{stat.minute_out ?? '-'}</TableCell>
                                                <TableCell className="font-semibold">{stat.minutes_played}</TableCell>
                                                <TableCell className={stat.goals > 0 ? 'text-green-600 font-semibold' : ''}>
                                                    {stat.goals}
                                                </TableCell>
                                                <TableCell className={stat.yellow_cards > 0 ? 'text-yellow-600' : ''}>
                                                    {stat.yellow_cards}
                                                </TableCell>
                                                <TableCell className={stat.red_cards > 0 ? 'text-red-600 font-semibold' : ''}>
                                                    {stat.red_cards}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                        {stat.source}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}