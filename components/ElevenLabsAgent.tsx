import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, MessageSquare, Volume2, VolumeX, Settings } from 'lucide-react';

interface ElevenLabsAgentProps {
    recordingId: string;
    meetingContext?: string; // Transcript or summary of the meeting
}

interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

// ElevenLabs WebSocket message types
interface ElevenLabsMessage {
    type: string;
    audio?: string; // Base64 audio
    text?: string;
    error?: string;
    agent_response?: string;
    user_transcript?: string;
}

const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_5601kbtkdkghejj91hg2qr1gmty1';

const ElevenLabsAgent: React.FC<ElevenLabsAgentProps> = ({ recordingId, meetingContext }) => {
    // State
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [status, setStatus] = useState('Listo para conectar');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize Audio Context
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        }
        return audioContextRef.current;
    }, []);

    // Convert Float32 to Int16 PCM
    const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    // Convert Base64 to ArrayBuffer
    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    // ArrayBuffer to Base64
    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    // Play audio from queue
    const playNextInQueue = useCallback(async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsSpeaking(false);
            return;
        }

        isPlayingRef.current = true;
        setIsSpeaking(true);

        const audioData = audioQueueRef.current.shift();
        if (!audioData || !audioContextRef.current) return;

        try {
            // Decode audio (ElevenLabs sends MP3 or PCM)
            const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.slice(0));

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            currentSourceRef.current = source;

            source.onended = () => {
                playNextInQueue();
            };

            source.start();
        } catch (error) {
            console.error('[ElevenLabs] Audio playback error:', error);

            // Try as raw PCM
            try {
                const int16Data = new Int16Array(audioData);
                const float32Data = new Float32Array(int16Data.length);
                for (let i = 0; i < int16Data.length; i++) {
                    float32Data[i] = int16Data[i] / 32768.0;
                }

                const buffer = audioContextRef.current!.createBuffer(1, float32Data.length, 16000);
                buffer.getChannelData(0).set(float32Data);

                const source = audioContextRef.current!.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current!.destination);
                currentSourceRef.current = source;
                source.onended = () => playNextInQueue();
                source.start();
            } catch (e) {
                console.error('[ElevenLabs] PCM fallback failed:', e);
                playNextInQueue();
            }
        }
    }, []);

    // Handle WebSocket messages
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data) as ElevenLabsMessage;
            console.log('[ElevenLabs] Received:', data.type);

            switch (data.type) {
                case 'audio':
                    // Audio response from agent
                    if (data.audio) {
                        const audioBuffer = base64ToArrayBuffer(data.audio);
                        audioQueueRef.current.push(audioBuffer);
                        if (!isPlayingRef.current) {
                            playNextInQueue();
                        }
                    }
                    break;

                case 'agent_response':
                case 'agent_response_correction':
                    // Text response from agent
                    if (data.agent_response) {
                        addMessage('assistant', data.agent_response);
                    }
                    break;

                case 'user_transcript':
                    // User's speech transcribed
                    if (data.user_transcript) {
                        addMessage('user', data.user_transcript);
                    }
                    break;

                case 'interruption':
                    // User interrupted - stop current audio
                    if (currentSourceRef.current) {
                        currentSourceRef.current.stop();
                        audioQueueRef.current = [];
                        isPlayingRef.current = false;
                        setIsSpeaking(false);
                    }
                    break;

                case 'ping':
                    // Respond to ping
                    wsRef.current?.send(JSON.stringify({ type: 'pong' }));
                    break;

                case 'error':
                    console.error('[ElevenLabs] Error:', data.error);
                    setError(data.error || 'Error de conexión');
                    break;

                default:
                    console.log('[ElevenLabs] Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('[ElevenLabs] Message parse error:', error);
        }
    }, [playNextInQueue]);

    // Add message to chat
    const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
        setMessages(prev => [...prev, { role, text, timestamp: new Date() }]);
    }, []);

    // Start microphone recording
    const startMicrophone = useCallback(async () => {
        try {
            const ctx = initAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            mediaStreamRef.current = stream;
            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Process audio chunks
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (isMuted) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // Calculate volume
                let sum = 0;
                for (let i = 0; i < inputData.length; i += 50) {
                    sum += Math.abs(inputData[i]);
                }
                const vol = Math.min(1, (sum / (inputData.length / 50)) * 5);
                setVolume(vol);

                // Interrupt if user speaks while agent is talking
                if (vol > 0.15 && isPlayingRef.current) {
                    if (currentSourceRef.current) {
                        currentSourceRef.current.stop();
                        audioQueueRef.current = [];
                        isPlayingRef.current = false;
                        setIsSpeaking(false);
                    }
                }

                // Convert to 16-bit PCM and send
                const pcmData = floatTo16BitPCM(inputData);
                const base64Audio = arrayBufferToBase64(pcmData);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        user_audio_chunk: base64Audio
                    }));
                }
            };

            source.connect(processor);
            processor.connect(ctx.destination);

            setIsListening(true);
            setStatus('Escuchando...');

        } catch (error: any) {
            console.error('[ElevenLabs] Microphone error:', error);
            setError('Error de micrófono: ' + error.message);
        }
    }, [initAudioContext, isMuted]);

    // Stop microphone
    const stopMicrophone = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsListening(false);
        setVolume(0);
    }, []);

    // Connect to ElevenLabs
    const connect = useCallback(async () => {
        try {
            setStatus('Obteniendo contexto de la reunión...');
            setError(null);

            // Get full context from backend
            let fullContext = meetingContext || '';
            if (recordingId) {
                try {
                    const backendUrlEnv = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
                    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const backendUrl = backendUrlEnv
                        ? backendUrlEnv
                        : (isDev
                            ? 'http://localhost:10000'
                            : 'https://kipu-backend-8006.onrender.com');

                    const response = await fetch(`${backendUrl}/api/recordings/${recordingId}/context`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.context) {
                            fullContext = data.context;
                            console.log('[ElevenLabs] Got full context from backend');
                        }
                    } else {
                        console.warn('[ElevenLabs] Could not fetch context from backend, using provided context');
                    }
                } catch (error) {
                    console.warn('[ElevenLabs] Error fetching context:', error);
                    // Continue with provided context
                }
            }

            setStatus('Conectando a Eleven Labs...');

            // Initialize audio
            const ctx = initAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            // Connect to ElevenLabs Conversational AI WebSocket
            const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`;

            console.log('[ElevenLabs] Connecting to:', wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[ElevenLabs] Connected!');
                setIsConnected(true);
                setStatus('Conectado');

                // Send initial context about the meeting using Eleven Labs format
                if (fullContext) {
                    // Eleven Labs uses 'conversation_initiation_client_data' for initial setup
                    ws.send(JSON.stringify({
                        type: 'conversation_initiation_client_data',
                        conversation_config_override: {
                            agent: {
                                prompt: {
                                    prompt: fullContext
                                },
                                first_message: 'Hola, soy tu asistente de voz. Puedo ayudarte a entender y recordar información de esta reunión. ¿Sobre qué te gustaría saber?',
                                language: 'es'
                            }
                        }
                    }));
                    console.log('[ElevenLabs] Sent conversation initiation with context');
                }

                // Start microphone after a short delay to ensure context is processed
                setTimeout(() => {
                    startMicrophone();
                }, 300);
            };

            ws.onmessage = handleMessage;

            ws.onclose = (event) => {
                console.log('[ElevenLabs] Disconnected:', event.code, event.reason);
                setIsConnected(false);
                setStatus('Desconectado');
                stopMicrophone();
            };

            ws.onerror = (error) => {
                console.error('[ElevenLabs] WebSocket error:', error);
                setError('Error de conexión WebSocket');
            };

        } catch (error: any) {
            console.error('[ElevenLabs] Connection failed:', error);
            setError('Error al conectar: ' + error.message);
            setStatus('Error');
        }
    }, [initAudioContext, meetingContext, recordingId, handleMessage, startMicrophone, stopMicrophone]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        stopMicrophone();
        if (currentSourceRef.current) {
            currentSourceRef.current.stop();
        }
        audioQueueRef.current = [];
        setIsConnected(false);
        setIsSpeaking(false);
        setStatus('Desconectado');
    }, [stopMicrophone]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [disconnect]);

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden border border-stone-200 dark:border-stone-800">
            {/* Header */}
            <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`relative w-3 h-3`}>
                            <div className={`absolute inset-0 rounded-full ${isConnected ? 'bg-green-500' : 'bg-stone-400'}`} />
                            {isConnected && (
                                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-50" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-800 dark:text-white flex items-center gap-2">
                                Asistente de Voz
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded-full">
                                    ElevenLabs
                                </span>
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                {status}
                            </p>
                        </div>
                    </div>

                    {isConnected && (
                        <button
                            onClick={toggleMute}
                            className={`p-2 rounded-lg transition-colors ${isMuted
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                                }`}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        ⚠️ {error}
                    </p>
                </div>
            )}

            {/* Visualization Area */}
            <div className="p-8 bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950 flex flex-col items-center justify-center gap-6 border-b border-stone-200 dark:border-stone-800">
                {/* Audio Visualizer */}
                <div className="relative">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeaking
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30'
                        : isListening
                            ? 'bg-gradient-to-br from-primary to-amber-500 shadow-lg shadow-primary/30'
                            : 'bg-stone-200 dark:bg-stone-700'
                        }`}>
                        {/* Animated rings */}
                        {(isListening || isSpeaking) && (
                            <>
                                <div
                                    className={`absolute inset-0 rounded-full ${isSpeaking ? 'bg-violet-500' : 'bg-primary'} animate-ping opacity-20`}
                                    style={{ animationDuration: '1.5s' }}
                                />
                                <div
                                    className={`absolute inset-2 rounded-full ${isSpeaking ? 'bg-violet-400' : 'bg-amber-400'} animate-ping opacity-15`}
                                    style={{ animationDuration: '2s', animationDelay: '0.5s' }}
                                />
                            </>
                        )}

                        {/* Volume-based scaling */}
                        <div
                            className="w-16 h-16 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center transition-transform duration-150"
                            style={{ transform: `scale(${1 + volume * 0.3})` }}
                        >
                            {isSpeaking ? (
                                <Volume2 size={24} className="text-violet-600 dark:text-violet-400" />
                            ) : isListening ? (
                                <Mic size={24} className="text-primary" />
                            ) : (
                                <MicOff size={24} className="text-stone-400" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Connection Button */}
                <div className="flex gap-4">
                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-2xl font-semibold shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all hover:scale-105"
                        >
                            <Phone size={20} />
                            Iniciar Conversación
                        </button>
                    ) : (
                        <button
                            onClick={disconnect}
                            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all hover:scale-105"
                        >
                            <PhoneOff size={20} />
                            Terminar
                        </button>
                    )}
                </div>

                {/* Status Text */}
                <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
                    {isConnected
                        ? isSpeaking
                            ? "🔊 El asistente está hablando..."
                            : isListening
                                ? "🎤 Escuchando... Habla ahora"
                                : "Conectado"
                        : "Presiona para iniciar una conversación de voz"}
                </p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 dark:bg-stone-950/50">
                {messages.length === 0 ? (
                    <div className="text-center text-stone-400 mt-10">
                        <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">La transcripción aparecerá aquí...</p>
                        <p className="text-xs mt-2 text-stone-400">
                            Pregunta sobre los puntos clave de la reunión, tareas pendientes, o cualquier detalle específico.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                        >
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-tr-none'
                                : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-tl-none shadow-sm'
                                }`}>
                                <p className="leading-relaxed">{msg.text}</p>
                                <p className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-white/60' : 'text-stone-400'
                                    }`}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default ElevenLabsAgent;
