import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageBubble from '@/components/MessageBubble';
import { Send, Loader2, Plus } from 'lucide-react';

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

    // Load conversations on mount
    useEffect(() => {
        loadConversations();
    }, []);

    // Subscribe to active conversation
    useEffect(() => {
        if (!activeConversation?.id) return;
        const unsubscribe = base44.agents.subscribeToConversation(activeConversation.id, (data) => {
            setMessages(data.messages || []);
        });
        return () => unsubscribe();
    }, [activeConversation?.id]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        setLoadingConvs(true);
        try {
            const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
            setConversations(convs || []);
            if (convs?.length > 0) {
                await selectConversation(convs[0]);
            }
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
        <div className="flex h-[calc(100vh-64px)] bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r flex flex-col">
                <div className="p-4 border-b">
                    <Button onClick={createNewConversation} className="w-full gap-2" size="sm">
                        <Plus className="w-4 h-4" /> New Chat
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingConvs ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">No conversations yet</div>
                    ) : (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => selectConversation(conv)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 border-b transition-colors ${activeConversation?.id === conv.id ? 'bg-slate-100 font-medium' : ''}`}
                            >
                                <div className="truncate">{conv.metadata?.name || 'Chat'}</div>
                                <div className="text-xs text-slate-400 mt-0.5">
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
                <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold">F</div>
                    <div>
                        <div className="font-semibold text-slate-900">FAFO</div>
                        <div className="text-xs text-slate-500">AI Assistant</div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                    {!activeConversation ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-400">F</div>
                            <div className="text-slate-600 font-medium">Start a conversation with FAFO</div>
                            <div className="text-sm text-slate-400">Type a message below or create a new chat</div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Send a message to begin
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <MessageBubble key={idx} message={msg} />
                        ))
                    )}
                    {sending && (
                        <div className="flex gap-3">
                            <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
                                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-400">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="bg-white border-t px-6 py-4">
                    <div className="flex gap-3 max-w-4xl mx-auto">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message FAFO..."
                            className="flex-1"
                            disabled={sending}
                        />
                        <Button onClick={sendMessage} disabled={!input.trim() || sending} size="icon">
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}