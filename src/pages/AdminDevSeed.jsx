import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Trash2, Database, ArrowRight, AlertCircle } from 'lucide-react';

export default function AdminDevSeed() {
    const [seeding, setSeeding] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [hasDevSeed, setHasDevSeed] = useState(false);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        checkDevSeed();
    }, []);

    const checkDevSeed = async () => {
        try {
            const teams = await base44.entities.Team.list();
            const hasDevData = teams.some(t => t.name && t.name.includes('[DEV-'));
            setHasDevSeed(hasDevData);
        } catch (error) {
            console.error('Failed to check dev seed:', error);
        }
    };

    const seedDevData = async () => {
        setSeeding(true);
        setSummary(null);
        
        try {
            const response = await base44.functions.invoke('devSeedService', {
                action: 'seed'
            });

            setSummary({
                success: response.data.success,
                message: response.data.message,
                counts: response.data.counts
            });

            if (response.data.success) {
                setHasDevSeed(true);
            }

        } catch (error) {
            setSummary({
                success: false,
                message: 'Seeding failed: ' + error.message,
                counts: { created: 0, reused: 0, skipped: 0 }
            });
        }

        setSeeding(false);
    };

    const deleteDevSeed = async () => {
        if (!hasDevSeed) {
            alert('No dev seed data to delete');
            return;
        }

        if (!confirm('Delete all dev seed data? This cannot be undone.')) {
            return;
        }

        setDeleting(true);
        setSummary(null);

        try {
            const response = await base44.functions.invoke('devSeedService', {
                action: 'delete'
            });

            setSummary({
                success: response.data.success,
                message: response.data.message,
                counts: response.data.counts
            });

            if (response.data.success) {
                setHasDevSeed(false);
            }

        } catch (error) {
            setSummary({
                success: false,
                message: 'Deletion failed: ' + error.message,
                counts: { deleted: 0 }
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

                        {hasDevSeed && (
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
                                        {summary.counts.created !== undefined && <div>• Created: {summary.counts.created}</div>}
                                        {summary.counts.reused !== undefined && <div>• Reused: {summary.counts.reused}</div>}
                                        {summary.counts.skipped !== undefined && summary.counts.skipped > 0 && <div>• Skipped: {summary.counts.skipped}</div>}
                                        {summary.counts.deleted !== undefined && <div>• Deleted: {summary.counts.deleted}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {hasDevSeed && summary?.success && (
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