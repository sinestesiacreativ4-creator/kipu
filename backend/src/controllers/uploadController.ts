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
        fileSize: 60 * 1024 * 1024, // 60MB limit (approx 1 hour at 128kbps)
    }
});

// Initialize Gemini File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export const UploadController = {
    // Middleware for handling file upload
    uploadMiddleware: upload.single('file'),

    /**
     * Upload file to Gemini File API and queue for processing
     * Supports files up to 2GB (vs 30MB Redis limit)
     */
    async uploadToRedis(req: Request, res: Response) {
        let tempFilePath: string | null = null;

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { recordingId, userId, organizationId } = req.body;

            console.log(`[API] Received file upload for recording ${recordingId} (${req.file.size} bytes)`);

            // 1. Write buffer to temporary file (Gemini requires file path)
            const tempDir = os.tmpdir();
            const ext = path.extname(req.file.originalname) || '.webm';
            tempFilePath = path.join(tempDir, `${recordingId}${ext}`);

            fs.writeFileSync(tempFilePath, req.file.buffer);
            console.log(`[API] Temp file created: ${tempFilePath}`);

            // 2. Upload to Gemini File API
            console.log(`[API] Uploading to Gemini...`);
            const uploadResult = await fileManager.uploadFile(tempFilePath, {
                mimeType: req.file.mimetype,
                displayName: req.file.originalname
            });

            const fileUri = uploadResult.file.uri;
            console.log(`[API] File uploaded to Gemini: ${fileUri}`);

            // 3. Delete temp file
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;

            // 4. Create recording entry in PostgreSQL via Prisma
            try {
                await prisma.recording.create({
                    data: {
                        id: recordingId,
                        userId,
                        organizationId,
                        duration: 0,
                        status: 'PROCESSING',
                        audioKey: fileUri, // Store Gemini URI instead of Redis key
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

            // 5. Queue job with Gemini URI
            const job = await audioQueue.add('process-audio-redis', {
                fileUri, // Pass URI instead of Redis key
                recordingId,
                userId,
                organizationId,
                mimeType: req.file.mimetype
            }, {
                attempts: 3,
                removeOnComplete: true
            });

            console.log(`[API] Job ${job.id} queued`);

            // 6. Initialize status in Redis (for polling)
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
