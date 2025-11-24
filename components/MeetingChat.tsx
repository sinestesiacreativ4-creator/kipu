import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { AIAnalysis, ChatMessage } from '../types';
import { chatWithMeeting } from '../services/geminiService';

interface MeetingChatProps {
    analysis: AIAnalysis;
}

const MeetingChat: React.FC<MeetingChatProps> = ({ analysis }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hola, soy tu asistente para la reunión "${analysis.title}". ¿En qué puedo ayudarte? Puedes preguntarme sobre decisiones tomadas, tareas pendientes o puntos específicos de la conversación.`,
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await chatWithMeeting(analysis, messages, userMsg.content);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Error chatting with meeting:', error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Lo siento, tuve un problema al procesar tu pregunta. Por favor intenta de nuevo.',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''
                            }`}
                    >
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                                ? 'bg-primary text-white'
                                : 'bg-secondary text-white'
                                }`}
                        >
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div
                            className={`max-w-[85%] p-4 rounded-2xl text-sm leading-7 shadow-sm ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-tr-none'
                                : 'bg-stone-50 dark:bg-stone-700/80 text-stone-800 dark:text-stone-200 rounded-tl-none border border-stone-100 dark:border-stone-600'
                                }`}
                        >
                            <div className={`whitespace-pre-wrap ${msg.role === 'assistant' ? 'text-justify' : ''}`}>
                                {msg.content.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                        return <strong key={index} className={msg.role === 'user' ? 'font-bold' : 'font-bold text-stone-900 dark:text-white'}>{part.slice(2, -2)}</strong>;
                                    }
                                    return part;
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center flex-shrink-0">
                            <Bot size={16} />
                        </div>
                        <div className="bg-stone-100 dark:bg-stone-700 p-3 rounded-2xl rounded-tl-none">
                            <Loader2 size={16} className="animate-spin text-stone-500" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pregunta sobre la reunión..."
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-stone-800 dark:text-white placeholder-stone-400"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeetingChat;
