import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, LogOut, Shield, MessageSquare } from 'lucide-react';


    const navItems = [
        { name: 'SquadManagement', label: 'My Squad', icon: Users },
        { name: 'FAFOChat', label: 'FAFO', icon: MessageSquare }
    ];

    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <div className="text-xl font-bold text-gray-900">
                                Fantasy Sports
                            </div>
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    
                                    return (
                                        <Link
                                            key={item.name}
                                            to={createPageUrl(item.name)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                            {isAdmin && (
                                <Link to={createPageUrl('AdminSystemTestHarness')}>
                                    <Button size="sm" variant="outline" className="gap-2">
                                        <Shield className="w-4 h-4" />
                                        Admin
                                    </Button>
                                </Link>
                            )}
                            {currentUser && (
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-gray-700 hidden sm:block">
                                        {currentUser.email}
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
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