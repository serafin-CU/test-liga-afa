import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Trash2, Database, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'dev_seed_records';

export default function AdminDevSeed() {
    const [seeding, setSeeding] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [seedData, setSeedData] = useState(null);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setSeedData(JSON.parse(stored));
        }
    }, []);

    const seedDevData = async () => {
        setSeeding(true);
        setSummary(null);
        
        const seedId = `seed_${Date.now()}`;
        const created = {
            seedId,
            teams: [],
            players: [],
            matches: [],
            dataSources: [],
            matchSourceLinks: [],
            appConfig: null
        };

        try {
            // 1. Ensure AppConfig exists
            const configs = await base44.entities.AppConfig.list();
            if (configs.length === 0) {
                const tournamentStart = new Date();
                tournamentStart.setDate(tournamentStart.getDate() + 60);
                
                const squadLock = new Date(tournamentStart);
                squadLock.setDate(squadLock.getDate() - 7);

                const config = await base44.entities.AppConfig.create({
                    tournament_start_at: tournamentStart.toISOString(),
                    squad_lock_at: squadLock.toISOString(),
                    tournament_phase: 'PRE_TOURNAMENT',
                    transfer_window_state: 'OPEN'
                });
                created.appConfig = config.id;
            }

            // 2. Create DataSources
            const sources = await base44.entities.DataSource.list();
            const fifaExists = sources.find(s => s.name === 'FIFA');
            const wikiExists = sources.find(s => s.name === 'WIKIPEDIA');

            if (!fifaExists) {
                const fifa = await base44.entities.DataSource.create({
                    name: 'FIFA',
                    base_url: 'https://www.fifa.com',
                    allowed_paths_regex: '/.*',
                    rate_limit_seconds: 30,
                    enabled: true,
                    notes: JSON.stringify({ dev_seed_id: seedId })
                });
                created.dataSources.push(fifa.id);
            }

            if (!wikiExists) {
                const wiki = await base44.entities.DataSource.create({
                    name: 'WIKIPEDIA',
                    base_url: 'https://en.wikipedia.org',
                    allowed_paths_regex: '/wiki/.*',
                    rate_limit_seconds: 30,
                    enabled: true,
                    notes: JSON.stringify({ dev_seed_id: seedId })
                });
                created.dataSources.push(wiki.id);
            }

            // Get sources for later use
            const allSources = await base44.entities.DataSource.list();
            const fifaSource = allSources.find(s => s.name === 'FIFA');
            const wikiSource = allSources.find(s => s.name === 'WIKIPEDIA');

            // 3. Create Teams
            const teams = await base44.entities.Team.list();
            let usaTeam = teams.find(t => t.fifa_code === 'USA');
            let argTeam = teams.find(t => t.fifa_code === 'ARG');

            if (!usaTeam) {
                usaTeam = await base44.entities.Team.create({
                    name: `USA [DEV-${seedId}]`,
                    fifa_code: 'USA',
                    is_qualified: true
                });
                created.teams.push(usaTeam.id);
            }

            if (!argTeam) {
                argTeam = await base44.entities.Team.create({
                    name: `ARG [DEV-${seedId}]`,
                    fifa_code: 'ARG',
                    is_qualified: true
                });
                created.teams.push(argTeam.id);
            }

            // 4. Create Players
            const players = await base44.entities.Player.list();
            const usaPlayers = players.filter(p => p.team_id === usaTeam.id);
            const argPlayers = players.filter(p => p.team_id === argTeam.id);

            if (usaPlayers.length < 4) {
                const usaPlayerData = [
                    { full_name: `USA GK [DEV-${seedId}]`, position: 'GK', price: 6 },
                    { full_name: `USA DEF [DEV-${seedId}]`, position: 'DEF', price: 7 },
                    { full_name: `USA MID [DEV-${seedId}]`, position: 'MID', price: 8 },
                    { full_name: `USA FWD [DEV-${seedId}]`, position: 'FWD', price: 9 }
                ];

                for (const pd of usaPlayerData) {
                    const player = await base44.entities.Player.create({
                        ...pd,
                        team_id: usaTeam.id,
                        is_active: true
                    });
                    created.players.push(player.id);
                }
            }

            if (argPlayers.length < 4) {
                const argPlayerData = [
                    { full_name: `ARG GK [DEV-${seedId}]`, position: 'GK', price: 6 },
                    { full_name: `ARG DEF [DEV-${seedId}]`, position: 'DEF', price: 7 },
                    { full_name: `ARG MID [DEV-${seedId}]`, position: 'MID', price: 9 },
                    { full_name: `ARG FWD [DEV-${seedId}]`, position: 'FWD', price: 10 }
                ];

                for (const pd of argPlayerData) {
                    const player = await base44.entities.Player.create({
                        ...pd,
                        team_id: argTeam.id,
                        is_active: true
                    });
                    created.players.push(player.id);
                }
            }

            // 5. Create Matches
            const now = new Date();
            
            const future = new Date(now);
            future.setHours(future.getHours() + 4);

            const past = new Date(now);
            past.setHours(past.getHours() - 6);

            const match1 = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: future.toISOString(),
                home_team_id: usaTeam.id,
                away_team_id: argTeam.id,
                status: 'SCHEDULED',
                venue: `DEV-${seedId}-FUTURE`
            });
            created.matches.push(match1.id);

            const match2 = await base44.entities.Match.create({
                phase: 'GROUP_MD1',
                kickoff_at: past.toISOString(),
                home_team_id: usaTeam.id,
                away_team_id: argTeam.id,
                status: 'SCHEDULED',
                venue: `DEV-${seedId}-PAST`
            });
            created.matches.push(match2.id);

            // 6. Create MatchSourceLink placeholders
            const matches = [match1, match2];
            for (const match of matches) {
                if (fifaSource) {
                    const existing = await base44.entities.MatchSourceLink.filter({
                        match_id: match.id,
                        source_id: fifaSource.id
                    });

                    if (existing.length === 0) {
                        const link = await base44.entities.MatchSourceLink.create({
                            match_id: match.id,
                            source_id: fifaSource.id,
                            url: null,
                            is_primary: true
                        });
                        created.matchSourceLinks.push(link.id);
                    }
                }

                if (wikiSource) {
                    const existing = await base44.entities.MatchSourceLink.filter({
                        match_id: match.id,
                        source_id: wikiSource.id
                    });

                    if (existing.length === 0) {
                        const link = await base44.entities.MatchSourceLink.create({
                            match_id: match.id,
                            source_id: wikiSource.id,
                            url: null,
                            is_primary: false
                        });
                        created.matchSourceLinks.push(link.id);
                    }
                }
            }

            // Store in localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
            setSeedData(created);

            setSummary({
                success: true,
                message: 'Dev data seeded successfully',
                counts: {
                    teams: created.teams.length,
                    players: created.players.length,
                    matches: created.matches.length,
                    dataSources: created.dataSources.length,
                    matchSourceLinks: created.matchSourceLinks.length,
                    appConfig: created.appConfig ? 1 : 0
                }
            });

        } catch (error) {
            setSummary({
                success: false,
                message: 'Seeding failed: ' + error.message
            });
        }

        setSeeding(false);
    };

    const deleteDevSeed = async () => {
        if (!seedData) {
            alert('No dev seed data to delete');
            return;
        }

        if (!confirm('Delete all dev seed data? This cannot be undone.')) {
            return;
        }

        setDeleting(true);
        const deleted = {
            teams: 0,
            players: 0,
            matches: 0,
            dataSources: 0,
            matchSourceLinks: 0
        };

        try {
            // Delete in reverse order (children first)
            for (const id of seedData.matchSourceLinks) {
                try {
                    await base44.entities.MatchSourceLink.delete(id);
                    deleted.matchSourceLinks++;
                } catch (e) {
                    console.warn('Failed to delete MatchSourceLink:', id, e);
                }
            }

            for (const id of seedData.matches) {
                try {
                    await base44.entities.Match.delete(id);
                    deleted.matches++;
                } catch (e) {
                    console.warn('Failed to delete Match:', id, e);
                }
            }

            for (const id of seedData.players) {
                try {
                    await base44.entities.Player.delete(id);
                    deleted.players++;
                } catch (e) {
                    console.warn('Failed to delete Player:', id, e);
                }
            }

            for (const id of seedData.teams) {
                try {
                    await base44.entities.Team.delete(id);
                    deleted.teams++;
                } catch (e) {
                    console.warn('Failed to delete Team:', id, e);
                }
            }

            for (const id of seedData.dataSources) {
                try {
                    await base44.entities.DataSource.delete(id);
                    deleted.dataSources++;
                } catch (e) {
                    console.warn('Failed to delete DataSource:', id, e);
                }
            }

            localStorage.removeItem(STORAGE_KEY);
            setSeedData(null);

            setSummary({
                success: true,
                message: 'Dev seed data deleted successfully',
                counts: deleted
            });

        } catch (error) {
            setSummary({
                success: false,
                message: 'Deletion failed: ' + error.message
            });
        }

        setDeleting(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Dev Seed Data</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Seed Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Button 
                                onClick={seedDevData} 
                                disabled={seeding}
                                className="w-full"
                            >
                                {seeding ? (
                                    <>Seeding...</>
                                ) : (
                                    <>
                                        <Database className="w-4 h-4 mr-2" />
                                        Seed Dev Data
                                    </>
                                )}
                            </Button>
                            <p className="text-sm text-gray-500 mt-2">
                                Creates minimal dataset: 2 teams, 8 players, 2 matches, 2 data sources, 4 source links
                            </p>
                        </div>

                        {seedData && (
                            <div>
                                <Button 
                                    onClick={deleteDevSeed} 
                                    disabled={deleting}
                                    variant="destructive"
                                    className="w-full"
                                >
                                    {deleting ? (
                                        <>Deleting...</>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete Dev Seed Data
                                        </>
                                    )}
                                </Button>
                                <p className="text-sm text-gray-500 mt-2">
                                    Only deletes records created by the seed action
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>What Gets Seeded</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <div><strong>AppConfig:</strong> Ensures config row exists (tournament +60 days)</div>
                        <div><strong>DataSources:</strong> FIFA and WIKIPEDIA (with permissive regex for dev)</div>
                        <div><strong>Teams:</strong> USA (fifa_code=USA) and ARG (fifa_code=ARG)</div>
                        <div><strong>Players:</strong> 4 per team (GK, DEF, MID, FWD) with valid prices</div>
                        <div><strong>Matches:</strong> 2 matches (one +4h future, one -6h past for testing)</div>
                        <div><strong>Source Links:</strong> Placeholder links (url=null) for each match</div>
                    </CardContent>
                </Card>
            </div>

            {summary && (
                <Alert className={summary.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <AlertDescription>
                        <div className="flex items-start gap-2">
                            {summary.success ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}
                            <div>
                                <div className="font-semibold mb-2">{summary.message}</div>
                                {summary.counts && (
                                    <div className="text-sm space-y-1">
                                        {summary.counts.appConfig > 0 && <div>• AppConfig: {summary.counts.appConfig}</div>}
                                        {summary.counts.dataSources > 0 && <div>• Data Sources: {summary.counts.dataSources}</div>}
                                        {summary.counts.teams > 0 && <div>• Teams: {summary.counts.teams}</div>}
                                        {summary.counts.players > 0 && <div>• Players: {summary.counts.players}</div>}
                                        {summary.counts.matches > 0 && <div>• Matches: {summary.counts.matches}</div>}
                                        {summary.counts.matchSourceLinks > 0 && <div>• Source Links: {summary.counts.matchSourceLinks}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {seedData && summary?.success && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">1. Add Source URLs</div>
                                <div className="text-sm text-gray-600">
                                    Go to <strong>Admin → Match Source Links</strong> and fill in at least one valid URL for FIFA or Wikipedia
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">2. Run MatchWatcher</div>
                                <div className="text-sm text-gray-600">
                                    Trigger MatchWatcher manually or wait for scheduled run (every 10 min)
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">3. Monitor Results</div>
                                <div className="text-sm text-gray-600">
                                    Check <strong>Admin → Ingestion Monitor</strong> and <strong>Match Validation</strong> for results
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <div className="font-medium">4. Test Finalization</div>
                                <div className="text-sm text-gray-600">
                                    For the past match, manually set <strong>MatchValidation</strong> with confidence=100, then run Finalizer
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}