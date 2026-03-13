import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
    LayoutGrid, FileText, Database, Settings, LogOut, 
    Home, Play, Link2, Eye, FileEdit, Archive, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const adminNavItems = [
        { name: 'AdminSystemTestHarness', label: 'Test Harness', icon: LayoutGrid },
        { name: 'AdminFantasyStatsViewer', label: 'Stats Viewer', icon: FileText },
        { name: 'AdminFantasyLedgerViewer', label: 'Ledger Viewer', icon: Database },
        { name: 'AdminMatchValidation', label: 'Match Validation', icon: Eye },
        { name: 'AdminMatchSourceLinks', label: 'Source Links', icon: Link2 },
        { name: 'AdminDataSources', label: 'Data Sources', icon: Archive },
        { name: 'AdminIngestionMonitor', label: 'Ingestion', icon: Play },
        { name: 'AdminManualOverride', label: 'Manual Override', icon: FileEdit },
        { name: 'AdminDevSeed', label: 'Dev Seed', icon: Settings },
        { name: 'AdminBadgesViewer', label: 'Badges', icon: Award }
    ];

    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-gray-900 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <div className="text-xl font-bold text-white">
                                Admin Dashboard
                            </div>
                            <div className="hidden lg:flex items-center gap-1">
                                {adminNavItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    
                                    return (
                                        <Link
                                            key={item.name}
                                            to={createPageUrl(item.name)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-gray-800 text-white'
                                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link to={createPageUrl('SquadManagement')}>
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Home className="w-4 h-4" />
                                    Back to App
                                </Button>
                            </Link>
                            {currentUser && (
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-gray-300 hidden sm:block">
                                        {currentUser.email}
                                        <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-semibold">
                                            ADMIN
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="hidden sm:inline">Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main>
                {children}
            </main>
        </div>
    );
}