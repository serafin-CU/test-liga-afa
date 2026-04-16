import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, LogOut, Shield, Trophy, Target, LayoutDashboard, User } from 'lucide-react';
import AlbaChatWidget from '@/components/AlbaChatWidget';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const navItems = [
    { name: 'Dashboard', label: 'Inicio', icon: LayoutDashboard },
    { name: 'ProdePredictions', label: 'Prode', icon: Target },
    { name: 'SquadManagement', label: 'Mi Equipo', icon: Users },
    { name: 'Leaderboard', label: 'Tabla', icon: Trophy },
    { name: 'Profile', label: 'Perfil', icon: User }
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
            {/* Desktop top nav */}
            <nav className="hidden md:block" style={{ background: CU.charcoal, borderTop: `2px solid ${CU.orange}` }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <Link to="/Dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: 'white', lineHeight: 1 }}>⚽ Liga Profesional</span>
                                <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.7rem', color: CU.orange, lineHeight: 1 }}>Apertura 2025</span>
                            </Link>
                            <div className="flex items-center gap-1">
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
                                <Link to="/AdminDataSync">
                                    <button style={{
                                        fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.8rem',
                                        color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '6px',
                                        padding: '5px 12px', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        <Shield className="w-3.5 h-3.5" /> Admin
                                    </button>
                                </Link>
                            )}
                            {currentUser && (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                                        {currentUser.email}
                                    </span>
                                    <button onClick={handleLogout} style={{
                                        fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.6)',
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontSize: '0.875rem', padding: '6px 8px', borderRadius: '6px'
                                    }}>
                                        <LogOut className="w-4 h-4" /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile top bar */}
            <div className="md:hidden flex items-center justify-between px-4 h-12" style={{ background: CU.charcoal, borderTop: `2px solid ${CU.orange}` }}>
                <Link to="/Dashboard" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'white' }}>⚽ Apertura 2025</span>
                </Link>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Link to="/AdminDataSync">
                            <button style={{
                                fontSize: '0.7rem', color: CU.orange, border: `1px solid ${CU.orange}50`,
                                borderRadius: '4px', padding: '3px 8px', background: 'transparent', cursor: 'pointer',
                                fontFamily: "'Raleway', sans-serif", fontWeight: 600
                            }}>Admin</button>
                        </Link>
                    )}
                    <button onClick={handleLogout} style={{
                        color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none',
                        cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
                    }}>
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <main>
                {children}
            </main>

            {/* Mobile bottom nav — scrollable, 44px touch targets */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 overflow-x-auto"
                 style={{ background: CU.charcoal, borderTop: `2px solid ${CU.orange}30`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex min-w-max">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = currentPageName === item.name;
                        return (
                            <Link
                                key={item.name}
                                to={`/${item.name}`}
                                style={{ textDecoration: 'none', flex: 1 }}
                            >
                                <div className="flex flex-col items-center justify-center px-3 py-2"
                                     style={{ minHeight: '52px', minWidth: '56px', color: isActive ? CU.orange : 'rgba(255,255,255,0.55)' }}>
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <span className="mt-0.5 text-center whitespace-nowrap"
                                          style={{ fontSize: '9px', fontFamily: "'Raleway', sans-serif", fontWeight: isActive ? 700 : 500 }}>
                                        {item.label}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Spacer so content isn't hidden behind mobile nav */}
            <div className="md:hidden h-16" />

            <AlbaChatWidget userName={currentUser?.display_name || currentUser?.full_name || ''} />
        </div>
    );
}