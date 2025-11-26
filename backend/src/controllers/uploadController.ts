import { Request, Response } from 'express';
import { audioQueue } from '../services/queue';
import dotenv from 'dotenv';
import multer from 'multer';
import IORedis from 'ioredis';
import prisma from '../services/prisma';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

dotenv.config();

// Redis connection for file storage (Robust configuration)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisOptions: any = {
    maxRetriesPerRequest: null,
};

if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false
    };
}

const redis = new IORedis(redisUrl, redisOptions);

// Configure Multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 524288000, // 500 MB limit
    }
});

// Initialize Gemini File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// Redis size limit (30 MB)
const REDIS_SIZE_LIMIT = 30 * 1024 * 1024;

export const UploadController = {
    // Middleware for handling file upload
    uploadMiddleware: upload.single('file'),

    /**
     * Hybrid upload strategy:
     * - Files < 30MB → Redis (fast)
     * - Files ≥ 30MB → Gemini File API (no limit)
     */
    async uploadToRedis(req: Request, res: Response) {
        let tempFilePath: string | null = null;

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { recordingId, userId, organizationId } = req.body;
            const fileSize = req.file.size;
            const useRedis = fileSize < REDIS_SIZE_LIMIT;

            console.log(`[API] Received file upload for recording ${recordingId} (${fileSize} bytes)`);
            console.log(`[API] Strategy: ${useRedis ? 'Redis (fast)' : 'Gemini File API (large file)'}`);

            let storageKey: string;

            if (useRedis) {
                // === REDIS PATH (Fast for small files) ===
                const fileKey = `file:${recordingId}`;
                await redis.set(fileKey, req.file.buffer);
                await redis.expire(fileKey, 3600); // 1 hour TTL
                console.log(`[API] File stored in Redis: ${fileKey}`);
                storageKey = fileKey;
            } else {
                // === GEMINI FILE API PATH (For large files) ===
                const tempDir = os.tmpdir();
                const ext = path.extname(req.file.originalname) || '.webm';
                tempFilePath = path.join(tempDir, `${recordingId}${ext}`);

                fs.writeFileSync(tempFilePath, req.file.buffer);
                console.log(`[API] Temp file created: ${tempFilePath}`);

                console.log(`[API] Uploading to Gemini...`);
                const uploadResult = await fileManager.uploadFile(tempFilePath, {
                    mimeType: req.file.mimetype,
                    displayName: req.file.originalname
                });

                storageKey = uploadResult.file.uri;
                console.log(`[API] File uploaded to Gemini: ${storageKey}`);

                // Cleanup temp file
                fs.unlinkSync(tempFilePath);
                tempFilePath = null;
            }

            // Create recording entry in PostgreSQL
            try {
                await prisma.recording.create({
                    data: {
                        id: recordingId,
                        userId,
                        organizationId,
                        duration: 0,
                        status: 'PROCESSING',
                        audioKey: storageKey,
                        analysis: {
                            title: 'Procesando...',
                            category: 'Procesando',
                            summary: ['Subiendo archivo...'],
                            actionItems: [],
                            transcript: [],
                            tags: []
                        }
                    }
                });
            } catch (dbError: any) {
                console.error('[API] Error creating recording in DB:', dbError);
                if (dbError.code === 'P2003') {
                    return res.status(400).json({ error: 'User or Organization not found in database. Please re-login.' });
                }
                throw dbError;
            }

            // Queue job
            const job = await audioQueue.add('process-audio-redis', {
                [useRedis ? 'fileKey' : 'fileUri']: storageKey,
                recordingId,
                userId,
                organizationId,
                mimeType: req.file.mimetype,
                useRedis // Flag to tell worker which method to use
            }, {
                attempts: 3,
                removeOnComplete: true
            });

            console.log(`[API] Job ${job.id} queued`);

            // Initialize status in Redis (for polling)
            await redis.hset(`status:${recordingId}`, {
                status: 'QUEUED',
                progress: '0'
            });
            await redis.expire(`status:${recordingId}`, 86400);

            res.json({
                success: true,
                message: 'File uploaded and queued successfully',
                jobId: job.id
            });

        } catch (error: any) {
            console.error('[API] Error in uploadToRedis:', error);

            // Cleanup temp file if it exists
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

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
