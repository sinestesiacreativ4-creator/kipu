import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GeminiLiveSession } from '../services/geminiLiveSession';
import prisma from '../services/prisma';

const router = Router();

// Store active sessions
const activeSessions = new Map<string, GeminiLiveSession>();

/**
 * Get WebSocket URL for voice session
 * POST /api/voice/init/:sessionId
 * Simple endpoint that returns session info for frontend to connect
 * 
 * Optionally accepts ?recordingId=xxx to create Gemini session with context
 */
router.post('/init/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const recordingId = req.query.recordingId as string | undefined;

        // Detect backend URL automatically
        const protocol = req.protocol === 'https' ? 'wss' : 'ws';
        const host = req.get('host') || 'kipu-backend-8006.onrender.com';
        const wsUrl = `${protocol}://${host}/api/voice/ws/${sessionId}`;

        // Alternative: Use environment variable if set
        const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
        const finalWsUrl = backendUrl 
            ? `${backendUrl.startsWith('https') ? 'wss' : 'ws'}://${new URL(backendUrl).host}/api/voice/ws/${sessionId}`
            : wsUrl;

        // If recordingId is provided, create Gemini session with context
        if (recordingId) {
            try {
                // Get recording analysis
                const recording = await prisma.recording.findUnique({
                    where: { id: recordingId }
                });

                if (recording && recording.analysis) {
                    const analysis = recording.analysis as any;

                    // Build context for voice agent
                    const context = `
REUNIÓN: ${analysis.title || 'Sin título'}
DURACIÓN: ${recording.duration ? `${Math.round(recording.duration / 60)} minutos` : 'No especificada'}

${analysis.executiveSummary ? `RESUMEN: ${analysis.executiveSummary}` : ''}

${analysis.participants?.length > 0 ? `PARTICIPANTES: ${analysis.participants.join(', ')}` : ''}

${analysis.keyTopics?.length > 0 ? `TEMAS: ${analysis.keyTopics.join(', ')}` : ''}

${analysis.summary?.length > 0 ? `PUNTOS CLAVE:\n${analysis.summary.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}` : ''}

${analysis.decisions?.length > 0 ? `DECISIONES:\n${analysis.decisions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}` : ''}

${analysis.actionItems?.length > 0 ? `TAREAS:\n${analysis.actionItems.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}` : ''}
                    `.trim();

                    // Create Gemini session
                    const session = new GeminiLiveSession(sessionId, context);
                    console.log(`[Voice] Creating Gemini session for ${sessionId} with recording ${recordingId}...`);
                    
                    try {
                        await session.connect();
                        console.log(`[Voice] ✅ Gemini session created for ${sessionId}`);
                        activeSessions.set(sessionId, session);
                        
                        // Auto-cleanup after 30 minutes
                        setTimeout(() => {
                            if (activeSessions.has(sessionId)) {
                                activeSessions.get(sessionId)?.close();
                                activeSessions.delete(sessionId);
                                console.log(`[Voice] Session ${sessionId} auto-closed after timeout`);
                            }
                        }, 30 * 60 * 1000);
                    } catch (geminiError: any) {
                        console.error(`[Voice] Failed to create Gemini session:`, geminiError);
                        // Continue anyway - frontend can still connect, but Gemini won't respond
                    }
                }
            } catch (dbError: any) {
                console.error(`[Voice] Error fetching recording:`, dbError);
                // Continue anyway - return wsUrl even if recording not found
            }
        }

        const response = {
            success: true,
            sessionId: sessionId,
            wsUrl: finalWsUrl,
            createdAt: new Date().toISOString()
        };

        console.log(`[Voice] Session init requested for ${sessionId}, wsUrl: ${finalWsUrl}`);
        
        res.json(response);

    } catch (error: any) {
        console.error('[Voice] Init error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Failed to initialize session' 
        });
    }
});

/**
 * Initialize voice chat session
 * POST /api/voice/init/:recordingId
 */
router.post('/init/:recordingId', async (req: Request, res: Response) => {
    try {
        const { recordingId } = req.params;

        // Get recording analysis
        const recording = await prisma.recording.findUnique({
            where: { id: recordingId }
        });

        if (!recording || !recording.analysis) {
            return res.status(404).json({ error: 'Recording not found or not analyzed' });
        }

        const analysis = recording.analysis as any;

        // Build context for voice agent
        const context = `
REUNIÓN: ${analysis.title || 'Sin título'}
DURACIÓN: ${recording.duration ? `${Math.round(recording.duration / 60)} minutos` : 'No especificada'}

${analysis.executiveSummary ? `RESUMEN: ${analysis.executiveSummary}` : ''}

${analysis.participants?.length > 0 ? `PARTICIPANTES: ${analysis.participants.join(', ')}` : ''}

${analysis.keyTopics?.length > 0 ? `TEMAS: ${analysis.keyTopics.join(', ')}` : ''}

${analysis.summary?.length > 0 ? `PUNTOS CLAVE:\n${analysis.summary.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}` : ''}

${analysis.decisions?.length > 0 ? `DECISIONES:\n${analysis.decisions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}` : ''}

${analysis.actionItems?.length > 0 ? `TAREAS:\n${analysis.actionItems.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}` : ''}
        `.trim();

        // Create session
        const sessionId = `voice_${recordingId}_${Date.now()}`;
        const session = new GeminiLiveSession(sessionId, context);

        // Connect to Gemini Live API
        console.log(`[Voice] Connecting to Gemini Live API for session ${sessionId}...`);
        try {
            await session.connect();
            console.log(`[Voice] ✅ Connected to Gemini Live API for session ${sessionId}`);
        } catch (connectError: any) {
            console.error(`[Voice] ❌ Failed to connect to Gemini Live API:`, connectError);
            console.error(`[Voice] Error message:`, connectError.message);
            console.error(`[Voice] Error stack:`, connectError.stack);
            throw connectError; // Re-throw to be caught by outer catch
        }

        // Store session BEFORE setting up message forwarding
        // This ensures messages are queued if client connects later
        activeSessions.set(sessionId, session);

        // Auto-cleanup after 30 minutes
        setTimeout(() => {
            if (activeSessions.has(sessionId)) {
                activeSessions.get(sessionId)?.close();
                activeSessions.delete(sessionId);
                console.log(`[Voice] Session ${sessionId} auto-closed after timeout`);
            }
        }, 30 * 60 * 1000);

        res.json({
            success: true,
            sessionId,
            message: 'Voice session initialized'
        });

    } catch (error: any) {
        console.error('[Voice] Init error:', error);
        
        // Provide more helpful error messages
        let errorMessage = error.message || 'Failed to initialize voice session';
        if (error.message?.includes('GEMINI_API_KEY')) {
            errorMessage = 'GEMINI_API_KEY is not configured. Please set it in your .env file.';
        } else if (error.message?.includes('404') || error.message?.includes('not found')) {
            errorMessage = 'Recording not found or not analyzed yet.';
        } else if (error.message?.includes('model') || error.message?.includes('unavailable')) {
            errorMessage = 'Gemini Live API model is not available. The model gemini-2.0-flash-exp may not be accessible for your API key.';
        } else if (error.message?.includes('quota') || error.message?.includes('exceeded')) {
            errorMessage = 'Has excedido tu cuota de Gemini API. Por favor verifica tu plan y facturación en https://ai.google.dev/pricing';
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

/**
 * Close voice chat session
 * POST /api/voice/close/:sessionId
 */
router.post('/close/:sessionId', (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const session = activeSessions.get(sessionId);
        if (session) {
            session.close();
            activeSessions.delete(sessionId);
            console.log(`[Voice] Session ${sessionId} closed by user`);
        }

        res.json({ success: true });

    } catch (error: any) {
        console.error('[Voice] Close error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * WebSocket upgrade handler
 * This should be called from the main server setup
 */
export function setupVoiceWebSocket(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, req) => {
        // Support both query param (?sessionId=xxx) and path param (/api/voice/ws/:sessionId)
        let sessionId = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('sessionId');
        
        // If no query param, try to extract from path
        if (!sessionId && req.url) {
            const pathMatch = req.url.match(/\/api\/voice\/ws\/([^/?]+)/);
            if (pathMatch) {
                sessionId = pathMatch[1];
            }
        }

        if (!sessionId) {
            ws.close(1008, 'Missing sessionId');
            return;
        }

        const session = activeSessions.get(sessionId);
        if (!session) {
            ws.close(1008, 'Invalid sessionId');
            return;
        }

        console.log(`[Voice] Client connected to session ${sessionId}`);

        // Forward messages from client to Gemini
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`[Voice] Received message from client (session ${sessionId}):`, message.type);

                if (message.type === 'audio') {
                    // Forward audio to Gemini
                    const audioBuffer = Buffer.from(message.data, 'base64');
                    console.log(`[Voice] Forwarding audio chunk to Gemini (${audioBuffer.length} bytes)`);
                    session.sendAudio(audioBuffer);
                } else if (message.type === 'text') {
                    // Forward text to Gemini
                    console.log(`[Voice] Forwarding text to Gemini:`, message.text);
                    session.sendText(message.text);
                } else if (message.type === 'turn_complete') {
                    // Signal that user finished speaking
                    console.log(`[Voice] User finished speaking, signaling turn_complete to Gemini`);
                    session.sendTurnComplete();
                } else {
                    console.warn(`[Voice] Unknown message type:`, message.type);
                }
            } catch (error) {
                console.error('[Voice] Error processing client message:', error);
            }
        });

        // Forward messages from Gemini to client
        session.onMessage((geminiMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log(`[Voice] Forwarding message from Gemini to client (session ${sessionId})`);
                ws.send(JSON.stringify(geminiMessage));
            } else {
                console.warn(`[Voice] Cannot forward message - WebSocket not open (state: ${ws.readyState})`);
            }
        });

        ws.on('close', () => {
            console.log(`[Voice] Client disconnected from session ${sessionId}`);
        });
    });
}

export default router;
