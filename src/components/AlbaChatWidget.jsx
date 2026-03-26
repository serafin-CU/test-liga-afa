import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const ALBA_FAQ = {
    welcome: (name) => `¡Hola${name ? ` ${name}` : ''}! 👋 Soy Alba, tu asistente del Liga AFA Test. Preguntame sobre reglas de puntaje, cómo armar tu equipo, el calendario del Apertura, ¡o cómo funciona el juego!`,
    responses: [
        {
            triggers: ['score', 'points', 'scoring', 'how do points work', 'puntos', 'puntaje', 'como se puntua', 'puntua', 'punto', 'cuanto', 'cuantos puntos', 'exacto', 'ganador'],
            response: "📊 El Liga AFA Test tiene dos modos:\n\n**Prode:** Resultado exacto = 5 pts, ganador = 3 pts\n\n**Fantasy:** Gol DL=5pts, MED=6pts, DEF/GK=7pts\n60+ min=2pts, 1-59 min=1pt\nAmarilla=-1pt, Roja=-3pts\n¡Capitán gana 2x puntos!"
        },
        {
            triggers: ['squad', 'formation', 'team', 'players', 'how many', '4-3-3', 'build', 'equipo', 'jugadores', 'armar', 'plantel', 'formacion', 'presupuesto', 'precio'],
            response: "⚽ Tu equipo fantasy necesita:\n• 11 titulares (1 GK, 4 DEF, 3 MED, 3 DL)\n• 3 jugadores en el banco\n• 1 capitán (gana 2x puntos)\n• Presupuesto: $150M total\n\nFormación fija 4-3-3. ¡Andá a 'Mi Equipo' para armarlo!"
        },
        {
            triggers: ['transfer', 'change', 'edit', 'swap', 'lock', 'window', 'deadline', 'transferencia', 'cambio', 'cierre'],
            response: "🔄 ¡Las transferencias son GRATIS!\n\nPodés editar tu equipo hasta 48hs antes del primer partido de cada fase. Después se bloquea."
        },
        {
            triggers: ['schedule', 'when', 'date', 'start', 'calendar', 'fixture', 'match', 'calendario', 'fecha', 'partido', 'cuando', 'proxima', 'proximo', 'abril', 'fecha 10', 'fecha 11'],
            response: "📅 Apertura 2026:\n\n• Fecha 10: 5-7 de abril\n• Fecha 11: 12-14 de abril\n• Octavos: por confirmar\n• Final: 24 de mayo 🏆\n\n30 equipos en 2 zonas (A y B)."
        },
        {
            triggers: ['prode', 'predict', 'prediction', 'guess', 'predecir', 'pronostico', 'resultado', 'marcador', 'prediccion'],
            response: "🎯 ¡El Prode es el juego de predicciones!\n\nPredecí el marcador final de cada partido.\nResultado exacto = 5 pts\nGanador/empate correcto = 3 pts"
        },
        {
            triggers: ['badge', 'achievement', 'award', 'trophy', 'logro', 'medalla', 'insignia'],
            response: "🏅 Insignias:\n\n🛡️ Unbreakable XI — 8+ titulares entre rondas\n👑 The Originals — 9+ titulares hasta la Final\n🎯 Perfect Matchday — Todos los resultados correctos en una fecha"
        },
        {
            triggers: ['captain', '2x', 'double', 'capitan', 'capitán'],
            response: "⭐ ¡Tu Capitán gana el DOBLE de puntos!\n\nSolo titulares pueden ser capitán. Cambialo antes del cierre en Mi Equipo."
        },
        {
            triggers: ['rules', 'how to play', 'help', 'explain', 'reglas', 'como se juega', 'ayuda', 'como funciona', 'que es', 'explicame', 'como juego'],
            response: "🏆 Liga AFA Test — Apertura 2026:\n\n1️⃣ Prode — Predecí marcadores (exacto=5pts, ganador=3pts)\n2️⃣ Fantasy — 14 jugadores reales, puntos según rendimiento\n\n¿Qué querés saber más?"
        }
    ],
    fallback: "🤔 ¡No estoy segura! Puedo ayudarte con:\n• Puntaje\n• Tu equipo fantasy\n• Transferencias\n• Calendario\n• Insignias\n• Cómo jugar"
};

const QUICK_REPLIES = [
    "¿Cómo se puntúa?",
    "Armar mi equipo",
    "Calendario",
    "¿Qué son las insignias?",
    "¿Cómo se juega?"
];

function getAlbaResponse(msg) {
    const lower = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!]/g, '');
    for (const item of ALBA_FAQ.responses) {
        for (const trigger of item.triggers) {
            if (lower.includes(trigger)) return item.response;
        }
    }
    return ALBA_FAQ.fallback;
}

export default function AlbaChatWidget({ userName = '' }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);
    const initialized = useRef(false);

    // Initialize welcome message when first opened
    useEffect(() => {
        if (open && !initialized.current) {
            initialized.current = true;
            setMessages([{
                role: 'assistant',
                content: ALBA_FAQ.welcome(userName),
                showQuickReplies: true,
            }]);
        }
    }, [open, userName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    function sendMessage(text) {
        const messageText = (text || input).trim();
        if (!messageText || sending) return;
        setInput('');
        setSending(true);
        setMessages(prev => [...prev, { role: 'user', content: messageText }]);
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: getAlbaResponse(messageText),
                showQuickReplies: true,
            }]);
            setSending(false);
        }, 300);
    }

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(o => !o)}
                aria-label="Chat con Alba"
                style={{
                    position: 'fixed',
                    bottom: '100px',
                    right: '24px',
                    zIndex: 50,
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: CU.orange,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                {open
                    ? <X style={{ color: CU.charcoal, width: 24, height: 24 }} />
                    : <MessageSquare style={{ color: CU.charcoal, width: 24, height: 24 }} />
                }
            </button>

            {/* Chat panel */}
            {open && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        bottom: '168px',
                        right: '24px',
                        zIndex: 50,
                        width: 'min(350px, calc(100vw - 32px))',
                        height: '450px',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                        border: '1px solid #e5e7eb',
                        background: '#f9fafb',
                    }}
                >
                    {/* Header */}
                    <div style={{ background: CU.charcoal, borderBottom: `2px solid ${CU.orange}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <img
                            src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png"
                            alt="Alba"
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'white', lineHeight: 1.2 }}>Alba 🤖</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>Tu asistente del Liga AFA</div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                            <X style={{ width: 18, height: 18 }} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx}>
                                <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-start' }}>
                                    {msg.role === 'assistant' && (
                                        <img
                                            src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png"
                                            alt="Alba"
                                            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            maxWidth: '80%',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.8rem',
                                            fontFamily: "'Raleway', sans-serif",
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.5,
                                            background: msg.role === 'user' ? CU.charcoal : 'white',
                                            color: msg.role === 'user' ? 'white' : CU.charcoal,
                                            border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                                        }}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                                {msg.role === 'assistant' && msg.showQuickReplies && idx === messages.length - 1 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', paddingLeft: '36px' }}>
                                        {QUICK_REPLIES.map((r, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(r)}
                                                style={{
                                                    fontFamily: "'Raleway', sans-serif",
                                                    fontSize: '0.7rem',
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    background: CU.orange + '20',
                                                    color: CU.orange,
                                                    border: `1px solid ${CU.orange}40`,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {sending && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <img src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png" alt="Alba" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>⏳ Escribiendo...</div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '10px 12px', background: 'white', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder="Preguntale a Alba..."
                            disabled={sending}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                fontSize: '0.8rem',
                                fontFamily: "'Raleway', sans-serif",
                                color: CU.charcoal,
                                background: 'white',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || sending}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '8px',
                                border: 'none',
                                background: !input.trim() || sending ? '#e5e7eb' : CU.magenta,
                                color: 'white',
                                cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Send style={{ width: 16, height: 16 }} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}