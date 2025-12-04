import { WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class GeminiLiveSession {
    private ws: WebSocket | null = null;
    private sessionId: string;
    private analysisContext: string;
    private messageCallback: ((data: any) => void) | null = null;
    private messageQueue: any[] = []; // Queue messages until callback is set
    private setupComplete: boolean = false; // Track if setup is complete
    private audioQueue: Buffer[] = []; // Queue audio until setup is complete

    constructor(sessionId: string, analysisContext: string) {
        this.sessionId = sessionId;
        this.analysisContext = analysisContext;
    }

    async connect(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        
        // Use gemini-2.5-flash-live which supports Live API (real-time audio)
        // gemini-2.0-flash-exp may not support Live API
        const model = 'gemini-2.5-flash-live';

        // Gemini Live API WebSocket URL
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log(`[GeminiLive] ✅ WebSocket OPEN for session ${this.sessionId}`);
                console.log(`[GeminiLive] WebSocket state: ${this.ws?.readyState} (should be 1=OPEN)`);

                // Send initial setup message
                this.sendSetup();
                resolve();
            });

            this.ws.on('error', (error: any) => {
                console.error(`[GeminiLive] WebSocket error:`, error);
                console.error(`[GeminiLive] Error details:`, error.message, error.code);
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                console.log(`[GeminiLive] Session ${this.sessionId} closed (code: ${code}, reason: ${reasonStr})`);
                
                // Reset state
                this.setupComplete = false;
                this.audioQueue = [];
                
                // Log common error codes
                if (code === 1006) {
                    console.error(`[GeminiLive] Abnormal closure - connection lost. Possible causes: model not available, API key invalid, or network issue.`);
                } else if (code === 1008) {
                    console.error(`[GeminiLive] Policy violation - check API key permissions and model availability.`);
                    console.error(`[GeminiLive] The model 'gemini-2.5-flash-live' may not be available for your account.`);
                } else if (code === 1011) {
                    console.error(`[GeminiLive] ❌ QUOTA EXCEEDED - You have exceeded your Gemini API quota.`);
                    console.error(`[GeminiLive] Please check your billing and plan at: https://ai.google.dev/pricing`);
                    console.error(`[GeminiLive] Reason: ${reasonStr}`);
                } else if (code !== 1000 && code !== 1001) {
                    console.error(`[GeminiLive] Unexpected close code: ${code}`);
                }
            });

            // Set up message handler
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`[GeminiLive] Received message from Gemini:`, JSON.stringify(message, null, 2));
                    
                    // Log specific message types
                    if (message.setupComplete) {
                        console.log(`[GeminiLive] ✅ Setup complete for session ${this.sessionId}`);
                        this.setupComplete = true;
                        
                        // Send any queued audio
                        console.log(`[GeminiLive] Processing ${this.audioQueue.length} queued audio chunks`);
                        while (this.audioQueue.length > 0) {
                            const queuedAudio = this.audioQueue.shift();
                            if (queuedAudio && this.ws && this.ws.readyState === WebSocket.OPEN) {
                                this.sendAudioInternal(queuedAudio);
                            }
                        }
                    }
                    if (message.serverContent?.modelTurn) {
                        console.log(`[GeminiLive] Model turn received with ${message.serverContent.modelTurn.parts?.length || 0} parts`);
                    }
                    if (message.serverContent?.turnComplete) {
                        console.log(`[GeminiLive] Turn complete`);
                    }
                    
                    // If callback is set, call it immediately
                    // Otherwise, queue the message
                    if (this.messageCallback) {
                        this.messageCallback(message);
                    } else {
                        console.log(`[GeminiLive] Queueing message (no callback yet)`);
                        this.messageQueue.push(message);
                    }
                } catch (error) {
                    console.error(`[GeminiLive] Error parsing message:`, error);
                }
            });
        });
    }

    private sendSetup(): void {
        if (!this.ws) return;

        const setupMessage = {
            setup: {
                model: 'models/gemini-2.5-flash-live',
                generation_config: {
                    response_modalities: ['AUDIO'],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: 'Puck' // Voz masculina natural
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: `Eres un asistente de voz experto que ayuda a los usuarios a entender y recordar información de sus reuniones.

${this.analysisContext}

INSTRUCCIONES:
- Habla de manera natural y conversacional
- Sé conciso pero informativo
- Usa un tono amigable y profesional
- Si no sabes algo, dilo claramente
- Sugiere información relacionada que pueda ser útil
- SIEMPRE responde en español`
                    }]
                }
            }
        };

        const setupJson = JSON.stringify(setupMessage);
        console.log(`[GeminiLive] 📤 Sending setup for session ${this.sessionId}`);
        console.log(`[GeminiLive] WebSocket state before send: ${this.ws.readyState} (1=OPEN)`);
        console.log(`[GeminiLive] Setup message:`, JSON.stringify(setupMessage, null, 2));
        
        try {
            this.ws.send(setupJson);
            console.log(`[GeminiLive] ✅ Setup message sent successfully`);
        } catch (error: any) {
            console.error(`[GeminiLive] ❌ Error sending setup:`, error);
            throw error;
        }
    }

    sendAudio(audioData: Buffer): void {
        // Check WebSocket state
        if (!this.ws) {
            console.warn(`[GeminiLive] WebSocket is null`);
            return;
        }

        const wsState = this.ws.readyState;
        if (wsState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] WebSocket not ready (state: ${wsState}). States: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED`);
            return;
        }

        // If setup is not complete, queue the audio
        if (!this.setupComplete) {
            console.log(`[GeminiLive] Setup not complete yet, queueing audio chunk (${audioData.length} bytes)`);
            this.audioQueue.push(audioData);
            return;
        }

        // Send audio immediately
        this.sendAudioInternal(audioData);
    }

    private sendAudioInternal(audioData: Buffer): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] Cannot send audio - WebSocket not open`);
            return;
        }

        const message = {
            realtime_input: {
                media_chunks: [{
                    mime_type: 'audio/pcm',
                    data: audioData.toString('base64')
                }]
            }
        };

        console.log(`[GeminiLive] ✅ Sending audio chunk (${audioData.length} bytes) - Setup complete`);
        this.ws.send(JSON.stringify(message));
    }

    sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] WebSocket not ready`);
            return;
        }

        const message = {
            client_content: {
                turns: [{
                    role: 'user',
                    parts: [{ text }]
                }],
                turn_complete: true
            }
        };

        console.log(`[GeminiLive] Sending text:`, text);
        this.ws.send(JSON.stringify(message));
    }

    sendTurnComplete(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] WebSocket not ready`);
            return;
        }

        const message = {
            realtime_input: {
                turn_complete: true
            }
        };

        console.log(`[GeminiLive] Sending turn_complete`);
        this.ws.send(JSON.stringify(message));
    }

    onMessage(callback: (data: any) => void): void {
        this.messageCallback = callback;
        
        // Process any queued messages
        console.log(`[GeminiLive] Callback set, processing ${this.messageQueue.length} queued messages`);
        while (this.messageQueue.length > 0) {
            const queuedMessage = this.messageQueue.shift();
            callback(queuedMessage);
        }
    }

    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
