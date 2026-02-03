import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AccessDenied() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
                        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                        <p className="text-gray-600">
                            You do not have permission to access this page. Admin access required.
                        </p>
                        <Link to={createPageUrl('SquadManagement')}>
                            <Button>Go to My Squad</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}