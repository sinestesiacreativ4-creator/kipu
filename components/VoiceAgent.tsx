import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, X, MessageSquare } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { floatTo16BitPCM, base64ToArrayBuffer, downsampleBuffer } from '../utils/audioUtils';

interface VoiceAgentProps {
    recordingId: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({ recordingId }) => {
    // State
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0);
    const [status, setStatus] = useState('Listo para conectar');
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const sessionIdRef = useRef<string | null>(null);

    // Initialize Audio Context
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            // Gemini supports 16kHz or 24kHz. We use 24kHz for better output quality if possible,
            // but input MUST be 16kHz. We'll handle resampling.
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        }
        return audioContextRef.current;
    };

    // Connect to Backend WebSocket
    const connect = async () => {
        try {
            setStatus('Iniciando sesión...');
            const ctx = initAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            // 1. Initialize Session via API
            // Direct connection to Render Backend (CORS must be enabled on backend)
            const isDev = window.location.hostname === 'localhost';
            const backendUrl = isDev
                ? 'http://localhost:10000'
                : 'https://kipu-backend-8006.onrender.com';

            const response = await fetch(`${backendUrl}/api/voice/init/${recordingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Error al iniciar sesión');
            const data = await response.json();
            sessionIdRef.current = data.sessionId;

            // 2. Connect WebSocket (Direct to Backend)
            // WebSockets must connect directly as Vercel doesn't proxy them well
            setStatus('Conectando WebSocket...');

            const isDev = window.location.hostname === 'localhost';
            const wsProtocol = isDev ? 'ws:' : 'wss:';
            const wsHost = isDev ? 'localhost:10000' : 'kipu-backend-8006.onrender.com';
            const wsUrl = `${wsProtocol}//${wsHost}/voice?sessionId=${data.sessionId}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[VoiceAgent] Connected');
                setIsConnected(true);
                setStatus('Conectado');
                startRecording(); // Auto-start microphone
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                handleServerMessage(message);
            };

            ws.onclose = () => {
                console.log('[VoiceAgent] Disconnected');
                setIsConnected(false);
                setStatus('Desconectado');
                stopRecording();
            };

            ws.onerror = (error) => {
                console.error('[VoiceAgent] Error:', error);
                setStatus('Error de conexión');
            };

        } catch (error) {
            console.error('[VoiceAgent] Connection failed:', error);
            setStatus('Error al conectar');
        }
    };

    // Handle Server Messages
    const handleServerMessage = async (message: any) => {
        // 1. Audio Content
        if (message.serverContent?.modelTurn) {
            const parts = message.serverContent.modelTurn.parts;
            for (const part of parts) {
                if (part.inlineData?.mimeType === 'audio/pcm') {
                    // Add to queue and play
                    audioQueueRef.current.push(part.inlineData.data);
                    if (!isPlayingRef.current) {
                        playNextInQueue();
                    }
                }
                if (part.text) {
                    addMessage('assistant', part.text);
                }
            }
        }

        // 2. Turn Complete
        if (message.serverContent?.turnComplete) {
            // AI finished generating current turn
        }
    };

    // Play Audio Queue
    const playNextInQueue = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            return;
        }

        isPlayingRef.current = true;
        setIsPlaying(true);

        const base64Data = audioQueueRef.current.shift();
        if (!base64Data || !audioContextRef.current) return;

        try {
            // Convert Base64 PCM -> Float32
            const arrayBuffer = base64ToArrayBuffer(base64Data);
            const int16Data = new Int16Array(arrayBuffer);
            const float32Data = new Float32Array(int16Data.length);

            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            // Create Buffer
            const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
            buffer.getChannelData(0).set(float32Data);

            // Play
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);

            currentSourceRef.current = source;

            source.onended = () => {
                playNextInQueue();
            };

            source.start();

            // Visualize volume
            // (Simplified volume calculation for visualization)
            let sum = 0;
            for (let i = 0; i < float32Data.length; i += 100) {
                sum += Math.abs(float32Data[i]);
            }
            setVolume(Math.min(1, (sum / (float32Data.length / 100)) * 5));

        } catch (error) {
            console.error('[VoiceAgent] Playback error:', error);
            playNextInQueue();
        }
    };

    // Start Recording (Microphone)
    const startRecording = async () => {
        try {
            if (!audioContextRef.current) initAudioContext();
            const ctx = audioContextRef.current!;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000, // Request 16kHz
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Use ScriptProcessor for raw PCM access (AudioWorklet is better but more complex to setup in Vite without separate files)
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // Calculate volume for visualizer
                let sum = 0;
                for (let i = 0; i < inputData.length; i += 50) {
                    sum += Math.abs(inputData[i]);
                }
                const vol = Math.min(1, (sum / (inputData.length / 50)) * 5);
                setVolume(vol);

                // Detect speech to interrupt AI
                if (vol > 0.1 && isPlayingRef.current) {
                    // User is speaking, stop AI
                    if (currentSourceRef.current) {
                        currentSourceRef.current.stop();
                        audioQueueRef.current = []; // Clear queue
                        isPlayingRef.current = false;
                        setIsPlaying(false);
                    }
                }

                // Downsample to 16kHz if needed (Gemini requirement)
                // Note: If context is 24kHz or 48kHz, we must downsample
                const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);

                // Convert to Int16 PCM
                const pcmData = floatTo16BitPCM(downsampled);

                // Convert to Base64
                const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

                // Send to WebSocket (backend expects type: 'audio' format)
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'audio',
                        data: base64
                    }));
                }
            };

            source.connect(processor);
            processor.connect(ctx.destination); // Necessary for script processor to run

            setIsListening(true);

        } catch (error) {
            console.error('[VoiceAgent] Mic error:', error);
            setStatus('Error de micrófono');
        }
    };

    // Stop Recording
    const stopRecording = () => {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current.mediaStream.getTracks().forEach(t => t.stop());
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
        }
        setIsListening(false);
    };

    // Disconnect
    const disconnect = () => {
        if (wsRef.current) wsRef.current.close();
        stopRecording();
        if (currentSourceRef.current) currentSourceRef.current.stop();
        audioQueueRef.current = [];
        setIsConnected(false);
        setStatus('Desconectado');
    };

    // Add Message to Chat
    const addMessage = (role: 'user' | 'assistant', text: string) => {
        setMessages(prev => [...prev, { role, text }]);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            disconnect();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-stone-900 rounded-2xl shadow-xl overflow-hidden border border-stone-200 dark:border-stone-800">
            {/* Header */}
            <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <h3 className="font-semibold text-stone-800 dark:text-white">Agente de Voz</h3>
                </div>
                <div className="text-xs text-stone-500 font-mono">{status}</div>
            </div>

            {/* Visualizer Area */}
            <div className="p-6 bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950 flex flex-col items-center justify-center gap-6 border-b border-stone-200 dark:border-stone-800">
                <AudioVisualizer
                    isPlaying={isPlaying}
                    isListening={isListening}
                    volume={volume}
                />

                {/* Controls */}
                <div className="flex gap-4">
                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="w-16 h-16 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                        >
                            <Phone size={32} />
                        </button>
                    ) : (
                        <button
                            onClick={disconnect}
                            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 animate-pulse"
                        >
                            <PhoneOff size={32} />
                        </button>
                    )}
                </div>

                <p className="text-sm text-stone-500 dark:text-stone-400">
                    {isConnected
                        ? isPlaying
                            ? "Gemini está hablando..."
                            : "Escuchando..."
                        : "Presiona para conectar"}
                </p>
            </div>

            {/* Transcription / Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 dark:bg-stone-950/50">
                {messages.length === 0 && (
                    <div className="text-center text-stone-400 mt-10">
                        <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">La conversación aparecerá aquí...</p>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                            ? 'bg-primary text-white rounded-tr-none'
                            : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-tl-none'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VoiceAgent;
