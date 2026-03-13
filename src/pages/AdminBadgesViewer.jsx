import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Award, Loader2 } from 'lucide-react';

export default function AdminBadgesViewer() {
    const [filterType, setFilterType] = useState('ALL');

    const { data: badges = [], isLoading: badgesLoading } = useQuery({
        queryKey: ['allBadges'],
        queryFn: () => base44.entities.BadgeAward.list('-awarded_at', 200)
    });

    const { data: users = [] } = useQuery({
        queryKey: ['allUsers'],
        queryFn: () => base44.entities.User.list()
    });

    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));

    const filtered = filterType === 'ALL' ? badges : badges.filter(b => b.badge_type === filterType);

    const parseMetadata = (json) => {
        try { return JSON.parse(json); } catch { return {}; }
    };

    const badgeColor = (type) => type === 'CORE_KEEPER'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-amber-100 text-amber-800 border-amber-200';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Award className="w-7 h-7 text-amber-500" />
                    Badges Viewer
                </h1>
                <p className="text-gray-500 mt-1">Audit trail for all earned cosmetic badges</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">Total Badges</div>
                        <div className="text-2xl font-bold">{badges.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">CORE_KEEPER</div>
                        <div className="text-2xl font-bold text-blue-600">
                            {badges.filter(b => b.badge_type === 'CORE_KEEPER').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">LOYAL_CORE</div>
                        <div className="text-2xl font-bold text-amber-600">
                            {badges.filter(b => b.badge_type === 'LOYAL_CORE').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle>All Badge Awards</CardTitle>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Types</SelectItem>
                            <SelectItem value="CORE_KEEPER">CORE_KEEPER</SelectItem>
                            <SelectItem value="LOYAL_CORE">LOYAL_CORE</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="p-0">
                    {badgesLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No badges found
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Badge</TableHead>
                                    <TableHead>Phase</TableHead>
                                    <TableHead>Awarded At</TableHead>
                                    <TableHead>Kept / Threshold</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(badge => {
                                    const user = usersMap[badge.user_id];
                                    const meta = parseMetadata(badge.metadata_json);
                                    return (
                                        <TableRow key={badge.id}>
                                            <TableCell className="text-sm">
                                                <div>{user?.email || <span className="text-gray-400">unknown</span>}</div>
                                                <div className="text-xs text-gray-400">{badge.user_id?.slice(-8)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${badgeColor(badge.badge_type)}`}>
                                                    {badge.badge_type === 'CORE_KEEPER' ? '🛡️' : '⭐'} {badge.badge_type}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm">{badge.phase || '—'}</TableCell>
                                            <TableCell className="text-sm">
                                                {badge.awarded_at
                                                    ? new Date(badge.awarded_at).toLocaleString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {meta.kept_count !== undefined
                                                    ? `${meta.kept_count} / ${meta.threshold}`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {meta.base_phase ? `vs ${meta.base_phase}` : ''}
                                                {meta.prev_phase ? `vs ${meta.prev_phase}` : ''}
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