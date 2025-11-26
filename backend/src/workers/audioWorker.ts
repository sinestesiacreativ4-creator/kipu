import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import prisma from '../services/prisma';
import express from 'express';

dotenv.config();

// Dummy server for Render Web Service detection (only if running standalone)
if (require.main === module) {
    const app = express();
    const port = 10001; // Use a different port to avoid conflict with main API (10000)

    app.get('/', (req, res) => {
        res.send('Audio Worker is running');
    });

    app.listen(port, () => {
        console.log(`Worker health check server listening on port ${port}`);
    });
}

// --- CONFIGURACIÓN ---
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisOptions: any = {
    maxRetriesPerRequest: null,
};

if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false
    };
}

const connection = new IORedis(redisUrl, redisOptions);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- WORKER ---
const worker = new Worker('audio-processing-queue', async (job: Job) => {
    const { recordingId, fileUri, mimeType } = job.data;
    console.log(`[Worker] Processing job ${job.id} for recording ${recordingId}`);

    try {
        // Update status in Redis
        await connection.hset(`status:${recordingId}`, 'status', 'PROCESSING');

        console.log(`[Worker] Using Gemini File URI: ${fileUri}`);

        // Process with Gemini 2.0 Flash using file URI (no Buffer needed)
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
            {
                fileData: {
                    mimeType: mimeType || "audio/webm",
                    fileUri: fileUri
                }
            },
            { text: prompt }
        ]);

        const responseText = result.response.text();
        console.log(`[Worker] Gemini raw response: ${responseText.substring(0, 200)}...`);

        // Robust JSON cleanup
        let jsonString = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        // Validate JSON
        let analysis;
        try {
            analysis = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('[Worker] JSON Parse Error:', parseError);
            console.error('[Worker] Failed JSON string:', jsonString);
            throw new Error('Failed to parse AI response as JSON');
        }

        // 3. Save result to Redis status (for polling)
        await connection.hset(`status:${recordingId}`, {
            status: 'COMPLETED',
            analysis: jsonString
        });

        // 4. Update recording in PostgreSQL via Prisma
        try {
            await prisma.recording.update({
                where: { id: recordingId },
                data: {
                    analysis: analysis,
                    status: 'COMPLETED'
                }
            });
            console.log(`[Worker] Recording updated in DB: ${recordingId}`);
        } catch (dbError) {
            console.error('[Worker] Error updating recording in DB:', dbError);
        }

        // Note: Gemini File API automatically deletes files after processing
        // No need to manually clean up like we did with Redis

        console.log(`[Worker] Job ${job.id} completed successfully`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Worker] Job ${job.id} failed:`, error);

        await connection.hset(`status:${recordingId}`, {
            status: 'ERROR',
            error: error.message
        });

        throw error;
    }
}, { connection });

console.log('[Worker] Audio Processing Worker Started (Powered by Gemini 1.5)...');

// Event listeners para debug
worker.on('ready', () => {
    console.log('[Worker] Worker is ready and waiting for jobs');
});

worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} is now active`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
});

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
});

connection.on('connect', () => {
    console.log('[Worker] Redis connection established');
});

connection.on('error', (err) => {
    console.error('[Worker] Redis connection error:', err);
});
