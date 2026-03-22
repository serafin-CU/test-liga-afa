import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, LogOut, Shield, MessageSquare, Trophy, Target, LayoutDashboard } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const navItems = [
    { name: 'Dashboard', label: 'Home', icon: LayoutDashboard },
    { name: 'ProdePredictions', label: 'Prode', icon: Target },
    { name: 'SquadManagement', label: 'My Squad', icon: Users },
    { name: 'Leaderboard', label: 'Standings', icon: Trophy },
    { name: 'FAFOChat', label: 'FAFO', icon: MessageSquare }
];

export default function ParticipantLayout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const isAdmin = currentUser?.role === 'admin';

    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen" style={{ background: '#f9fafb' }}>
            <nav style={{ background: CU.charcoal }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <div style={{ fontFamily: "'DM Serif Display', serif", color: 'white', fontSize: '1.25rem' }}>
                                ScoreKeeper Pro
                            </div>
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={`/${item.name}`}
                                            style={{
                                                fontFamily: "'Raleway', sans-serif",
                                                fontWeight: 500,
                                                color: isActive ? CU.orange : 'rgba(255,255,255,0.75)',
                                                borderBottom: isActive ? `2px solid ${CU.orange}` : '2px solid transparent',
                                                padding: '0 12px',
                                                height: '64px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.875rem',
                                                textDecoration: 'none',
                                                transition: 'color 0.15s'
                                            }}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <Link to="/AdminSystemTestHarness">
                                    <button
                                        style={{
                                            fontFamily: "'Raleway', sans-serif",
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.5)',
                                            borderRadius: '6px',
                                            padding: '5px 12px',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Admin
                                    </button>
                                </Link>
                            )}
                            {currentUser && (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm hidden sm:block" style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                                        {currentUser.email}
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            fontFamily: "'Raleway', sans-serif",
                                            color: 'rgba(255,255,255,0.6)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.875rem',
                                            padding: '6px 8px',
                                            borderRadius: '6px'
                                        }}
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