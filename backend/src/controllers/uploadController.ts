import { Request, Response } from 'express';
import { audioQueue } from '../services/queue';
import dotenv from 'dotenv';
import multer from 'multer';
import IORedis from 'ioredis';

dotenv.config();

// Redis connection for file storage
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Configure Multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
    }
});

export const UploadController = {
    // Middleware for handling file upload
    uploadMiddleware: upload.single('file'),

    /**
     * Upload file directly to Redis and queue for processing
     * Replaces Supabase Storage flow
     */
    async uploadToRedis(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { recordingId, userId, organizationId } = req.body;

            console.log(`[API] Received file upload for recording ${recordingId} (${req.file.size} bytes)`);

            // 1. Store file in Redis (Expire in 1 hour)
            const fileKey = `file:${recordingId}`;

            // Store as Buffer (binary)
            await redis.set(fileKey, req.file.buffer);
            await redis.expire(fileKey, 3600); // 1 hour TTL

            console.log(`[API] File stored in Redis with key: ${fileKey}`);

            // 2. Create recording entry in Redis
            const recording = {
                id: recordingId,
                userId,
                organizationId,
                audioBase64: null,
                audioKey: fileKey,
                duration: 0,
                createdAt: Date.now(),
                status: 'PROCESSING',
                markers: [],
                analysis: {
                    title: 'Procesando...',
                    category: 'Procesando',
                    summary: ['Subiendo archivo...'],
                    actionItems: [],
                    transcript: [],
                    tags: []
                }
            };

            const { redisDb } = await import('../services/redisDb');
            await redisDb.saveRecording(recording);

            // 3. Queue job
            const job = await audioQueue.add('process-audio-redis', {
                fileKey,
                recordingId,
                userId,
                organizationId,
                mimeType: req.file.mimetype
            }, {
                attempts: 3,
                removeOnComplete: true
            });

            console.log(`[API] Job ${job.id} queued`);

            // 4. Initialize status in Redis
            await redis.hset(`status:${recordingId}`, {
                status: 'QUEUED',
                progress: '0'
            });
            await redis.expire(`status:${recordingId}`, 86400); // 24 hours

            res.json({
                success: true,
                message: 'File uploaded and queued successfully',
                jobId: job.id
            });

        } catch (error: any) {
            console.error('[API] Error in uploadToRedis:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get processing status from Redis
     */
    async getStatus(req: Request, res: Response) {
        try {
            const { recordingId } = req.params;
            const status = await redis.hgetall(`status:${recordingId}`);

            if (!status || Object.keys(status).length === 0) {
                return res.status(404).json({ error: 'Status not found' });
            }

            // Parse analysis if it exists
            if (status.analysis) {
                try {
                    status.analysis = JSON.parse(status.analysis);
                } catch (e) {
                    // keep as string if parse fails
                }
            }

            res.json(status);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
};
