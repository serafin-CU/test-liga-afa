import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const DEPARTMENTS = [
    "Engineering", "Product", "CX", "Operations", "Marketing",
    "Design", "People", "Finance", "Culinary", "Leadership",
    "Data & Analytics", "Sales"
];

export default function Profile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    
    const { data: currentUser, refetch: refetchUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const { data: preferredTeam } = useQuery({
        queryKey: ['team', currentUser?.preferred_team_id],
        queryFn: () => currentUser?.preferred_team_id ? 
            base44.entities.Team.get(currentUser.preferred_team_id) : null,
        enabled: !!currentUser?.preferred_team_id
    });

    const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
    const [department, setDepartment] = useState(currentUser?.department || '');
    const [preferredTeamId, setPreferredTeamId] = useState(currentUser?.preferred_team_id || '');
    const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setAvatarUrl(file_url);
        } catch (err) {
            console.error('Upload failed:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await base44.auth.updateMe({
                display_name: displayName,
                department,
                preferred_team_id: preferredTeamId,
                avatar_url: avatarUrl
            });
            await refetchUser();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen p-6" style={{ background: '#f9fafb' }}>
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-sm mb-8 transition-colors"
                    style={{ color: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                        Your Profile
                    </h1>
                    <p className="text-gray-600 mt-1" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        Tu perfil de Liga AFA
                    </p>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
                    {/* Avatar */}
                    <div>
                        <label className="block text-sm font-semibold mb-4" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                            Profile Picture
                        </label>
                        <div className="flex items-center gap-6">
                            <div
                                className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer border-2 transition-all hover:opacity-80"
                                style={{
                                    borderColor: CU.orange,
                                    background: avatarUrl ? 'transparent' : CU.orange + '20'
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <Upload className="w-6 h-6" style={{ color: CU.orange }} />
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    background: CU.orange + '20',
                                    color: CU.orange
                                }}
                            >
                                Change
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-sm font-semibold mb-3" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border-2 text-sm"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                borderColor: CU.orange,
                                color: CU.charcoal
                            }}
                        />
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-sm font-semibold mb-3" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                            Department
                        </label>
                        <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border-2 text-sm"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                borderColor: CU.orange,
                                color: CU.charcoal
                            }}
                        >
                            <option value="">Select a department</option>
                            {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    {/* Favorite Team */}
                    <div>
                        <label className="block text-sm font-semibold mb-3" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                            Favorite Team 🌍
                        </label>
                        <select
                            value={preferredTeamId}
                            onChange={(e) => setPreferredTeamId(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border-2 text-sm"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                borderColor: CU.orange,
                                color: CU.charcoal
                            }}
                        >
                            <option value="">Select a team</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name} ({team.fifa_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-3 pt-6 border-t">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-3 rounded-lg text-white font-semibold transition-opacity"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                background: CU.magenta,
                                opacity: saving ? 0.6 : 1,
                                cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>

                        {saved && (
                            <div className="flex-1 py-3 rounded-lg text-white font-semibold flex items-center justify-center" style={{ background: CU.green }}>
                                ✓ Saved!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}