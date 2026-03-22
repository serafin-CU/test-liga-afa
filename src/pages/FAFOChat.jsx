import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import MessageBubble from '@/components/MessageBubble';
import { Send, Loader2, Plus } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const AGENT_NAME = 'FAFO';

export default function FAFOChat() {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const messagesEndRef = useRef(null);

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    useEffect(() => { loadConversations(); }, []);

    useEffect(() => {
        if (!activeConversation?.id) return;
        const unsubscribe = base44.agents.subscribeToConversation(activeConversation.id, (data) => {
            setMessages(data.messages || []);
        });
        return () => unsubscribe();
    }, [activeConversation?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        setLoadingConvs(true);
        try {
            const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
            setConversations(convs || []);
            if (convs?.length > 0) await selectConversation(convs[0]);
        } catch (e) {
            console.error(e);
        }
        setLoadingConvs(false);
    };

    const selectConversation = async (conv) => {
        const full = await base44.agents.getConversation(conv.id);
        setActiveConversation(full);
        setMessages(full.messages || []);
    };

    const createNewConversation = async () => {
        const conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: `Chat ${new Date().toLocaleString()}` }
        });
        setConversations(prev => [conv, ...prev]);
        setActiveConversation(conv);
        setMessages([]);
    };

    const sendMessage = async () => {
        if (!input.trim() || sending) return;
        if (!activeConversation) await createNewConversation();

        const text = input.trim();
        setInput('');
        setSending(true);

        try {
            await base44.agents.addMessage(activeConversation || (await base44.agents.createConversation({ agent_name: AGENT_NAME, metadata: { name: `Chat ${new Date().toLocaleString()}` } })), {
                role: 'user',
                content: text
            });
        } catch (e) {
            console.error(e);
        }
        setSending(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex" style={{ height: 'calc(100vh - 64px)', background: '#f9fafb', fontFamily: "'Raleway', sans-serif" }}>
            {/* Sidebar */}
            <div className="w-64 flex flex-col" style={{ background: 'white', borderRight: '1px solid #e5e7eb' }}>
                <div className="p-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <button
                        onClick={createNewConversation}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: CU.magenta, color: 'white', fontFamily: "'Raleway', sans-serif", border: 'none', cursor: 'pointer' }}
                    >
                        <Plus className="w-4 h-4" /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingConvs ? (
                        <div className="p-4 text-center" style={{ color: '#9ca3af' }}>
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-sm" style={{ color: '#9ca3af' }}>No conversations yet</div>
                    ) : (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => selectConversation(conv)}
                                className="w-full text-left px-4 py-3 text-sm transition-colors"
                                style={{
                                    borderBottom: '1px solid #f3f4f6',
                                    background: activeConversation?.id === conv.id ? CU.orange + '15' : 'transparent',
                                    borderLeft: activeConversation?.id === conv.id ? `3px solid ${CU.orange}` : '3px solid transparent',
                                    color: CU.charcoal,
                                    fontWeight: activeConversation?.id === conv.id ? 600 : 400,
                                    cursor: 'pointer'
                                }}
                            >
                                <div className="truncate">{conv.metadata?.name || 'Chat'}</div>
                                <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                                    {new Date(conv.created_date).toLocaleDateString()}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main chat */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4" style={{ background: 'white', borderBottom: '1px solid #e5e7eb' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                         style={{ background: CU.charcoal, fontFamily: "'DM Serif Display', serif" }}>F</div>
                    <div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: CU.charcoal }}>FAFO</div>
                        <div className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>AI Assistant</div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                    {!activeConversation ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                                 style={{ background: CU.charcoal, color: 'white', fontFamily: "'DM Serif Display', serif" }}>F</div>
                            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: CU.charcoal }}>Start a conversation with FAFO</div>
                            <div className="text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>Type a message below or create a new chat</div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                            Send a message to begin
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <MessageBubble key={idx} message={msg} />
                        ))
                    )}
                    {sending && (
                        <div className="flex gap-3">
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: '#f3f4f6' }}>
                                <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#9ca3af' }} />
                            </div>
                            <div className="rounded-2xl px-4 py-2.5 text-sm" style={{ background: 'white', border: '1px solid #e5e7eb', fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-6 py-4" style={{ background: 'white', borderTop: '1px solid #e5e7eb' }}>
                    <div className="flex gap-3 max-w-4xl mx-auto">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message FAFO..."
                            className="flex-1"
                            disabled={sending}
                            style={{ fontFamily: "'Raleway', sans-serif" }}
                        />
                        <button
                            onClick={sendMessage}
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
        </div>
    );
}