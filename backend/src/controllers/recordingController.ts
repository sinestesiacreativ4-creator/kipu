import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';
import { validateUUID } from '../middleware/validateUUID';

const router = Router();

export const RecordingController = {
    /**
     * Get all recordings for an organization and user
     */
    async getRecordings(req: Request, res: Response) {
        const { sessionId, recordingId } = req.params;

        // sessionId is actually organizationId in the current frontend implementation
        const organizationId = sessionId;

        try {
            // If specific recordingId is requested
            if (recordingId && recordingId !== 'undefined') {
                const recording = await prisma.recording.findUnique({
                    where: { id: recordingId },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                role: true,
                                avatarColor: true
                            }
                        }
                    }
                });

                if (!recording) {
                    return res.status(404).json({
                        error: 'Recording not found',
                        message: `No recording exists with ID: ${recordingId}`,
                        code: 'RECORDING_NOT_FOUND'
                    });
                }

                return res.json(recording);
            }

            // Otherwise, get all recordings for the organization
            const recordings = await prisma.recording.findMany({
                where: { organizationId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                            avatarColor: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 100 // Limit to avoid huge queries
            });

            res.json(recordings);
        } catch (error: any) {
            console.error('[RecordingController] Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    },

    /**
     * Get formatted context for voice agent (Eleven Labs)
     * GET /api/recordings/:recordingId/context
     */
    async getContext(req: Request, res: Response) {
        const { recordingId } = req.params;

        try {
            const recording = await prisma.recording.findUnique({
                where: { id: recordingId }
            });

            if (!recording || !recording.analysis) {
                return res.status(404).json({
                    error: 'Recording not found or not analyzed',
                    message: `No recording exists with ID: ${recordingId} or it hasn't been analyzed yet`,
                    code: 'RECORDING_NOT_FOUND'
                });
            }

            const analysis = recording.analysis as any;

            // Build comprehensive context for Eleven Labs agent
            const context = `Eres un asistente de voz experto que ayuda a los usuarios a entender y recordar información de sus reuniones.

INFORMACIÓN DE LA REUNIÓN:
Título: ${analysis.title || 'Sin título'}
Duración: ${recording.duration ? `${Math.round(recording.duration / 60)} minutos` : 'No especificada'}

${analysis.executiveSummary ? `RESUMEN EJECUTIVO:\n${analysis.executiveSummary}\n` : ''}

${analysis.participants?.length > 0 ? `PARTICIPANTES: ${analysis.participants.join(', ')}\n` : ''}

${analysis.keyTopics?.length > 0 ? `TEMAS PRINCIPALES: ${analysis.keyTopics.join(', ')}\n` : ''}

${analysis.summary?.length > 0 ? `PUNTOS CLAVE:\n${analysis.summary.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n` : ''}

${analysis.decisions?.length > 0 ? `DECISIONES TOMADAS:\n${analysis.decisions.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}\n` : ''}

${analysis.actionItems?.length > 0 ? `TAREAS PENDIENTES:\n${analysis.actionItems.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n` : ''}

INSTRUCCIONES:
- Habla de manera natural y conversacional en español
- Sé conciso pero informativo
- Usa un tono amigable y profesional
- Si no sabes algo, dilo claramente
- Sugiere información relacionada que pueda ser útil
- Responde preguntas sobre la reunión usando la información proporcionada arriba
- Puedes mencionar participantes, decisiones, tareas y temas clave cuando sea relevante`;

            res.json({
                success: true,
                context: context.trim(),
                recording: {
                    id: recording.id,
                    title: analysis.title,
                    duration: recording.duration,
                    createdAt: recording.createdAt
                }
            });
        } catch (error: any) {
            console.error('[RecordingController] Get context error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    },

    /**
     * Delete a recording
     */
    async deleteRecording(req: Request, res: Response) {
        const { recordingId } = req.params;

        try {
            await prisma.recording.delete({
                where: { id: recordingId }
            });

            res.json({ success: true, message: 'Recording deleted' });
        } catch (error: any) {
            console.error('[RecordingController] Delete error:', error);

            if (error.code === 'P2025') {
                return res.status(404).json({
                    error: 'Recording not found',
                    message: 'Cannot delete: recording does not exist',
                    code: 'RECORDING_NOT_FOUND'
                });
            }

            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    }
};

// Routes - IMPORTANT: Specific routes MUST come before parameterized routes!
router.get('/recordings/:recordingId/context', RecordingController.getContext);
router.delete('/recordings/:recordingId', validateUUID('recordingId'), RecordingController.deleteRecording);
router.get('/recordings/:sessionId/:recordingId?', RecordingController.getRecordings);

export default router;
