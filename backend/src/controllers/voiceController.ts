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
        res.status(500).json({ error: error.message });
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

                if (message.type === 'audio') {
                    // Forward audio to Gemini
                    const audioBuffer = Buffer.from(message.data, 'base64');
                    session.sendAudio(audioBuffer);
                } else if (message.type === 'text') {
                    // Forward text to Gemini
                    session.sendText(message.text);
                }
            } catch (error) {
                console.error('[Voice] Error processing client message:', error);
            }
        });

        // Forward messages from Gemini to client
        session.onMessage((geminiMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(geminiMessage));
            }
        });

        ws.on('close', () => {
            console.log(`[Voice] Client disconnected from session ${sessionId}`);
        });
    });
}

export default router;
