import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, Save, X, Trash2, AlertCircle } from 'lucide-react';

export default function AdminMatchSourceLinks() {
    const [editingLink, setEditingLink] = useState(null);
    const [editUrl, setEditUrl] = useState('');
    const [editRole, setEditRole] = useState('FALLBACK');
    const [alert, setAlert] = useState(null);
    const [addingToMatch, setAddingToMatch] = useState(null);
    const [newLinkData, setNewLinkData] = useState({ source_id: '', role: 'FALLBACK', url: '' });
    const queryClient = useQueryClient();

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches'],
        queryFn: async () => {
            const all = await base44.entities.Match.list();
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return all.filter(m => new Date(m.kickoff_at) <= thirtyDaysFromNow).sort((a, b) => 
                new Date(a.kickoff_at) - new Date(b.kickoff_at)
            );
        }
    });

    const { data: links = [] } = useQuery({
        queryKey: ['matchSourceLinks'],
        queryFn: () => base44.entities.MatchSourceLink.list()
    });

    const { data: allSources = [] } = useQuery({
        queryKey: ['dataSources'],
        queryFn: () => base44.entities.DataSource.list()
    });

    // Filter to show only enabled sources
    const sources = allSources.filter(s => s.enabled);

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const updateLinkMutation = useMutation({
        mutationFn: async ({ id, url, source_id, role, match_id }) => {
            // Validate URL (allows empty for placeholders)
            const validation = await base44.functions.invoke('adminValidationService', {
                action: 'validate_match_source_link',
                url: url && url.trim() !== '' ? url : null,
                source_id
            });

            if (!validation.data.valid) {
                throw new Error(validation.data.errors.join(', '));
            }

            // Validate role constraints: exactly 1 PRIMARY per match
            if (role === 'PRIMARY') {
                const matchLinks = links.filter(l => l.match_id === match_id && l.id !== id);
                const otherPrimary = matchLinks.find(l => l.role === 'PRIMARY');
                if (otherPrimary) {
                    throw new Error('This match already has a PRIMARY source. Change it to FALLBACK first.');
                }
            }

            return base44.entities.MatchSourceLink.update(id, { 
                url: url && url.trim() !== '' ? url : null,
                role
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setEditingLink(null);
            setEditUrl('');
            setEditRole('FALLBACK');
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });

    const deleteLinkMutation = useMutation({
        mutationFn: async ({ linkId, matchId }) => {
            const user = await base44.auth.me();
            const matchLinks = links.filter(l => l.match_id === matchId);
            if (matchLinks.length <= 1) {
                throw new Error('Cannot delete the last source link for this match. Add another link first.');
            }
            
            const link = links.find(l => l.id === linkId);
            await base44.entities.MatchSourceLink.delete(linkId);

            // Log deletion
            await base44.entities.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'DELETE_MATCH_SOURCE_LINK',
                entity_type: 'MatchSourceLink',
                entity_id: linkId,
                reason: 'Manually deleted source link',
                details_json: JSON.stringify({ match_id: matchId, source_id: link?.source_id, role: link?.role })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setAlert({ type: 'success', message: 'Source link deleted successfully' });
            setTimeout(() => setAlert(null), 3000);
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });

    const createLinkMutation = useMutation({
        mutationFn: async ({ match_id, source_id, role, url }) => {
            const user = await base44.auth.me();
            
            // Check for duplicate source
            const existingLink = links.find(l => l.match_id === match_id && l.source_id === source_id);
            if (existingLink) {
                throw new Error('This match already has a link for this source');
            }

            // Validate URL if provided
            if (url && url.trim() !== '') {
                const validation = await base44.functions.invoke('adminValidationService', {
                    action: 'validate_match_source_link',
                    url: url.trim(),
                    source_id
                });

                if (!validation.data.valid) {
                    throw new Error(validation.data.errors.join(', '));
                }
            }

            const matchLinks = links.filter(l => l.match_id === match_id);
            const existingPrimary = matchLinks.find(l => l.role === 'PRIMARY');

            // Handle PRIMARY constraint
            if (role === 'PRIMARY' && existingPrimary) {
                const shouldReplace = window.confirm(
                    'This match already has a PRIMARY source. Replace it with this new one? (Old PRIMARY will become FALLBACK)'
                );
                
                if (!shouldReplace) {
                    throw new Error('Cancelled: Match already has PRIMARY source');
                }

                // Demote existing PRIMARY to FALLBACK
                await base44.entities.MatchSourceLink.update(existingPrimary.id, { role: 'FALLBACK' });
                
                // Log the replacement
                await base44.entities.AdminAuditLog.create({
                    admin_user_id: user.id,
                    actor_type: 'ADMIN',
                    action: 'UPDATE_MATCH_SOURCE_LINK',
                    entity_type: 'MatchSourceLink',
                    entity_id: existingPrimary.id,
                    reason: 'Demoted to FALLBACK to make room for new PRIMARY',
                    details_json: JSON.stringify({ old_role: 'PRIMARY', new_role: 'FALLBACK' })
                });
            }

            // Check FALLBACK limit (max 2)
            if (role === 'FALLBACK') {
                const fallbackCount = matchLinks.filter(l => l.role === 'FALLBACK').length;
                if (fallbackCount >= 2) {
                    throw new Error('Match already has maximum (2) FALLBACK sources');
                }
            }

            // Create the link
            const newLink = await base44.entities.MatchSourceLink.create({
                match_id,
                source_id,
                role,
                url: url && url.trim() !== '' ? url.trim() : null,
                is_primary: role === 'PRIMARY'
            });

            // Log creation
            await base44.entities.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'CREATE_MATCH_SOURCE_LINK',
                entity_type: 'MatchSourceLink',
                entity_id: newLink.id,
                reason: 'Added new source link',
                details_json: JSON.stringify({ match_id, source_id, role, has_url: !!url })
            });

            return newLink;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setAddingToMatch(null);
            setNewLinkData({ source_id: '', role: 'FALLBACK', url: '' });
            setAlert({ type: 'success', message: 'Source link created successfully' });
            setTimeout(() => setAlert(null), 3000);
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });

    const bulkAddPromiedosMutation = useMutation({
        mutationFn: async () => {
            const user = await base44.auth.me();
            const promiedosSource = allSources.find(s => s.name === 'PROMIEDOS' && s.enabled);
            
            if (!promiedosSource) {
                throw new Error('PROMIEDOS data source not found or disabled');
            }

            let added = 0;
            let skipped = 0;

            for (const match of matches) {
                const matchLinks = links.filter(l => l.match_id === match.id);
                const hasPrimary = matchLinks.some(l => l.role === 'PRIMARY');
                const hasPromiedos = matchLinks.some(l => l.source_id === promiedosSource.id);

                if (!hasPrimary && !hasPromiedos) {
                    await base44.entities.MatchSourceLink.create({
                        match_id: match.id,
                        source_id: promiedosSource.id,
                        role: 'PRIMARY',
                        url: null,
                        is_primary: true
                    });
                    added++;
                } else {
                    skipped++;
                }
            }

            // Log bulk action
            await base44.entities.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'BULK_ADD_PROMIEDOS_PRIMARY',
                entity_type: 'MatchSourceLink',
                entity_id: 'BULK',
                reason: 'Bulk added PROMIEDOS as PRIMARY to matches missing primary source',
                details_json: JSON.stringify({ added, skipped })
            });

            return { added, skipped };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setAlert({ 
                type: 'success', 
                message: `Bulk add complete: ${data.added} PROMIEDOS PRIMARY links added, ${data.skipped} skipped`
            });
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });

    const cleanupOrphanedMutation = useMutation({
        mutationFn: async () => {
            const user = await base44.auth.me();
            const disabledSourceIds = allSources.filter(s => !s.enabled).map(s => s.id);
            const orphanedLinks = links.filter(l => disabledSourceIds.includes(l.source_id));
            
            if (orphanedLinks.length === 0) {
                throw new Error('No orphaned links found');
            }

            // Group by match to check safety
            const linksByMatch = {};
            links.forEach(l => {
                if (!linksByMatch[l.match_id]) linksByMatch[l.match_id] = [];
                linksByMatch[l.match_id].push(l);
            });

            const safeToDelete = orphanedLinks.filter(l => {
                const matchLinks = linksByMatch[l.match_id];
                const remainingLinks = matchLinks.filter(ml => !disabledSourceIds.includes(ml.source_id));
                return remainingLinks.length > 0; // Safe if at least 1 link remains
            });

            // Delete safe links
            for (const link of safeToDelete) {
                await base44.entities.MatchSourceLink.delete(link.id);
            }

            // Log audit
            await base44.entities.AdminAuditLog.create({
                admin_user_id: user.id,
                actor_type: 'ADMIN',
                action: 'CLEANUP_ORPHANED_SOURCE_LINKS',
                entity_type: 'MatchSourceLink',
                entity_id: 'BULK',
                reason: 'Removed orphaned source links from disabled data sources',
                details_json: JSON.stringify({
                    orphaned_count: orphanedLinks.length,
                    deleted_count: safeToDelete.length,
                    skipped_count: orphanedLinks.length - safeToDelete.length,
                    disabled_sources: disabledSourceIds
                })
            });

            return { deleted: safeToDelete.length, skipped: orphanedLinks.length - safeToDelete.length };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['matchSourceLinks'] });
            setAlert({ 
                type: 'success', 
                message: `Cleanup complete: ${data.deleted} orphaned links removed${data.skipped > 0 ? `, ${data.skipped} skipped (would leave match with 0 links)` : ''}`
            });
        },
        onError: (error) => {
            setAlert({ type: 'error', message: error.message });
        }
    });



    const teamsMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const sourcesMap = Object.fromEntries(sources.map(s => [s.id, s]));

    const getLinksForMatch = (matchId) => links.filter(l => l.match_id === matchId);

    const startEdit = (link) => {
        setEditingLink(link.id);
        setEditUrl(link.url || '');
        setEditRole(link.role || 'FALLBACK');
    };

    const saveEdit = (link) => {
        updateLinkMutation.mutate({ 
            id: link.id, 
            url: editUrl, 
            source_id: link.source_id,
            role: editRole,
            match_id: link.match_id
        });
    };

    if (matchesLoading) return <div className="p-8">Loading...</div>;

    const orphanedCount = links.filter(l => {
        const source = allSources.find(s => s.id === l.source_id);
        return !source || !source.enabled;
    }).length;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Match Source Links Management</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage data source links for upcoming matches (next 30 days)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        onClick={() => {
                            if (confirm('Add PROMIEDOS as PRIMARY to all matches that are missing a primary source?')) {
                                bulkAddPromiedosMutation.mutate();
                            }
                        }}
                        disabled={bulkAddPromiedosMutation.isPending}
                    >
                        Bulk: Add PROMIEDOS Primary
                    </Button>
                    {orphanedCount > 0 && (
                        <Button 
                            variant="destructive" 
                            onClick={() => {
                                if (confirm(`Remove ${orphanedCount} orphaned/disabled source links?`)) {
                                    cleanupOrphanedMutation.mutate();
                                }
                            }}
                            disabled={cleanupOrphanedMutation.isPending}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cleanup Orphaned ({orphanedCount})
                        </Button>
                    )}
                </div>
            </div>

            {alert && (
                <Alert className={`mb-4 ${alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <AlertDescription className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {alert.message}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                {matches.map(match => {
                    const homeTeam = teamsMap[match.home_team_id];
                    const awayTeam = teamsMap[match.away_team_id];
                    const matchLinks = getLinksForMatch(match.id);

                    return (
                        <Card key={match.id}>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">
                                        {homeTeam?.name || 'TBD'} vs {awayTeam?.name || 'TBD'}
                                        <span className="text-sm font-normal text-gray-500 ml-3">
                                            {new Date(match.kickoff_at).toLocaleString()} | {match.phase}
                                        </span>
                                    </CardTitle>
                                    <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setAddingToMatch(match.id)}
                                    >
                                        + Add Source Link
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>URL</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {addingToMatch === match.id && (
                                           <TableRow className="bg-blue-50">
                                               <TableCell>
                                                   <Select 
                                                       value={newLinkData.source_id} 
                                                       onValueChange={(val) => setNewLinkData({...newLinkData, source_id: val})}
                                                   >
                                                       <SelectTrigger className="w-40">
                                                           <SelectValue placeholder="Select source" />
                                                       </SelectTrigger>
                                                       <SelectContent>
                                                           {sources.map(s => (
                                                               <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                           ))}
                                                       </SelectContent>
                                                   </Select>
                                               </TableCell>
                                               <TableCell>
                                                   <Select 
                                                       value={newLinkData.role} 
                                                       onValueChange={(val) => setNewLinkData({...newLinkData, role: val})}
                                                   >
                                                       <SelectTrigger className="w-32">
                                                           <SelectValue />
                                                       </SelectTrigger>
                                                       <SelectContent>
                                                           <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                                                           <SelectItem value="FALLBACK">FALLBACK</SelectItem>
                                                       </SelectContent>
                                                   </Select>
                                               </TableCell>
                                               <TableCell>
                                                   <Input 
                                                       value={newLinkData.url}
                                                       onChange={(e) => setNewLinkData({...newLinkData, url: e.target.value})}
                                                       placeholder="https://... (optional)"
                                                   />
                                               </TableCell>
                                               <TableCell>
                                                   <div className="flex gap-2">
                                                       <Button 
                                                           size="sm" 
                                                           onClick={() => {
                                                               if (!newLinkData.source_id) {
                                                                   setAlert({ type: 'error', message: 'Please select a source' });
                                                                   return;
                                                               }
                                                               createLinkMutation.mutate({
                                                                   match_id: match.id,
                                                                   ...newLinkData
                                                               });
                                                           }}
                                                           disabled={createLinkMutation.isPending}
                                                       >
                                                           <Save className="w-4 h-4" />
                                                       </Button>
                                                       <Button 
                                                           size="sm" 
                                                           variant="outline" 
                                                           onClick={() => {
                                                               setAddingToMatch(null);
                                                               setNewLinkData({ source_id: '', role: 'FALLBACK', url: '' });
                                                           }}
                                                       >
                                                           <X className="w-4 h-4" />
                                                       </Button>
                                                   </div>
                                               </TableCell>
                                           </TableRow>
                                       )}
                                       {matchLinks.map(link => {
                                            const source = sourcesMap[link.source_id];
                                            const isEditing = editingLink === link.id;
                                            const isOrphaned = !source || !allSources.find(s => s.id === link.source_id)?.enabled;

                                            return (
                                                <TableRow key={link.id} className={isOrphaned ? 'bg-red-50' : ''}>
                                                    <TableCell className="font-medium">
                                                        {source?.name || 'Unknown'}
                                                        {isOrphaned && (
                                                            <span className="ml-2 text-xs text-red-600">(disabled)</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <Select value={editRole} onValueChange={setEditRole}>
                                                                <SelectTrigger className="w-32">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                                                                    <SelectItem value="FALLBACK">FALLBACK</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                                link.role === 'PRIMARY' 
                                                                    ? 'bg-blue-100 text-blue-800' 
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {link.role || 'FALLBACK'}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <Input 
                                                                value={editUrl}
                                                                onChange={(e) => setEditUrl(e.target.value)}
                                                                placeholder="https://... (leave empty for placeholder)"
                                                            />
                                                        ) : (
                                                            <span className="text-sm">
                                                                {link.url ? (
                                                                    link.url
                                                                ) : (
                                                                    <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">
                                                                        Needs URL
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            {isEditing ? (
                                                                <>
                                                                    <Button size="sm" onClick={() => saveEdit(link)}>
                                                                        <Save className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" onClick={() => setEditingLink(null)}>
                                                                        <X className="w-4 h-4" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Button size="sm" variant="ghost" onClick={() => startEdit(link)}>
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="ghost" 
                                                                        onClick={() => {
                                                                            if (confirm('Delete this source link?')) {
                                                                                deleteLinkMutation.mutate({ linkId: link.id, matchId: link.match_id });
                                                                            }
                                                                        }}
                                                                        disabled={deleteLinkMutation.isPending}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {matchLinks.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-gray-500">
                                                    No source links configured
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}