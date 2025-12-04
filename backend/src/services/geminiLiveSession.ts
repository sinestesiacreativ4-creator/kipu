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

    constructor(sessionId: string, analysisContext: string) {
        this.sessionId = sessionId;
        this.analysisContext = analysisContext;
    }

    async connect(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        
        // Try gemini-2.0-flash-exp first (most common), fallback to gemini-2.5-flash-live
        const model = 'gemini-2.0-flash-exp';

        // Gemini Live API WebSocket URL
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log(`[GeminiLive] Session ${this.sessionId} connected`);

                // Send initial setup message
                this.sendSetup();
                resolve();
            });

            this.ws.on('error', (error) => {
                console.error(`[GeminiLive] Error:`, error);
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`[GeminiLive] Session ${this.sessionId} closed (code: ${code}, reason: ${reason})`);
            });

            // Set up message handler
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (this.messageCallback) {
                        this.messageCallback(message);
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
                model: 'models/gemini-2.0-flash-exp',
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

        this.ws.send(JSON.stringify(setupMessage));
        console.log(`[GeminiLive] Setup sent for session ${this.sessionId}`);
    }

    sendAudio(audioData: Buffer): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] WebSocket not ready`);
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

        this.ws.send(JSON.stringify(message));
    }

    onMessage(callback: (data: any) => void): void {
        this.messageCallback = callback;
    }

    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
