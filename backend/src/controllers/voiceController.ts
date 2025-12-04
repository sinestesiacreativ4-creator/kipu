import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GeminiLiveSession } from '../services/geminiLiveSession';
import prisma from '../services/prisma';

const router = Router();

// Store active sessions
const activeSessions = new Map<string, GeminiLiveSession>();

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
        await session.connect();

        // Store session
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
        const sessionId = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('sessionId');

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
