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

// Redis connection
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

// Configure Multer with Disk Storage (Prevents RAM overflow)
const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 524288000, // 500 MB limit
    }
});

// Initialize Gemini File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// Redis size limit (30 MB) - Files larger than this go to Gemini
const REDIS_SIZE_LIMIT = 30 * 1024 * 1024;

export const UploadController = {
    uploadMiddleware: upload.single('file'),

    /**
     * Producer: Upload file and enqueue for background processing
     * Returns 202 Accepted immediately
     */
    async uploadToRedis(req: Request, res: Response) {
        // We track the file path to ensure cleanup happens
        const filePath = req.file?.path;

        try {
            if (!req.file || !filePath) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { recordingId, userId, organizationId } = req.body;
            const fileSize = req.file.size;
            const useRedis = fileSize < REDIS_SIZE_LIMIT;

            console.log(`[Producer] Received file for recording ${recordingId} (${fileSize} bytes)`);
            console.log(`[Producer] Strategy: ${useRedis ? 'Redis (fast)' : 'Gemini File API (large)'}`);
        });

        console.log(`[Producer] Job ${job.id} enqueued for recording ${recordingId}`);

        // Initialize status in Redis (for polling)
        await redis.hset(`status:${recordingId}`, {
            status: 'QUEUED',
            progress: '0',
            jobId: job.id
        });
        await redis.expire(`status:${recordingId}`, 86400); // 24 hours TTL

        // Respond immediately with 202 Accepted
        res.status(202).json({
            success: true,
            message: 'File uploaded and queued for processing',
            recordingId,
            jobId: job.id,
            status: 'QUEUED'
        });

    } catch(error: any) {
        console.error('[Producer] Error in uploadToRedis:', error);

        // Cleanup on error
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch { }
        }

        res.status(500).json({ error: error.message });
    }
},

    /**
     * Polling endpoint: Get processing status
     */
    async getStatus(req: Request, res: Response) {
        try {
            const { recordingId } = req.params;

            // Try to get from Redis first (real-time status)
            const redisStatus = await redis.hgetall(`status:${recordingId}`);

            if (redisStatus && Object.keys(redisStatus).length > 0) {
                // Parse analysis if it exists
                if (redisStatus.analysis) {
                    try {
                        redisStatus.analysis = JSON.parse(redisStatus.analysis);
                    } catch (e) {
                        // keep as string if parse fails
                    }
                }

                return res.json(redisStatus);
            }

            // Fallback to database
            const recording = await prisma.recording.findUnique({
                where: { id: recordingId }
            });

            if (!recording) {
                return res.status(404).json({ error: 'Recording not found' });
            }

            res.json({
                status: recording.status,
                analysis: recording.analysis
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
};
