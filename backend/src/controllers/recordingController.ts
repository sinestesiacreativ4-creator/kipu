import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';
import { createError } from '../middleware/errorHandler';

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
                    return res.status(404).json({ error: 'Recording not found' });
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
            res.status(500).json({ error: error.message });
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
            res.status(500).json({ error: error.message });
        }
    }
};

// Routes
router.get('/recordings/:sessionId/:recordingId?', RecordingController.getRecordings);
router.delete('/recordings/:recordingId', RecordingController.deleteRecording);

export default router;
