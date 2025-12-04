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
    private currentModel: string = ''; // Track the model being used

    constructor(sessionId: string, analysisContext: string) {
        this.sessionId = sessionId;
        this.analysisContext = analysisContext;
    }

    async connect(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        
        // Try models in order of preference for Live API support
        // Based on available models: gemini-2.0-flash-live, gemini-2.5-flash-live
        const modelsToTry = [
            'gemini-2.0-flash-live',  // First choice - newer model
            'gemini-2.5-flash-live',  // Second choice - latest model
            'gemini-1.5-flash-live'   // Fallback - older but stable
        ];
        
        let lastError: any = null;
        
        for (const model of modelsToTry) {
            this.currentModel = model;
            console.log(`[GeminiLive] 🔌 Attempting to connect to Gemini Live API with model: ${model}`);
            
            try {
                await this._attemptConnect(apiKey, model);
                console.log(`[GeminiLive] ✅ Successfully connected with model: ${model}`);
                return; // Connection successful
            } catch (error: any) {
                lastError = error;
                console.error(`[GeminiLive] ❌ Failed to connect with model ${model}:`, error.message);
                
                // Close WebSocket if it exists
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                
                // If it's a quota error, no need to try other models
                if (error.message?.includes('quota') || error.message?.includes('1011')) {
                    throw error;
                }
            }
        }
        
        // All models failed
        throw new Error(`Failed to connect to Gemini Live API after trying all models. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    private _attemptConnect(apiKey: string, model: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setupComplete = false; // Reset for each attempt
            this.audioQueue = []; // Clear queue for new attempt
            
            // Gemini Live API WebSocket URL
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
            
            console.log(`[GeminiLive] Model: ${model}`);
            console.log(`[GeminiLive] URL: ${wsUrl.replace(apiKey, '***')}`);
            
            let connectionTimeout: NodeJS.Timeout;
            let resolved = false;
            
            try {
                this.ws = new WebSocket(wsUrl);
                console.log(`[GeminiLive] WebSocket instance created, state: ${this.ws.readyState} (0=CONNECTING)`);
            } catch (error: any) {
                console.error(`[GeminiLive] ❌ Failed to create WebSocket:`, error);
                reject(error);
                return;
            }
            
            connectionTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.error(`[GeminiLive] ❌ Connection timeout after 10 seconds for model ${model}`);
                    this.ws?.close();
                    reject(new Error(`Connection timeout for model ${model}`));
                }
            }, 10000);
            
            this.ws.on('open', () => {
                if (resolved) return;
                resolved = true;
                if (connectionTimeout) clearTimeout(connectionTimeout);
                
                console.log(`[GeminiLive] ✅ WebSocket OPEN for session ${this.sessionId} with model ${model}`);
                console.log(`[GeminiLive] WebSocket state: ${this.ws?.readyState} (should be 1=OPEN)`);
                
                // Send initial setup message
                try {
                    this.sendSetup(model);
                    console.log(`[GeminiLive] Setup message sent, waiting for setupComplete...`);
                    
                    // Set a timeout to detect if setup never completes
                    setTimeout(() => {
                        if (!this.setupComplete && this.ws && this.ws.readyState === WebSocket.OPEN) {
                            console.warn(`[GeminiLive] ⚠️ Setup message sent but setupComplete not received after 5 seconds`);
                            console.warn(`[GeminiLive] This may indicate the setup message was rejected or the model is not compatible`);
                        }
                    }, 5000);
                } catch (setupError: any) {
                    console.error(`[GeminiLive] ❌ Error sending setup:`, setupError);
                    reject(setupError);
                    return;
                }
                
                resolve();
            });
            
            this.ws.on('error', (error: any) => {
                if (resolved) return;
                resolved = true;
                if (connectionTimeout) clearTimeout(connectionTimeout);
                
                console.error(`[GeminiLive] ❌ WebSocket error for model ${model}:`, error);
                console.error(`[GeminiLive] Error details:`, error.message, error.code);
                reject(error);
            });
            
            this.ws.on('close', (code, reason) => {
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                console.log(`[GeminiLive] 🔌 Session ${this.sessionId} closed (code: ${code}, reason: ${reasonStr}) for model ${model}`);
                console.log(`[GeminiLive] Setup was complete: ${this.setupComplete}, Audio queue length: ${this.audioQueue.length}`);
                
                // If closed before connection was established, reject the promise
                if (!resolved) {
                    resolved = true;
                    if (connectionTimeout) clearTimeout(connectionTimeout);
                    const error = new Error(`WebSocket closed before connection established (code: ${code}, reason: ${reasonStr}) for model ${model}`);
                    console.error(`[GeminiLive] ❌ Connection failed:`, error.message);
                    reject(error);
                } else {
                    // Connection was established but then closed
                    console.error(`[GeminiLive] ⚠️ WebSocket closed AFTER connection was established!`);
                    console.error(`[GeminiLive] This usually means Gemini rejected the setup or there was an error.`);
                    console.error(`[GeminiLive] Check the setup message format and model availability.`);
                }
                
                // Reset state
                this.setupComplete = false;
                this.audioQueue = [];
                
                // Log common error codes
                if (code === 1006) {
                    console.error(`[GeminiLive] Abnormal closure - connection lost. Possible causes: model not available, API key invalid, or network issue.`);
                } else if (code === 1008) {
                    console.error(`[GeminiLive] Policy violation - check API key permissions and model availability.`);
                    console.error(`[GeminiLive] The model '${model}' may not be available for your account.`);
                    console.error(`[GeminiLive] Common causes: Invalid model name, model not enabled for your API key, or incorrect setup message format.`);
                } else if (code === 1011) {
                    console.error(`[GeminiLive] ❌ QUOTA EXCEEDED - You have exceeded your Gemini API quota.`);
                    console.error(`[GeminiLive] Please check your billing and plan at: https://ai.google.dev/pricing`);
                    console.error(`[GeminiLive] Reason: ${reasonStr}`);
                } else if (code === 1000) {
                    console.log(`[GeminiLive] Normal closure (code 1000) - connection closed gracefully`);
                } else {
                    console.error(`[GeminiLive] Unexpected close code: ${code}, reason: ${reasonStr}`);
                }
            });
            
            // Set up message handler
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`[GeminiLive] 📥 Received message from Gemini (model: ${model}):`, JSON.stringify(message, null, 2));
                    
                    // Check for errors in the message
                    if (message.error) {
                        console.error(`[GeminiLive] ❌ Error from Gemini:`, message.error);
                    }
                    
                    // Log specific message types
                    if (message.setupComplete) {
                        console.log(`[GeminiLive] ✅ Setup complete for session ${this.sessionId} with model ${model}`);
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
                        console.log(`[GeminiLive] 🎤 Model turn received with ${message.serverContent.modelTurn.parts?.length || 0} parts`);
                    }
                    if (message.serverContent?.turnComplete) {
                        console.log(`[GeminiLive] ✅ Turn complete`);
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
                    console.error(`[GeminiLive] Raw message:`, data.toString().substring(0, 200));
                }
            });
        });
    }

    private sendSetup(model: string): void {
        if (!this.ws) return;

        const setupMessage = {
            setup: {
                model: `models/${model}`, // Use the model that successfully connected
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
            console.warn(`[GeminiLive] WebSocket is null - cannot send audio`);
            return;
        }

        const wsState = this.ws.readyState;
        if (wsState !== WebSocket.OPEN) {
            console.warn(`[GeminiLive] WebSocket not ready (state: ${wsState}). States: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED`);
            console.warn(`[GeminiLive] Current model: ${this.currentModel}, Setup complete: ${this.setupComplete}`);
            // Don't queue if WebSocket is closed - it won't recover
            if (wsState === WebSocket.CLOSED) {
                console.error(`[GeminiLive] ❌ WebSocket is CLOSED - cannot send audio. Connection may have been rejected by Gemini.`);
            }
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
