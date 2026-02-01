import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Plus, X } from 'lucide-react';

export default function AdminMatchValidation() {
    const queryClient = useQueryClient();
    const [editingMatch, setEditingMatch] = useState(null);
    const [formData, setFormData] = useState({
        status_candidate: 'FINAL',
        score_candidate_home: '',
        score_candidate_away: '',
        confidence_score: 100,
        reasons_json: ''
    });
    const [alert, setAlert] = useState(null);

    const { data: validations = [], isLoading: validationsLoading } = useQuery({
        queryKey: ['matchValidations'],
        queryFn: () => base44.entities.MatchValidation.list()
    });

    const { data: matches = [] } = useQuery({
        queryKey: ['matches'],
        queryFn: () => base44.entities.Match.list()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const matchesMap = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const validationsMap = Object.fromEntries(validations.map(v => [v.match_id, v]));

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const existing = validationsMap[editingMatch.id];
            
            const payload = {
                match_id: editingMatch.id,
                status_candidate: data.status_candidate,
                score_candidate_home: data.score_candidate_home !== '' ? parseInt(data.score_candidate_home) : null,
                score_candidate_away: data.score_candidate_away !== '' ? parseInt(data.score_candidate_away) : null,
                confidence_score: parseInt(data.confidence_score),
                reasons_json: data.reasons_json,
                locked_final: false
            };

            if (existing) {
                return base44.entities.MatchValidation.update(existing.id, payload);
            } else {
                return base44.entities.MatchValidation.create(payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['matchValidations']);
            setEditingMatch(null);
            setAlert({ type: 'success', message: 'Validation saved successfully' });
            setTimeout(() => setAlert(null), 3000);
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });

    const handleCreateValidation = (match) => {
        const existing = validationsMap[match.id];
        setEditingMatch(match);
        
        if (existing) {
            setFormData({
                status_candidate: existing.status_candidate,
                score_candidate_home: existing.score_candidate_home !== null ? existing.score_candidate_home : '',
                score_candidate_away: existing.score_candidate_away !== null ? existing.score_candidate_away : '',
                confidence_score: existing.confidence_score,
                reasons_json: existing.reasons_json
            });
        } else {
            setFormData({
                status_candidate: 'FINAL',
                score_candidate_home: '',
                score_candidate_away: '',
                confidence_score: 100,
                reasons_json: ''
            });
        }
    };

    const handleSave = () => {
        if (!formData.reasons_json.trim()) {
            setAlert({ type: 'error', message: 'Reasons JSON is required' });
            return;
        }

        saveMutation.mutate(formData);
    };

    if (validationsLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Match Validation Status</h1>
            <p className="text-sm text-gray-600 mb-4">Admin-only / Validation Gate</p>

            {alert && (
                <Alert className={`mb-4 ${alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <AlertDescription className="flex items-center gap-2">
                        {alert.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        {alert.message}
                    </AlertDescription>
                </Alert>
            )}

            {editingMatch && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                {validationsMap[editingMatch.id] ? 'Edit' : 'Create'} Validation: {teamsMap[editingMatch.home_team_id]?.name} vs {teamsMap[editingMatch.away_team_id]?.name}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => setEditingMatch(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Status Candidate</Label>
                            <Select value={formData.status_candidate} onValueChange={(val) => setFormData({...formData, status_candidate: val})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
                                    <SelectItem value="LIVE">LIVE</SelectItem>
                                    <SelectItem value="FINAL">FINAL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Home Score</Label>
                                <Input 
                                    type="number" 
                                    value={formData.score_candidate_home}
                                    onChange={(e) => setFormData({...formData, score_candidate_home: e.target.value})}
                                    placeholder="Optional"
                                    min="0"
                                    max="20"
                                />
                            </div>
                            <div>
                                <Label>Away Score</Label>
                                <Input 
                                    type="number" 
                                    value={formData.score_candidate_away}
                                    onChange={(e) => setFormData({...formData, score_candidate_away: e.target.value})}
                                    placeholder="Optional"
                                    min="0"
                                    max="20"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Confidence Score (0-100)</Label>
                            <Input 
                                type="number" 
                                value={formData.confidence_score}
                                onChange={(e) => setFormData({...formData, confidence_score: e.target.value})}
                                min="0"
                                max="100"
                            />
                        </div>

                        <div>
                            <Label>Reasons JSON (required)</Label>
                            <Textarea 
                                value={formData.reasons_json}
                                onChange={(e) => setFormData({...formData, reasons_json: e.target.value})}
                                placeholder='["Manual admin override", "Testing finalizer"]'
                                rows={3}
                            />
                        </div>

                        <Button onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : 'Save Validation'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Match</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Locked</TableHead>
                                <TableHead>Reasons</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {matches.map(match => {
                                const validation = validationsMap[match.id];
                                const homeTeam = teamsMap[match.home_team_id];
                                const awayTeam = teamsMap[match.away_team_id];
                                const reasons = validation ? JSON.parse(validation.reasons_json || '[]') : [];

                                return (
                                    <TableRow 
                                        key={match.id}
                                        className={validation?.confidence_score === 0 ? 'bg-red-50' : !validation ? 'bg-gray-50' : ''}
                                    >
                                        <TableCell>
                                            <div className="font-medium">
                                                {homeTeam?.name || 'TBD'} vs {awayTeam?.name || 'TBD'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(match.kickoff_at).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {validation ? (
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    validation.status_candidate === 'FINAL' ? 'bg-blue-100 text-blue-800' :
                                                    validation.status_candidate === 'LIVE' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {validation.status_candidate}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">No validation</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {validation && validation.score_candidate_home !== null && validation.score_candidate_away !== null ? (
                                                <span className="font-mono">
                                                    {validation.score_candidate_home}-{validation.score_candidate_away}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {validation ? (
                                                <span className={`px-2 py-1 rounded text-xs font-mono ${
                                                    validation.confidence_score >= 70 ? 'bg-green-100 text-green-800' :
                                                    validation.confidence_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {validation.confidence_score}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {validation?.locked_final ? (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Locked</span>
                                            ) : (
                                                <span className="text-gray-400">Open</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-600 max-w-xs">
                                            {reasons.map((r, i) => (
                                                <div key={i}>• {r}</div>
                                            ))}
                                        </TableCell>
                                        <TableCell>
                                            {!validation?.locked_final && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => handleCreateValidation(match)}
                                                >
                                                    <Plus className="w-3 h-3 mr-1" />
                                                    {validation ? 'Edit' : 'Create'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}