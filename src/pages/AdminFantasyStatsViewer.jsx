import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFantasyStatsViewer() {
    const [selectedMatchId, setSelectedMatchId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('match_id') || null;
    });
    const [editingStat, setEditingStat] = useState(null);
    const [squadPlayers, setSquadPlayers] = useState([]);
    const [currentSquadId, setCurrentSquadId] = useState(null);
    const [confirmCaptainDialog, setConfirmCaptainDialog] = useState(null);
    const [editForm, setEditForm] = useState({
        goals: 0,
        yellow_cards: 0,
        red_cards: 0,
        minutes_played: 0
    });
    const queryClient = useQueryClient();
    
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });
    
    const isAdmin = currentUser?.role === 'admin';

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
    
    // Auto-select the most recent finalized match if none selected
    useEffect(() => {
        if (!selectedMatchId && finalizedMatches.length > 0) {
            setSelectedMatchId(finalizedMatches[0].id);
        }
    }, [finalizedMatches.length, selectedMatchId]);

    // Load squad players to show captain
    useEffect(() => {
        if (selectedMatchId) {
            const fetchSquadPlayers = async () => {
                const match = matches.find(m => m.id === selectedMatchId);
                if (!match) return;

                const squads = await base44.entities.FantasySquad.filter({ phase: match.phase, status: 'FINAL' });
                if (squads.length > 0) {
                    setCurrentSquadId(squads[0].id);
                    const squadPlayersData = await base44.entities.FantasySquadPlayer.filter({ squad_id: squads[0].id });
                    setSquadPlayers(squadPlayersData);
                } else {
                    setCurrentSquadId(null);
                    setSquadPlayers([]);
                }
            };
            fetchSquadPlayers();
        }
    }, [selectedMatchId, matches]);
    
    const setCaptainMutation = useMutation({
        mutationFn: async ({ playerId, squadId }) => {
            const response = await base44.functions.invoke('squadCaptainService', {
                action: 'set_captain',
                squad_id: squadId,
                player_id: playerId
            });
            
            if (response.data.status === 'ERROR') {
                throw new Error(response.data.message || 'Failed to set captain');
            }
            
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Captain set successfully');
            
            // Refresh squad players
            if (currentSquadId) {
                base44.entities.FantasySquadPlayer.filter({ squad_id: currentSquadId })
                    .then(setSquadPlayers);
            }
            
            setConfirmCaptainDialog(null);
        },
        onError: (error) => {
            const errorMessages = {
                'NOT_A_STARTER': 'Only starters can be set as captain',
                'PLAYER_NOT_IN_SQUAD': 'Player is not in this squad',
                'INVALID_SQUAD': 'Squad not found',
                'FORBIDDEN': 'You do not have permission to modify this squad'
            };
            
            const message = errorMessages[error.message] || error.message || 'Failed to set captain';
            toast.error(message);
            setConfirmCaptainDialog(null);
        }
    });
    
    const handleSetCaptainClick = (playerId) => {
        if (!currentSquadId) {
            toast.error('No squad found for this phase');
            return;
        }
        
        const player = playersMap[playerId];
        const squadPlayer = squadPlayers.find(sp => sp.player_id === playerId);
        
        // Client-side validation
        if (!squadPlayer || squadPlayer.slot_type !== 'STARTER') {
            toast.error('Only starters can be set as captain');
            return;
        }
        
        setConfirmCaptainDialog({
            playerId,
            playerName: player?.full_name || 'Unknown Player'
        });
    };
    
    const confirmSetCaptain = () => {
        if (!confirmCaptainDialog) return;
        
        setCaptainMutation.mutate({
            playerId: confirmCaptainDialog.playerId,
            squadId: currentSquadId
        });
    };
    
    const updateStatsMutation = useMutation({
        mutationFn: async ({ statId, oldValues, newValues }) => {
            // Update stats
            await base44.entities.FantasyMatchPlayerStats.update(statId, {
                goals: newValues.goals,
                yellow_cards: newValues.yellow_cards,
                red_cards: newValues.red_cards,
                minutes_played: newValues.minutes_played,
                source: 'MANUAL'
            });
            
            // Create audit log
            await base44.entities.AdminAuditLog.create({
                admin_user_id: currentUser.id,
                actor_type: 'ADMIN',
                action: 'UPDATE_FANTASY_MATCH_PLAYER_STATS',
                entity_type: 'FantasyMatchPlayerStats',
                entity_id: statId,
                reason: 'Manual correction via AdminFantasyStatsViewer',
                details_json: JSON.stringify({
                    old_values: oldValues,
                    new_values: newValues,
                    timestamp: new Date().toISOString()
                })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fantasyStats'] });
            setEditingStat(null);
        }
    });
    
    const handleEditClick = (stat) => {
        setEditingStat(stat);
        setEditForm({
            goals: stat.goals || 0,
            yellow_cards: stat.yellow_cards || 0,
            red_cards: stat.red_cards || 0,
            minutes_played: stat.minutes_played || 0
        });
    };
    
    const handleSave = () => {
        const oldValues = {
            goals: editingStat.goals || 0,
            yellow_cards: editingStat.yellow_cards || 0,
            red_cards: editingStat.red_cards || 0,
            minutes_played: editingStat.minutes_played || 0
        };
        
        updateStatsMutation.mutate({
            statId: editingStat.id,
            oldValues,
            newValues: editForm
        });
    };
    
    const isFormValid = () => {
        return editForm.goals >= 0 
            && editForm.yellow_cards >= 0 
            && editForm.red_cards >= 0 
            && editForm.minutes_played >= 0 
            && editForm.minutes_played <= 130;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Fantasy Match Stats Viewer</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Select Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    
                    {currentSquadId && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                            <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="text-blue-800">
                                <strong>Captain Info:</strong> Captain multiplies their points by 2x. Only starters can be captain. Click "Set C" to assign captain.
                            </div>
                        </div>
                    )}
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
                                        <TableHead>Captain</TableHead>
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
                                        {isAdmin && <TableHead>Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.map(stat => {
                                        const player = playersMap[stat.player_id];
                                        const team = teamsMap[stat.team_id];
                                        const squadPlayer = squadPlayers.find(sp => sp.player_id === stat.player_id);

                                        return (
                                            <TableRow key={stat.id}>
                                                <TableCell className="font-medium">
                                                    {player?.full_name || 'Unknown'}
                                                </TableCell>
                                                <TableCell>
                                                    {squadPlayer?.is_captain ? (
                                                        <span 
                                                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold"
                                                            aria-label="Captain"
                                                            title="Captain (2x points multiplier)"
                                                        >
                                                            C
                                                        </span>
                                                    ) : isAdmin && squadPlayer?.slot_type === 'STARTER' ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleSetCaptainClick(stat.player_id)}
                                                            disabled={setCaptainMutation.isPending}
                                                            className="h-6 text-xs"
                                                            title="Set as Captain"
                                                        >
                                                            Set C
                                                        </Button>
                                                    ) : '-'}
                                                </TableCell>
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
                                                {isAdmin && (
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleEditClick(stat)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}
            
            <Dialog open={!!confirmCaptainDialog} onOpenChange={(open) => !open && setConfirmCaptainDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Captain Selection</DialogTitle>
                    </DialogHeader>
                    
                    {confirmCaptainDialog && (
                        <div className="space-y-4">
                            <div className="text-sm">
                                Set <strong className="text-blue-600">{confirmCaptainDialog.playerName}</strong> as Captain?
                            </div>
                            <div className="text-sm text-gray-600">
                                This will replace any current captain and multiply this player's points by 2x.
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setConfirmCaptainDialog(null)}
                            disabled={setCaptainMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={confirmSetCaptain}
                            disabled={setCaptainMutation.isPending}
                        >
                            {setCaptainMutation.isPending ? 'Setting...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={!!editingStat} onOpenChange={(open) => !open && setEditingStat(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Player Stats</DialogTitle>
                    </DialogHeader>
                    
                    {editingStat && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-800">
                                    <strong>Warning:</strong> Editing stats will affect fantasy scoring. Use "Force Re-Score" in System Test Harness after saving.
                                </div>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                                <div><strong>Player:</strong> {playersMap[editingStat.player_id]?.full_name}</div>
                                <div><strong>Team:</strong> {teamsMap[editingStat.team_id]?.name}</div>
                                <div><strong>Position:</strong> {playersMap[editingStat.player_id]?.position}</div>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <Label htmlFor="goals">Goals</Label>
                                    <Input
                                        id="goals"
                                        type="number"
                                        min="0"
                                        value={editForm.goals}
                                        onChange={(e) => setEditForm({...editForm, goals: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                
                                <div>
                                    <Label htmlFor="yellow_cards">Yellow Cards</Label>
                                    <Input
                                        id="yellow_cards"
                                        type="number"
                                        min="0"
                                        value={editForm.yellow_cards}
                                        onChange={(e) => setEditForm({...editForm, yellow_cards: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                
                                <div>
                                    <Label htmlFor="red_cards">Red Cards</Label>
                                    <Input
                                        id="red_cards"
                                        type="number"
                                        min="0"
                                        value={editForm.red_cards}
                                        onChange={(e) => setEditForm({...editForm, red_cards: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                
                                <div>
                                    <Label htmlFor="minutes_played">Minutes Played (0-130)</Label>
                                    <Input
                                        id="minutes_played"
                                        type="number"
                                        min="0"
                                        max="130"
                                        value={editForm.minutes_played}
                                        onChange={(e) => setEditForm({...editForm, minutes_played: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingStat(null)}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            disabled={!isFormValid() || updateStatsMutation.isPending}
                        >
                            {updateStatsMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}