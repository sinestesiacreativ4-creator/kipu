import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { redisConnection } from '../services/queue';

const router = Router();

/**
 * Get recording status for polling
 * GET /api/status/:recordingId
 */
router.get('/status/:recordingId', async (req: Request, res: Response) => {
    try {
        const { recordingId } = req.params;

        // 1. Try Redis first (Real-time status)
        const redisKey = `status:${recordingId}`;
        const redisData = await redisConnection.hgetall(redisKey);

        if (redisData && redisData.status) {
            // Parse analysis if present
            let analysis = null;
            if (redisData.analysis) {
                try {
                    analysis = JSON.parse(redisData.analysis);
                } catch (e) {
                    console.warn('[StatusEndpoint] Failed to parse Redis analysis JSON');
                }
            }

            return res.json({
                status: redisData.status,
                recordingId,
                analysis,
                error: redisData.error,
                progress: redisData.progress ? parseInt(redisData.progress) : undefined
            });
        }

        // 2. Fallback to Database
        const recording = await prisma.recording.findUnique({
            where: { id: recordingId }
        });

        if (!recording) {
            return res.status(404).json({
                error: 'Recording not found',
                status: 'NOT_FOUND'
            });
        }

        // Map database status to expected frontend status
        const response: any = {
            status: recording.status,
            recordingId: recording.id
        };

        // If completed, include analysis
        if (recording.status === 'COMPLETED' && recording.analysis) {
            response.analysis = recording.analysis;
        }

        // If error, include error message
        if (recording.status === 'ERROR') {
            response.error = 'Processing failed';
        }

        res.json(response);

    } catch (error: any) {
        console.error('[StatusEndpoint] Error:', error);
        res.status(500).json({
            error: error.message,
            status: 'ERROR'
        });
    }
});

export default router;
