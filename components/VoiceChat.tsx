import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Phone, PhoneOff } from 'lucide-react';

interface VoiceChatProps {
    recordingId: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ recordingId }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [status, setStatus] = useState<string>('Desconectado');

    const wsRef = useRef<WebSocket | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize voice session
    const connect = async () => {
        try {
            setStatus('Conectando...');

            // Initialize session with backend
            const apiUrl = `${window.location.origin}/api/voice/init/${recordingId}`;
            console.log('[Voice] Connecting to:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Voice] API Error:', response.status, errorText);
                throw new Error(`Error ${response.status}: ${errorText || 'Failed to initialize voice session'}`);
            }

            const data = await response.json();
            console.log('[Voice] Session initialized:', data);

            const { sessionId } = data;
            sessionIdRef.current = sessionId;

            // Connect WebSocket
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/voice?sessionId=${sessionId}`;
            console.log('[Voice] Connecting WebSocket to:', wsUrl);

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[Voice] WebSocket connected');
                setIsConnected(true);
                setStatus('Conectado - Presiona el micrófono para hablar');
                wsRef.current = ws;
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleGeminiMessage(message);
            };

            ws.onerror = (error) => {
                console.error('[Voice] WebSocket error:', error);
                setStatus('Error de conexión WebSocket');
            };

            ws.onclose = (event) => {
                console.log('[Voice] WebSocket closed:', event.code, event.reason);
                setIsConnected(false);
                setStatus(event.code === 1008 ? 'Sesión inválida' : 'Desconectado');
                cleanup();
            };

        } catch (error: any) {
            console.error('[Voice] Connection error:', error);
            setStatus(`Error: ${error.message || 'No se pudo conectar'}`);
        }
    };

    // Handle messages from Gemini
    const handleGeminiMessage = (message: any) => {
        if (message.serverContent?.modelTurn) {
            const parts = message.serverContent.modelTurn.parts;

            parts.forEach((part: any) => {
                // Handle audio response
                if (part.inlineData?.mimeType === 'audio/pcm') {
                    playAudio(part.inlineData.data);
                }

                // Handle text response (for debugging)
                if (part.text) {
                    console.log('[Voice] Gemini:', part.text);
                }
            });
        }

        // Handle turn complete
        if (message.serverContent?.turnComplete) {
            setIsSpeaking(false);
        }
    };

    // Play audio from Gemini
    const playAudio = async (base64Audio: string) => {
        try {
            setIsSpeaking(true);

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }

            const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
            const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsSpeaking(false);
            source.start();

        } catch (error) {
            console.error('[Voice] Error playing audio:', error);
            setIsSpeaking(false);
        }
    };

    // Start listening (capture microphone)
    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                    // Convert to base64 and send
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        wsRef.current?.send(JSON.stringify({
                            type: 'audio',
                            data: base64
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            mediaRecorder.start(100); // Send chunks every 100ms
            mediaRecorderRef.current = mediaRecorder;
            setIsListening(true);
            setStatus('Escuchando...');

        } catch (error) {
            console.error('[Voice] Error accessing microphone:', error);
            setStatus('Error: No se pudo acceder al micrófono');
        }
    };

    // Stop listening
    const stopListening = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current = null;
        }
        setIsListening(false);
        setStatus('Conectado - Presiona el micrófono para hablar');
    };

    // Disconnect
    const disconnect = async () => {
        if (sessionIdRef.current) {
            await fetch(`/api/voice/close/${sessionIdRef.current}`, { method: 'POST' });
        }

        if (wsRef.current) {
            wsRef.current.close();
        }

        cleanup();
    };

    // Cleanup
    const cleanup = () => {
        stopListening();
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        wsRef.current = null;
        sessionIdRef.current = null;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700">
            {/* Beta Badge */}
            <div className="mb-4 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-bold rounded-full border border-amber-200 dark:border-amber-800">
                🚧 BETA - En Desarrollo
            </div>

            {/* Status */}
            <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-stone-800 dark:text-white mb-2">
                    🎙️ Asistente de Voz
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {status}
                </p>
                {status.includes('Error') && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        💡 Tip: Verifica la consola del navegador para más detalles
                    </p>
                )}
            </div>

            {/* Visual Indicator */}
            <div className="relative mb-8">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${isSpeaking
                    ? 'bg-secondary animate-pulse'
                    : isListening
                        ? 'bg-primary animate-pulse'
                        : 'bg-stone-200 dark:bg-stone-700'
                    }`}>
                    {isSpeaking ? (
                        <Volume2 size={48} className="text-white" />
                    ) : isListening ? (
                        <Mic size={48} className="text-white" />
                    ) : (
                        <MicOff size={48} className="text-stone-400" />
                    )}
                </div>

                {/* Ripple effect when speaking */}
                {isSpeaking && (
                    <div className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-20" />
                )}
            </div>

            {/* Controls */}
            <div className="flex gap-4">
                {!isConnected ? (
                    <button
                        onClick={connect}
                        className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <Phone size={20} />
                        Iniciar Conversación
                    </button>
                ) : (
                    <>
                        <button
                            onClick={isListening ? stopListening : startListening}
                            disabled={isSpeaking}
                            className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${isListening
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-primary hover:bg-primary-hover text-white'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isListening ? (
                                <>
                                    <MicOff size={20} />
                                    Detener
                                </>
                            ) : (
                                <>
                                    <Mic size={20} />
                                    Hablar
                                </>
                            )}
                        </button>

                        <button
                            onClick={disconnect}
                            className="px-6 py-3 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            <PhoneOff size={20} />
                            Finalizar
                        </button>
                    </>
                )}
            </div>

            {/* Instructions */}
            {isConnected && (
                <div className="mt-6 text-center text-sm text-stone-600 dark:text-stone-400">
                    <p>💡 Presiona "Hablar" y pregunta sobre la reunión</p>
                    <p className="text-xs mt-1">Ejemplo: "¿Qué decisiones se tomaron?"</p>
                </div>
            )}
        </div>
    );
};

export default VoiceChat;
