import React, { useState, useEffect } from 'react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
};

const APERTURA_FINAL = new Date('2026-11-01T19:00:00Z'); // AFA Liga Profesional 2026 Final (estimated)

function useCountdown(target) {
    const [timeLeft, setTimeLeft] = useState(getTimeLeft(target));
    useEffect(() => {
        const timer = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
        return () => clearInterval(timer);
    }, [target]);
    return timeLeft;
}

function getTimeLeft(target) {
    const diff = target - new Date();
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
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl font-bold"
                style={{
                    fontFamily: "'DM Serif Display', serif",
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.15)'
                }}>
                {String(value).padStart(2, '0')}
            </div>
            <span className="mt-1 uppercase tracking-widest"
                style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>
                {label}
            </span>
        </div>
    );
}

export default function WorldCupBanner({ compact = false }) {
    const countdown = useCountdown(APERTURA_FINAL);

    if (compact) {
        return (
            <div className="rounded-xl overflow-hidden mb-6"
                style={{
                    background: `linear-gradient(135deg, ${CU.charcoal} 0%, #1a1919 50%, ${CU.charcoal} 100%)`,
                    borderBottom: `3px solid ${CU.orange}`
                }}>
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        ⚽ Liga Profesional AFA · 2026
                    </span>
                    {!countdown.started && (
                        <span className="text-xs font-medium" style={{ fontFamily: "'Raleway', sans-serif", color: CU.orange }}>
                            {countdown.days}d {countdown.hours}h to Final
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl overflow-hidden mb-8"
            style={{
                background: `linear-gradient(135deg, ${CU.charcoal} 0%, #1a1919 40%, #2a2020 70%, ${CU.charcoal} 100%)`,
                borderBottom: `4px solid ${CU.orange}`,
                position: 'relative'
            }}>
            {/* Subtle pitch pattern */}
            <div style={{
                position: 'absolute', inset: 0, opacity: 0.03,
                backgroundImage: `repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 60px), 
                                  repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 60px)`,
                pointerEvents: 'none'
            }} />

            <div className="relative z-10 px-5 sm:px-8 py-5 sm:py-6">
                {/* Title */}
                <div className="text-center mb-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-0.5"
                        style={{ fontFamily: "'DM Serif Display', serif" }}>
                        Liga Profesional AFA
                    </h1>
                    <p className="text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.5)' }}>
                        Temporada 2026
                    </p>
                </div>

                {/* Countdown */}
                {!countdown.started ? (
                    <div className="mt-2">
                        <p className="text-center uppercase tracking-widest mb-2"
                            style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
                            Countdown to Final
                        </p>
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                            <CountdownUnit value={countdown.days} label="Days" />
                            <span className="text-white/20 text-lg font-light mt-[-16px]">:</span>
                            <CountdownUnit value={countdown.hours} label="Hrs" />
                            <span className="text-white/20 text-lg font-light mt-[-16px]">:</span>
                            <CountdownUnit value={countdown.minutes} label="Min" />
                            <span className="text-white/20 text-lg font-light mt-[-16px]">:</span>
                            <CountdownUnit value={countdown.seconds} label="Sec" />
                        </div>
                    </div>
                ) : (
                    <div className="text-center mt-2">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                            style={{ fontFamily: "'Raleway', sans-serif", background: CU.green, color: 'white' }}>
                            ⚽ Torneo en Juego
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}