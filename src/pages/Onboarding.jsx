import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search, Upload, X } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
};

const DEPARTMENTS = [
    "Engineering", "Product", "CX", "Operations", "Marketing",
    "Design", "People", "Finance", "Culinary", "Leadership",
    "Data & Analytics", "Sales"
];

function ProgressDots({ current, total }) {
    return (
        <div className="flex gap-2 justify-center">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className="h-2.5 rounded-full transition-colors"
                    style={{
                        width: '24px',
                        background: i <= current ? CU.orange : '#4b5563'
                    }}
                />
            ))}
        </div>
    );
}

function Step1({ displayName, setDisplayName, onNext, onSkip }) {
    return (
        <div className="max-w-md w-full">
            <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Bienvenido a Liga AFA Test ⚽
            </h1>
            <p className="text-white/60 mb-8" style={{ fontFamily: "'Raleway', sans-serif" }}>
                This is how you'll appear on the leaderboard
            </p>
            
            <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="w-full px-4 py-3 rounded-lg text-sm mb-6 border-2"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    borderColor: CU.orange,
                    background: 'white',
                    color: CU.charcoal
                }}
            />
            
            <button
                onClick={onNext}
                disabled={!displayName.trim()}
                className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: displayName.trim() ? CU.magenta : '#9ca3af',
                    opacity: displayName.trim() ? 1 : 0.6,
                    cursor: displayName.trim() ? 'pointer' : 'not-allowed'
                }}
            >
                Next <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function Step2({ department, setDepartment, onNext, onSkip }) {
    return (
        <div className="max-w-2xl w-full">
            <h1 className="text-4xl font-bold text-white mb-8 text-center" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Which CookUnity team are you on?
            </h1>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {DEPARTMENTS.map((dept) => (
                    <button
                        key={dept}
                        onClick={() => setDepartment(dept)}
                        className="px-4 py-3 rounded-xl font-semibold text-sm transition-all"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            background: department === dept ? CU.orange + '33' : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: department === dept ? `2px solid ${CU.orange}` : '2px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer'
                        }}
                    >
                        {dept}
                    </button>
                ))}
            </div>
            
            <button
                onClick={onNext}
                disabled={!department}
                className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: department ? CU.magenta : '#9ca3af',
                    opacity: department ? 1 : 0.6,
                    cursor: department ? 'pointer' : 'not-allowed'
                }}
            >
                Next <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function Step3({ preferredTeamId, setPreferredTeamId, onNext, onSkip }) {
    const [search, setSearch] = useState('');
    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.fifa_code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-2xl w-full max-h-[600px] flex flex-col">
            <h1 className="text-4xl font-bold text-white mb-2 text-center" style={{ fontFamily: "'DM Serif Display', serif" }}>
                ¿De qué equipo sos? 🇦🇷
            </h1>
            <p className="text-white/60 text-center mb-6" style={{ fontFamily: "'Raleway', sans-serif" }}>
                Solo para el honor — no afecta tu equipo Fantasy
            </p>
            
            <div className="mb-6 flex gap-2">
                <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search teams..."
                    className="flex-1 px-4 py-2 rounded-lg text-sm border-2"
                    style={{
                        fontFamily: "'Raleway', sans-serif",
                        borderColor: CU.orange,
                        background: 'white',
                        color: CU.charcoal
                    }}
                />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 overflow-y-auto">
                {filtered.map((team) => (
                    <button
                        key={team.id}
                        onClick={() => setPreferredTeamId(team.id)}
                        className="px-3 py-3 rounded-xl font-semibold text-sm transition-all text-center"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            background: preferredTeamId === team.id ? CU.orange + '33' : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: preferredTeamId === team.id ? `2px solid ${CU.orange}` : '2px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer'
                        }}
                    >
                        <div>{team.fifa_code}</div>
                        <div className="text-xs mt-1 opacity-80">{team.name}</div>
                    </button>
                ))}
            </div>
            
            <button
                onClick={onNext}
                disabled={!preferredTeamId}
                className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: preferredTeamId ? CU.magenta : '#9ca3af',
                    opacity: preferredTeamId ? 1 : 0.6,
                    cursor: preferredTeamId ? 'pointer' : 'not-allowed'
                }}
            >
                Next <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function Step4({ avatarUrl, setAvatarUrl, onNext, onSkip }) {
    const fileInputRef = React.useRef(null);

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

    return (
        <div className="max-w-md w-full">
            <h1 className="text-4xl font-bold text-white mb-8 text-center" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Show your face 📸
            </h1>
            
            <div
                className="mb-8 relative flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
                onClick={() => fileInputRef.current?.click()}
                style={{
                    width: '200px',
                    height: '200px',
                    margin: '0 auto',
                    borderRadius: '50%',
                    border: `3px dashed ${CU.orange}`,
                    background: 'rgba(255,255,255,0.05)'
                }}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover"
                    />
                ) : (
                    <div className="text-center text-white/60">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '12px' }}>Tap to upload</div>
                    </div>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                />
            </div>
            
            <button
                onClick={onNext}
                className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: CU.magenta,
                    cursor: 'pointer'
                }}
            >
                Finish <ChevronRight className="w-4 h-4" />
            </button>
            
            {!avatarUrl && (
                <button
                    onClick={onSkip}
                    className="w-full py-2 mt-3 text-white/60 font-semibold hover:text-white/80 transition"
                    style={{ fontFamily: "'Raleway', sans-serif" }}
                >
                    Add later
                </button>
            )}
        </div>
    );
}

function Completion({ displayName, department, preferredTeamId, avatarUrl }) {
    const navigate = useNavigate();
    const { data: team } = useQuery({
        queryKey: ['team', preferredTeamId],
        queryFn: () => preferredTeamId ? base44.entities.Team.get(preferredTeamId) : null,
        enabled: !!preferredTeamId
    });

    return (
        <div className="max-w-md w-full text-center">
            <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
                You're in! 🎉
            </h1>
            
            <div className="mt-8 mb-8 space-y-4">
                {avatarUrl && (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-32 h-32 rounded-full mx-auto object-cover border-4"
                        style={{ borderColor: CU.orange }}
                    />
                )}
                
                <div>
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>
                        {displayName}
                    </div>
                    <div className="text-white/60" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        {department}
                    </div>
                </div>
                
                {team && (
                    <div className="text-lg text-white" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        🏆 {team.name}
                    </div>
                )}
            </div>
            
            <div className="space-y-3">
                <button
                    onClick={() => navigate('/ProdePredictions')}
                    className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                    style={{
                        fontFamily: "'Raleway', sans-serif",
                        background: CU.magenta,
                        cursor: 'pointer'
                    }}
                >
                    Start Predicting <ChevronRight className="w-4 h-4" />
                </button>
                
                <button
                    onClick={() => navigate('/SquadBuilder')}
                    className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                    style={{
                        fontFamily: "'Raleway', sans-serif",
                        background: CU.orange + '80',
                        cursor: 'pointer'
                    }}
                >
                    Build My Squad <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function Onboarding() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(0);
    const [displayName, setDisplayName] = useState('');
    const [department, setDepartment] = useState('');
    const [preferredTeamId, setPreferredTeamId] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    useEffect(() => {
        if (currentUser?.email) {
            const guess = currentUser.email.split('@')[0];
            setDisplayName(guess);
        }
    }, [currentUser]);

    async function saveAndContinue(newStep) {
        if (newStep < 4) {
            setStep(newStep);
            return;
        }

        setSaving(true);
        try {
            await base44.auth.updateMe({
                display_name: displayName,
                department,
                preferred_team_id: preferredTeamId,
                avatar_url: avatarUrl,
                onboarding_completed: true
            });
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
            setStep(4);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    }

    async function handleSkip() {
        setSaving(true);
        try {
            await base44.auth.updateMe({
                display_name: displayName || (currentUser?.email.split('@')[0] || 'User'),
                department: department || 'Other',
                preferred_team_id: preferredTeamId || '',
                avatar_url: avatarUrl || '',
                onboarding_completed: true
            });
            navigate('/');
        } catch (err) {
            console.error('Skip failed:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center p-4"
            style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif", zIndex: 9999 }}
        >
            {/* Skip button */}
            <button
                onClick={handleSkip}
                disabled={saving}
                className="absolute top-6 right-6 text-white/60 hover:text-white transition"
                style={{ fontFamily: "'Raleway', sans-serif", cursor: saving ? 'not-allowed' : 'pointer' }}
            >
                Skip
            </button>
            
            {/* Progress */}
            <div className="mb-12">
                <ProgressDots current={step} total={4} />
            </div>

            {/* Step content */}
            {step === 0 && (
                <Step1
                    displayName={displayName}
                    setDisplayName={setDisplayName}
                    onNext={() => saveAndContinue(1)}
                    onSkip={handleSkip}
                />
            )}
            {step === 1 && (
                <Step2
                    department={department}
                    setDepartment={setDepartment}
                    onNext={() => saveAndContinue(2)}
                    onSkip={handleSkip}
                />
            )}
            {step === 2 && (
                <Step3
                    preferredTeamId={preferredTeamId}
                    setPreferredTeamId={setPreferredTeamId}
                    onNext={() => saveAndContinue(3)}
                    onSkip={handleSkip}
                />
            )}
            {step === 3 && (
                <Step4
                    avatarUrl={avatarUrl}
                    setAvatarUrl={setAvatarUrl}
                    onNext={() => saveAndContinue(4)}
                    onSkip={handleSkip}
                />
            )}
            {step === 4 && (
                <Completion
                    displayName={displayName}
                    department={department}
                    preferredTeamId={preferredTeamId}
                    avatarUrl={avatarUrl}
                />
            )}
        </div>
    );
}