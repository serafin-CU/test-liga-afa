import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

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
    const { data: teams = [], isLoading } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.fifa_code || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-2xl w-full flex flex-col" style={{ maxHeight: '80vh' }}>
            <h1 className="text-4xl font-bold text-white mb-2 text-center" style={{ fontFamily: "'DM Serif Display', serif" }}>
                ¿De qué equipo sos? 🇦🇷
            </h1>
            <p className="text-white/60 text-center mb-6" style={{ fontFamily: "'Raleway', sans-serif" }}>
                Solo para el honor — no afecta tu equipo Fantasy
            </p>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            ) : teams.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-white/60 mb-2" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        No hay equipos disponibles todavía.
                    </p>
                    <p className="text-white/40 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        Podés continuar y elegirlo más tarde desde tu perfil.
                    </p>
                </div>
            ) : (
                <>
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${CU.orange}40` }}>
                        <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar equipo..."
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40"
                            style={{ fontFamily: "'Raleway', sans-serif" }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-white/40 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 overflow-y-auto flex-1 pr-1">
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
                                <div className="font-bold">{team.fifa_code}</div>
                                <div className="text-xs mt-1 opacity-80 leading-tight">{team.name}</div>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="col-span-3 text-center text-white/40 py-8" style={{ fontFamily: "'Raleway', sans-serif" }}>
                                No se encontraron equipos
                            </div>
                        )}
                    </div>
                </>
            )}

            <button
                onClick={onNext}
                disabled={!preferredTeamId && teams.length > 0}
                className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity mt-2"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: (preferredTeamId || teams.length === 0) ? CU.magenta : '#9ca3af',
                    opacity: (preferredTeamId || teams.length === 0) ? 1 : 0.6,
                    cursor: (preferredTeamId || teams.length === 0) ? 'pointer' : 'not-allowed'
                }}
            >
                {teams.length === 0 ? 'Continuar sin elegir' : 'Next'} <ChevronRight className="w-4 h-4" />
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

function GameCard({ emoji, title, description, preview, buttonLabel, buttonBg, href }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="rounded-xl overflow-hidden transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
            <button
                className="w-full px-4 py-4 flex items-center justify-between text-left"
                onClick={() => setOpen(o => !o)}
            >
                <span className="text-white font-bold text-lg" style={{ fontFamily: "'Raleway', sans-serif" }}>
                    {emoji} {title}
                </span>
                <span className="text-white/50 text-xl">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-4">
                    <p className="text-white/70 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        {description}
                    </p>
                    <div
                        className="rounded-lg p-3"
                        style={{ background: 'rgba(0,0,0,0.3)' }}
                    >
                        {preview}
                    </div>
                    <button
                        onClick={() => { window.location.href = href; }}
                        className="w-full py-2.5 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
                        style={{ fontFamily: "'Raleway', sans-serif", background: buttonBg, cursor: 'pointer' }}
                    >
                        {buttonLabel} <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

function ProdePreview() {
    return (
        <div className="space-y-3" style={{ fontFamily: "'Raleway', sans-serif" }}>
            {/* Match result */}
            <div className="flex items-center justify-between text-white text-sm">
                <div className="text-center">
                    <div className="font-bold text-base">RIV</div>
                    <div className="text-white/50 text-xs">River</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>3</div>
                    <div className="text-white/40 text-xs">×</div>
                    <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>1</div>
                </div>
                <div className="text-center">
                    <div className="font-bold text-base">BOC</div>
                    <div className="text-white/50 text-xs">Boca</div>
                </div>
            </div>
            {/* Demo tour steps */}
            <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-white/40 text-xs uppercase tracking-wide font-semibold">Cómo funciona:</p>
                {[
                    { icon: '1️⃣', text: 'Ingresá el marcador exacto que predecís para cada partido.' },
                    { icon: '2️⃣', text: 'Guardá antes del inicio del partido — después no podés editar.' },
                    { icon: '3️⃣', text: 'Exacto = 5 pts · Ganador correcto = 3 pts · Empate correcto = 3 pts.' },
                ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                        <span>{s.icon}</span>
                        <span style={{ fontFamily: "'Raleway', sans-serif" }}>{s.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FantasyPreview() {
    const players = ['Armani', 'Meza', 'Carboni', 'Borja', 'Colidio'];
    return (
        <div className="space-y-2" style={{ fontFamily: "'Raleway', sans-serif" }}>
            <div className="text-white/50 text-xs text-center mb-2">Formación 4-3-3 · $150M presupuesto</div>
            <div className="flex flex-wrap gap-2 justify-center mb-2">
                {players.map(p => (
                    <span key={p} className="px-2 py-1 rounded-full text-xs text-white font-semibold" style={{ background: 'rgba(255,184,28,0.2)', border: '1px solid rgba(255,184,28,0.4)' }}>
                        {p}
                    </span>
                ))}
                <span className="px-2 py-1 rounded-full text-xs text-white/40" style={{ border: '1px dashed rgba(255,255,255,0.2)' }}>
                    +10 más...
                </span>
            </div>
            {/* Demo tour steps */}
            <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-white/40 text-xs uppercase tracking-wide font-semibold">Cómo funciona:</p>
                {[
                    { icon: '1️⃣', text: 'Elegí 15 jugadores (11 titulares + 4 suplentes) con un presupuesto de $150M.' },
                    { icon: '2️⃣', text: 'Elegí un capitán — sus puntos cuentan el doble cada jornada.' },
                    { icon: '3️⃣', text: 'Los jugadores suman puntos por goles, minutos jugados, clean sheets y más.' },
                    { icon: '🔁', text: 'Podés hacer cambios entre fechas. En fases eliminatorias, cada cambio tiene penalización.' },
                ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                        <span>{s.icon}</span>
                        <span style={{ fontFamily: "'Raleway', sans-serif" }}>{s.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Completion({ displayName, department, preferredTeamId, avatarUrl }) {
    const { data: team } = useQuery({
        queryKey: ['team', preferredTeamId],
        queryFn: () => preferredTeamId ? base44.entities.Team.get(preferredTeamId) : null,
        enabled: !!preferredTeamId
    });

    return (
        <div className="max-w-md w-full overflow-y-auto" style={{ maxHeight: '85vh' }}>
            <div className="text-center mb-6">
                <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
                    ¡Ya estás! 🎉
                </h1>
                <div className="flex items-center justify-center gap-3 mt-4">
                    {avatarUrl && (
                        <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: CU.orange }} />
                    )}
                    <div className="text-left">
                        <div className="text-xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{displayName}</div>
                        <div className="text-white/50 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                            {department}{team ? ` · 🏆 ${team.name}` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-white/50 text-sm text-center mb-4" style={{ fontFamily: "'Raleway', sans-serif" }}>
                Tocá para ver cómo funciona cada modo:
            </p>

            <div className="space-y-3 pb-8">
                <GameCard
                    emoji="⚽"
                    title="Prode — Predicciones"
                    description="Predecí el resultado exacto de cada partido. Exacto = 5 pts, Ganador correcto = 3 pts."
                    preview={<ProdePreview />}
                    buttonLabel="Empezar a Predecir"
                    buttonBg={CU.magenta}
                    href="/ProdePredictions"
                />
                <GameCard
                    emoji="🏟️"
                    title="Fantasy — Armá tu Equipo"
                    description="Elegí 15 jugadores reales con $150M de presupuesto. Tu capitán suma el doble de puntos."
                    preview={<FantasyPreview />}
                    buttonLabel="Armar Mi Equipo"
                    buttonBg={CU.green}
                    href="/SquadManagement"
                />
            </div>
        </div>
    );
}

export default function Onboarding() {
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
        if (currentUser?.display_name) {
            setDisplayName(currentUser.display_name);
        } else if (currentUser?.email && !displayName) {
            setDisplayName(currentUser.email.split('@')[0]);
        }
    }, [currentUser?.email, currentUser?.display_name]);

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
            window.location.href = '/Dashboard';
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