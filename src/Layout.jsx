import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import ParticipantLayout from '@/components/ParticipantLayout';
import AccessDenied from '@/components/AccessDenied';

export default function Layout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const isAdmin = currentUser?.role === 'admin';
    const isAdminPage = currentPageName?.startsWith('Admin');

    // Admin page protection
    if (isAdminPage && !isAdmin) {
        return <AccessDenied />;
    }

    // Route to appropriate layout
    if (isAdminPage) {
        return (
            <AdminLayout currentPageName={currentPageName}>
                {children}
            </AdminLayout>
        );
    }

    return (
        <ParticipantLayout currentPageName={currentPageName}>
            {children}
        </ParticipantLayout>
    );
}