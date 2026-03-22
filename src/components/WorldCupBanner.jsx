import React, { useState, useEffect } from 'react';

/**
 * WorldCupBanner — Reusable hero banner for ScoreKeeper Pro
 * Shows CookUnity logo + FIFA WC 2026 emblem with live countdown
 * 
 * Usage: <WorldCupBanner />
 * Optional props:
 *   compact={true}  — smaller version for non-dashboard pages
 */

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
    sand: '#C7B273',
};

const KICKOFF = new Date('2026-06-11T19:00:00Z'); // Mexico vs South Africa, 3pm ET

const CU_LOGO_URL = 'https://media.base44.com/images/public/697e13bb6118f7db732b8054/407350a2e_CU_Logo_Horizontal-021.png';
const CU_LOGO_COLORFUL_URL = 'https://media.base44.com/images/public/697e13bb6118f7db732b8054/74a2f8fc1_Screenshot2026-03-22at33117PM.png';
const FIFA_EMBLEM_COLORFUL_URL = 'https://media.base44.com/images/public/697e13bb6118f7db732b8054/fb2b4d7e5_fifa-world-cup-2026-logo-alt.png';
const FIFA_EMBLEM_WHITE_URL = 'https://media.base44.com/images/public/697e13bb6118f7db732b8054/a7080d94e_fifa-world-cup-2026-logo-white.png';
const FIFA_EMBLEM_BLACK_URL = 'https://media.base44.com/images/public/697e13bb6118f7db732b8054/c4595d84f_fifa-world-cup-2026-logo.png';
// Active selection for the banner (dark bg → white FIFA logo)
const FIFA_EMBLEM_URL = FIFA_EMBLEM_WHITE_URL;

function useCountdown(target) {
    const [timeLeft, setTimeLeft] = useState(getTimeLeft(target));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(getTimeLeft(target));
        }, 1000);
        return () => clearInterval(timer);
    }, [target]);

    return timeLeft;
}

function getTimeLeft(target) {
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };

    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        started: false
    };
}

function CountdownUnit({ value, label }) {
    return (
        <div className="flex flex-col items-center">
            <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl font-bold"
                style={{
                    fontFamily: "'DM Serif Display', serif",
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.15)'
                }}
            >
                {String(value).padStart(2, '0')}
            </div>
            <span
                className="mt-1 uppercase tracking-widest"
                style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}
            >
                {label}
            </span>
        </div>
    );
}

export default function WorldCupBanner({ compact = false }) {
    const countdown = useCountdown(KICKOFF);
    const [fifaLogoError, setFifaLogoError] = useState(false);

    if (compact) {
        return (
            <div
                className="rounded-xl overflow-hidden mb-6"
                style={{
                    background: `linear-gradient(135deg, ${CU.charcoal} 0%, #1a1919 50%, ${CU.charcoal} 100%)`,
                    borderBottom: `3px solid ${CU.orange}`
                }}
            >
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src={CU_LOGO_URL}
                            alt="CookUnity"
                            className="h-5"
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div className="w-px h-4 bg-white/20" />
                        <span
                            className="text-sm font-semibold text-white/80"
                            style={{ fontFamily: "'Raleway', sans-serif" }}
                        >
                            UnityCup
                        </span>
                    </div>
                    {!countdown.started && (
                        <span
                            className="text-xs font-medium"
                            style={{ fontFamily: "'Raleway', sans-serif", color: CU.orange }}
                        >
                            {countdown.days}d {countdown.hours}h to kickoff
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{
                background: `linear-gradient(135deg, ${CU.charcoal} 0%, #1a1919 40%, #2a2020 70%, ${CU.charcoal} 100%)`,
                borderBottom: `4px solid ${CU.orange}`,
                position: 'relative'
            }}
        >
            {/* Subtle pitch pattern overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.03,
                    backgroundImage: `repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 60px), 
                                      repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 60px)`,
                    pointerEvents: 'none'
                }}
            />

            <div className="relative z-10 px-5 sm:px-8 py-6 sm:py-8" style={{ aspectRatio: '16/7' }}>
                {/* Top row: CU Logo left | Badge center | FIFA emblem right */}
                <div className="flex items-center justify-between mb-5">
                    {/* CU Logo — top left, white */}
                    <img
                        src={CU_LOGO_COLORFUL_URL}
                        alt="CookUnity"
                        className="h-8 sm:h-10"
                        style={{ filter: 'brightness(0) invert(1)' }}
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                    {/* INTERNAL COMPETITION badge — centered */}
                    <div
                        className="px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            background: CU.orange,
                            color: CU.charcoal
                        }}
                    >
                        Internal Competition
                    </div>
                    {/* FIFA emblem — top right */}
                    {!fifaLogoError ? (
                        <img
                            src={FIFA_EMBLEM_URL}
                            alt="FIFA World Cup 2026"
                            className="h-14 sm:h-16"
                            onError={() => setFifaLogoError(true)}
                        />
                    ) : (
                        <span className="text-2xl">🏆</span>
                    )}
                </div>

                {/* Title */}
                <div className="text-center mb-5 sm:mb-6">
                    <h1
                        className="text-3xl sm:text-4xl font-bold text-white mb-1"
                        style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                        UnityCup
                    </h1>
                    <p
                        className="text-sm sm:text-base"
                        style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.5)' }}
                    >
                        FIFA World Cup 2026
                    </p>
                    <p
                        className="text-xs mt-1"
                        style={{ fontFamily: "'Raleway', sans-serif", color: CU.orange }}
                    >
                        Canada · Mexico · United States · June 11 — July 19, 2026
                    </p>
                </div>

                {/* Countdown */}
                {!countdown.started ? (
                    <div>
                        <p
                            className="text-center text-xs uppercase tracking-widest mb-3"
                            style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.35)' }}
                        >
                            Countdown to Kickoff
                        </p>
                        <div className="flex items-center justify-center gap-3 sm:gap-4">
                            <CountdownUnit value={countdown.days} label="Days" />
                            <span className="text-white/20 text-2xl font-light mt-[-20px]">:</span>
                            <CountdownUnit value={countdown.hours} label="Hrs" />
                            <span className="text-white/20 text-2xl font-light mt-[-20px]">:</span>
                            <CountdownUnit value={countdown.minutes} label="Min" />
                            <span className="text-white/20 text-2xl font-light mt-[-20px]">:</span>
                            <CountdownUnit value={countdown.seconds} label="Sec" />
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <span
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                            style={{
                                fontFamily: "'Raleway', sans-serif",
                                background: CU.green,
                                color: 'white'
                            }}
                        >
                            ⚽ Tournament In Progress
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}