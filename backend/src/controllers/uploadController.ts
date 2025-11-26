import { Request, Response } from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import IORedis from 'ioredis';
import prisma from '../services/prisma';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Configure Multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 524288000, // 500 MB limit
    }
});

// Initialize Gemini
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Redis size limit (30 MB)
const REDIS_SIZE_LIMIT = 30 * 1024 * 1024;

export const UploadController = {
    uploadMiddleware: upload.single('file'),

    /**
     * Upload and process immediately (no worker queue)
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

            // Create recording in DB (status: PROCESSING)
            await prisma.recording.create({
                data: {
                    id: recordingId,
                    userId,
                    organizationId,
                    duration: 0,
                    status: 'PROCESSING',
                    audioKey: '',
                    analysis: {
                        title: 'Procesando...',
                        category: 'Procesando',
                        summary: ['Analizando audio...'],
                        actionItems: [],
                        transcript: [],
                        tags: []
                    }
                }
            });

            // Process immediately in background (don't block response)
            processAudioImmediate(
                req.file.buffer,
                req.file.mimetype,
                req.file.originalname,
                recordingId,
                useRedis
            ).catch(error => {
                console.error('[API] Background processing error:', error);
            });

            res.json({
                success: true,
                message: 'File uploaded and processing started',
                recordingId
            });

        } catch (error: any) {
            console.error('[API] Error in uploadToRedis:', error);

            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            res.status(500).json({ error: error.message });
        }
    },

    async getStatus(req: Request, res: Response) {
        try {
            const { recordingId } = req.params;
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

/**
 * Process audio immediately (runs in background)
 */
async function processAudioImmediate(
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string,
    recordingId: string,
    useRedis: boolean
) {
    let tempFilePath: string | null = null;

    try {
        let audioData: any;

        if (useRedis) {
            // Redis path (small files)
            console.log(`[Processing] Using Redis cache for ${recordingId}`);
            const audioBase64 = fileBuffer.toString('base64');
            audioData = {
                inlineData: {
                    mimeType: mimeType || "audio/webm",
                    data: audioBase64
                }
            };
        } else {
            // Gemini File API (large files)
            console.log(`[Processing] Uploading to Gemini for ${recordingId}`);
            const tempDir = os.tmpdir();
            const ext = path.extname(originalName) || '.webm';
            tempFilePath = path.join(tempDir, `${recordingId}${ext}`);

            fs.writeFileSync(tempFilePath, fileBuffer);

            const uploadResult = await fileManager.uploadFile(tempFilePath, {
                mimeType,
                displayName: originalName
            });

            audioData = {
                fileData: {
                    mimeType: mimeType || "audio/webm",
                    fileUri: uploadResult.file.uri
                }
            };

            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }

        // Process with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const prompt = `
Actúa como un asistente experto en transcripción y documentación. Analiza esta grabación completa.

IMPORTANTE: Genera una transcripción COMPLETA del audio con timestamps aproximados.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título descriptivo de la reunión",
  "category": "Categoría principal (ej: Reunión, Entrevista, Clase, etc.)",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
  "actionItems": ["Tarea 1", "Tarea 2"],
  "transcript": [
    {"speaker": "Hablante 1", "text": "Texto transcrito aquí", "timestamp": "00:00"},
    {"speaker": "Hablante 2", "text": "Respuesta aquí", "timestamp": "00:15"}
  ]
}
        `;

        const result = await model.generateContent([
            audioData,
            { text: prompt }
        ]);

        const responseText = result.response.text();

        // Parse JSON
        let jsonString = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        const analysis = JSON.parse(jsonString);

        // Update recording in DB
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                analysis,
                status: 'COMPLETED'
            }
        });

        console.log(`[Processing] Completed for ${recordingId}`);

    } catch (error: any) {
        console.error(`[Processing] Error for ${recordingId}:`, error);

        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                status: 'ERROR',
                analysis: {
                    title: 'Error en el procesamiento',
                    category: 'Error',
                    summary: [error.message],
                    actionItems: [],
                    transcript: [],
                    tags: []
                }
            }
        });
    }
}
