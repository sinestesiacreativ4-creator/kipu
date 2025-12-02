import { Request, Response } from 'express';
import { audioQueue } from '../services/queue';
import { createRedisClient } from '../config/redis.config';
import prisma from '../services/prisma';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import { uploadConfig, handleMulterError } from '../config/upload.config';
import { validateAudioFile } from '../services/audioValidator';
import { TempManager } from '../services/tempManager';
import { createError } from '../middleware/errorHandler';

// Initialize services
const redis = createRedisClient();
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// Redis size limit (30 MB)
const REDIS_SIZE_LIMIT = 30 * 1024 * 1024;

export const UploadController = {
    // Use robust Multer config
    uploadMiddleware: [uploadConfig.single('file'), handleMulterError],

    /**
     * Producer: Upload file and enqueue for background processing
     */
    async uploadToRedis(req: Request, res: Response) {
        const filePath = req.file?.path;

        try {
            // 1. Basic validation
            if (!req.file || !filePath) {
                throw createError('No file uploaded', 400, 'NO_FILE');
            }

            const { recordingId, userId, organizationId } = req.body;

            if (!recordingId || !userId) {
                throw createError('Missing required fields: recordingId, userId', 400, 'MISSING_FIELDS');
            }

            console.log(`[Producer] Processing upload for ${recordingId} (${req.file.size} bytes)`);

            // 2. Audio Validation (FFprobe)
            const validation = await validateAudioFile(filePath);

            if (!validation.valid) {
                throw createError(
                    `Invalid audio file: ${validation.error}`,
                    400,
                    'INVALID_AUDIO'
                );
            }

            // 3. Determine storage strategy
            const fileSize = req.file.size;
            const useRedis = fileSize < REDIS_SIZE_LIMIT;
            let storageKey: string;

            console.log(`[Producer] Strategy: ${useRedis ? 'Redis (fast)' : 'Gemini File API (large)'}`);

            if (useRedis) {
                // === REDIS PATH (Fast for small files) ===
                const fileKey = `file:${recordingId}`;
                const fileBuffer = fs.readFileSync(filePath);

                await redis.set(fileKey, fileBuffer);
                await redis.expire(fileKey, 86400); // 24 hours TTL

                storageKey = fileKey;

                // Cleanup local file immediately
                await TempManager.safeDelete(filePath);
            } else {
                // === GEMINI FILE API PATH (For large files) ===
                const uploadResult = await fileManager.uploadFile(filePath, {
                    mimeType: req.file.mimetype,
                    displayName: `recording-${recordingId}`
                });

                storageKey = uploadResult.file.uri;

                // Keep local file for worker fallback if needed, or rely on TempManager cleanup
            }

            // 4. Create DB Record
            await prisma.recording.create({
                data: {
                    id: recordingId,
                    userId,
                    organizationId,
                    duration: validation.duration || 0,
                    status: 'PROCESSING',
                    audioKey: storageKey,
                    analysis: {
                        title: 'Procesando audio...',
                        category: 'En cola',
                        summary: ['Tu grabación está siendo analizada por nuestra IA.'],
                        actionItems: [],
                        transcript: [],
                        tags: []
                    }
                }
            });

            // 5. Enqueue Job
            const job = await audioQueue.add('process-audio', {
                [useRedis ? 'fileKey' : 'fileUri']: storageKey,
                filePath: useRedis ? null : filePath, // Pass path for large files
                recordingId,
                userId,
                organizationId,
                mimeType: req.file.mimetype,
                useRedis,
                duration: validation.duration
            }, {
                attempts: 3,
                removeOnComplete: true,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            });

            // 6. Update Status Cache
            await redis.hset(`status:${recordingId}`, {
                status: 'QUEUED',
                progress: '0',
                jobId: job.id,
                timestamp: Date.now()
            });
            await redis.expire(`status:${recordingId}`, 86400);

            // 7. Respond
            res.status(202).json({
                success: true,
                message: 'File queued for processing',
                recordingId,
                jobId: job.id,
                status: 'QUEUED',
                duration: validation.duration
            });

        } catch (error: any) {
            // Cleanup on error
            if (filePath) {
                await TempManager.safeDelete(filePath);
            }
            throw error; // Handled by global error middleware
        }
    },

    /**
     * Polling endpoint: Get processing status
     */
    async getStatus(req: Request, res: Response) {
        const { recordingId } = req.params;

        // Try Redis first (fast path)
        const redisStatus = await redis.hgetall(`status:${recordingId}`);

        if (redisStatus && Object.keys(redisStatus).length > 0) {
            // Parse nested JSON if needed
            if (redisStatus.analysis && typeof redisStatus.analysis === 'string') {
                try {
                    redisStatus.analysis = JSON.parse(redisStatus.analysis);
                } catch (e) { }
            }
            return res.json(redisStatus);
        }

        // Fallback to DB (slow path)
        const recording = await prisma.recording.findUnique({
            where: { id: recordingId }
        });

        if (!recording) {
            // Return 200 with status not_found to avoid CORS issues on error responses
            // and prevent frontend console errors during polling
            return res.status(200).json({ status: 'not_found' });
        }

        res.json({
            status: recording.status,
            analysis: recording.analysis
        });
    }
};
