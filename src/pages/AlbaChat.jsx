import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
    green: '#218848',
};

const ALBA_FAQ = {
    welcome: "¡Hola! 👋 Soy Alba, tu asistente del Liga AFA Test. Preguntame sobre reglas de puntaje, cómo armar tu equipo, el calendario del Apertura, ¡o cómo funciona el juego!",
    
    responses: [
        {
            triggers: ['score', 'points', 'scoring', 'how do points work', 'puntos', 'puntaje', 'como se puntua', 'puntua', 'punto', 'cuanto', 'cuantos puntos', 'exacto', 'ganador'],
            response: "📊 El Liga AFA Test tiene dos modos:\n\n**Prode (Predicciones):**\n• Resultado exacto = 5 pts\n• Ganador correcto = 3 pts\n\n**Fantasy:**\n• Gol de DL = 5 pts\n• Gol de MED = 6 pts\n• Gol de DEF/GK = 7 pts\n• 60+ minutos jugados = 2 pts\n• 1-59 minutos = 1 pt\n• Tarjeta amarilla = -1 pt\n• Tarjeta roja = -3 pts\n• ¡El capitán gana 2x puntos!"
        },
        {
            triggers: ['squad', 'formation', 'team', 'players', 'how many', '4-3-3', 'build', 'equipo', 'jugadores', 'armar', 'plantel', 'formacion', 'presupuesto', 'precio'],
            response: "⚽ Tu equipo fantasy necesita:\n• 11 titulares (1 GK, 4 DEF, 3 MED, 3 DL)\n• 3 jugadores en el banco\n• 1 capitán (gana 2x puntos)\n• Presupuesto: $150M total\n\nFormación fija en 4-3-3. ¡Andá a 'Build Squad' para armarlo!"
        },
        {
            triggers: ['transfer', 'change', 'edit', 'swap', 'lock', 'window', 'deadline', 'transferencia', 'cambio', 'cierre'],
            response: "🔄 ¡Las transferencias son GRATIS en este torneo!\n\nPodés editar tu equipo hasta 48 horas antes del primer partido de cada fase. Después de eso, tu equipo se bloquea.\n\nFijate en el countdown del Squad Builder para ver cuándo cierra la ventana."
        },
        {
            triggers: ['schedule', 'when', 'date', 'start', 'calendar', 'fixture', 'match', 'calendario', 'fecha', 'partido', 'cuando', 'proxima', 'proximo', 'abril', 'fecha 10', 'fecha 11'],
            response: "📅 Calendario del Apertura 2026:\n\n• Fecha 10: 5-7 de abril\n• Fecha 11: 12-14 de abril\n• Octavos de Final (Apertura R16): por confirmar\n• Cuartos de Final: por confirmar\n• Semifinales: por confirmar\n• Final: 24 de mayo 🏆\n\n30 equipos en 2 zonas (A y B) en la fase de grupos."
        },
        {
            triggers: ['prode', 'predict', 'prediction', 'guess', 'predecir', 'pronostico', 'resultado', 'marcador', 'prediccion'],
            response: "🎯 ¡El Prode es el juego de predicciones!\n\nPor cada partido, predecí el marcador final (goles local vs visitante). Podés predecir todos los partidos que quieras y guardarlos de una.\n\nPuntaje: Resultado exacto = 5 pts, ganador/empate correcto = 3 pts.\n\n¡Andá a 'Prode' en el menú para empezar!"
        },
        {
            triggers: ['badge', 'achievement', 'award', 'trophy', 'logro', 'medalla', 'insignia'],
            response: "🏅 Insignias del Liga AFA Test:\n\n🛡️ **Unbreakable XI** — Mantenés 8+ de tus 11 titulares entre rondas del knockout\n👑 **The Originals** — Mantenés 9+ de tus titulares originales del R16 hasta la Final\n🎯 **Perfect Matchday** — Predecís correctamente todos los resultados de una fecha\n\n¡Las insignias aparecen en tu perfil y página de equipo!"
        },
        {
            triggers: ['captain', '2x', 'double', 'multiplier', 'capitan', 'capitán'],
            response: "⭐ ¡Tu Capitán gana el DOBLE de puntos!\n\nSolo los titulares pueden ser capitán. Elegí bien — alguien que probablemente haga un gol o juegue 60+ minutos.\n\nPodés cambiar el capitán en cualquier momento antes del cierre. Andá a Build Squad → tocá la ☆ en cualquier titular."
        },
        {
            triggers: ['boca', 'river', 'racing', 'independiente', 'san lorenzo', 'velez', 'huracan', 'belgrano', 'talleres', 'lanus', 'zona', 'equipos', 'teams', 'argentina'],
            response: "🇦🇷 30 equipos en 2 zonas:\n\n**Zona A:** Boca, Independiente, San Lorenzo, Vélez, Riestra, Talleres, Instituto, Platense, Estudiantes LP, Gimnasia Mza, Lanús, Newell's, Defensa, Central Córdoba, Unión\n\n**Zona B:** River, Racing, Huracán, Barracas, Belgrano, Estudiantes RC, Argentinos, Tigre, Gimnasia LP, Ind. Rivadavia, Banfield, Rosario Central, Aldosivi, Atlético Tucumán, Sarmiento"
        },
        {
            triggers: ['rules', 'how to play', 'how does this work', 'help', 'what is this', 'explain', 'reglas', 'como se juega', 'ayuda', 'como funciona', 'que es', 'explicame', 'como juego'],
            response: "🏆 ¡Bienvenido al Liga AFA Test — Apertura 2026!\n\nDos formas de jugar:\n\n1️⃣ **Prode** — Predecí los marcadores de los partidos. Exacto = 5 pts, ganador = 3 pts.\n2️⃣ **Fantasy** — Armá un equipo de 14 jugadores reales. Ganan puntos según el rendimiento real.\n\nAmbos modos tienen sus propios leaderboards. ¡Tu puntaje combinado determina el campeón!\n\n¿Necesitás ayuda con algo específico? ¡Preguntame sobre puntaje, equipos, transferencias o el calendario!"
        }
    ],
    
    fallback: "🤔 ¡No estoy segura de eso! Puedo ayudarte con:\n• Reglas de puntaje\n• Armar tu equipo\n• Ventanas de transferencia\n• Calendario del Apertura\n• Insignias\n• Cómo jugar\n\n¡Probá preguntando sobre alguno de esos temas!"
};

const QUICK_REPLIES = [
    "¿Cómo se puntúa?",
    "Armar mi equipo",
    "Calendario del Apertura",
    "¿Qué son las insignias?",
    "Reglas de transferencia",
    "¿Cómo se juega?"
];

function getAlbaResponse(userMessage) {
    const lower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!]/g, '');
    
    for (const item of ALBA_FAQ.responses) {
        for (const trigger of item.triggers) {
            if (lower.includes(trigger)) {
                return item.response;
            }
        }
    }
    
    return ALBA_FAQ.fallback;
}

function AlbaAvatar() {
    return (
        <img
            src="https://media.base44.com/images/public/697e13bb6118f7db732b8054/c94fef301_image.png"
            alt="Alba"
            className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
        />
    );
}

function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    
    useEffect(() => {
        if (!isUser && message.showQuickReplies) {
            setShowQuickReplies(true);
        }
    }, [isUser, message.showQuickReplies]);

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <AlbaAvatar />}
            
            <div className={`flex flex-col max-w-xs ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className="rounded-xl px-4 py-2.5 text-sm break-words"
                    style={{
                        fontFamily: "'Raleway', sans-serif",
                        background: isUser ? CU.charcoal : 'white',
                        color: isUser ? 'white' : CU.charcoal,
                        border: isUser ? 'none' : `1px solid #e5e7eb`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}
                >
                    {message.content}
                </div>
                
                {showQuickReplies && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {QUICK_REPLIES.map((reply, idx) => (
                            <button
                                key={idx}
                                onClick={() => message.onQuickReply(reply)}
                                className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    background: CU.orange + '20',
                                    color: CU.orange,
                                    border: `1px solid ${CU.orange}40`,
                                    cursor: 'pointer'
                                }}
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AlbaChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const welcomeMsg = {
            role: 'assistant',
            content: ALBA_FAQ.welcome,
            showQuickReplies: true,
            onQuickReply: handleQuickReply
        };
        setMessages([welcomeMsg]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    function handleQuickReply(reply) {
        sendMessage(reply);
    }

    async function sendMessage(text = null) {
        const messageText = text || input.trim();
        if (!messageText || sending) return;

        setInput('');
        setSending(true);

        const userMsg = { role: 'user', content: messageText };
        setMessages(prev => [...prev, userMsg]);

        setTimeout(() => {
            const response = getAlbaResponse(messageText);
            const albaMsg = {
                role: 'assistant',
                content: response,
                showQuickReplies: true,
                onQuickReply: handleQuickReply
            };
            setMessages(prev => [...prev, albaMsg]);
            setSending(false);
        }, 300);
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ background: '#f9fafb', fontFamily: "'Raleway', sans-serif" }}>
            {/* Header */}
            <div className="px-6 py-5 flex items-center gap-3" style={{ background: CU.charcoal, borderBottom: `2px solid ${CU.orange}` }}>
                <AlbaAvatar />
                <div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: 'white' }}>Alba 🤖</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Tu asistente del Liga AFA Test</div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-2xl w-full mx-auto">
                {messages.map((msg, idx) => (
                    <MessageBubble key={idx} message={msg} />
                ))}
                {sending && (
                    <div className="flex gap-3">
                        <AlbaAvatar />
                        <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'white', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                            ⏳ Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4" style={{ background: 'white', borderTop: '1px solid #e5e7eb' }}>
                <div className="flex gap-3 max-w-2xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Alba..."
                        disabled={sending}
                        className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
                        style={{
                            fontFamily: "'Raleway', sans-serif",
                            borderColor: '#e5e7eb',
                            background: 'white',
                            color: CU.charcoal,
                            opacity: sending ? 0.6 : 1
                        }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || sending}
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                        style={{
                            background: !input.trim() || sending ? '#e5e7eb' : CU.magenta,
                            color: 'white',
                            border: 'none',
                            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}