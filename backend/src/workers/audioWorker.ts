import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import https from 'https';
import dotenv from 'dotenv';
import { AudioJobData } from '../services/queue';

dotenv.config();

// --- CONFIGURACIÓN ---
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- UTILIDADES ---

// Descargar archivo como buffer
async function downloadFileToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        https.get(url, (response) => {
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

// Procesar con IA usando audio inline
async function processAudioWithAI(signedUrl: string, jobId: string): Promise<any> {
    try {
        console.log(`[AI Engine] Downloading audio from ${signedUrl}...`);
        const audioBuffer = await downloadFileToBuffer(signedUrl);
        const audioBase64 = audioBuffer.toString('base64');

        console.log(`[AI Engine] Audio downloaded (${audioBuffer.length} bytes). Processing with Gemini...`);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

REGLAS:
- La transcripción debe ser COMPLETA, no un resumen
- Identifica diferentes hablantes si es posible (Hablante 1, Hablante 2, etc.)
- Incluye timestamps aproximados en formato MM:SS
- Si el audio es muy largo, divide en segmentos lógicos pero NO omitas contenido
        `;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "audio/webm",
                    data: audioBase64
                }
            },
            { text: prompt }
        ]);

        const responseText = result.response.text();

        // Limpiar JSON
        const jsonString = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(jsonString);

        return analysis;

    } catch (error) {
        console.error('[AI Engine] Error processing audio:', error);
        throw error;
    }
}

// --- WORKER ---
// --- WORKER ---
const worker = new Worker('audio-processing-queue', async (job: Job) => {
    const { recordingId, fileKey, mimeType } = job.data;
    console.log(`[Worker] Processing job ${job.id} for recording ${recordingId}`);

    try {
        // Update status in Redis
        await connection.hset(`status:${recordingId}`, 'status', 'PROCESSING');

        // 1. Get file from Redis
        console.log(`[Worker] Fetching file from Redis key: ${fileKey}`);
        const fileBuffer = await connection.getBuffer(fileKey);

        if (!fileBuffer) {
            throw new Error('File not found in Redis (expired or missing)');
        }

        console.log(`[Worker] File retrieved (${fileBuffer.length} bytes). Processing with Gemini...`);

        // 2. Process with Gemini - Using Gemini 2.0 Flash (Experimental)
        const audioBase64 = fileBuffer.toString('base64');
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
                inlineData: {
                    mimeType: mimeType || "audio/webm",
                    data: audioBase64
                }
            },
            { text: prompt }
        ]);

        const responseText = result.response.text();
        console.log(`[Worker] Gemini raw response: ${responseText.substring(0, 200)}...`);

        // Robust JSON cleanup
        let jsonString = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Find the first '{' and last '}' to extract just the JSON object if there's extra text
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

        // 3. Save result to Redis status
        await connection.hset(`status:${recordingId}`, {
            status: 'COMPLETED',
            analysis: jsonString
        });

        // 4. Update recording in Redis database
        const { redisDb } = await import('../services/redisDb');
        await redisDb.updateRecordingAnalysis(recordingId, analysis, 'COMPLETED');

        // --- CACHE MODE: AGGRESSIVE CLEANUP ---
        // Delete audio file immediately to save space (Free Tier support)
        console.log(`[Worker] Cache Mode: Deleting file ${fileKey} to free up Redis space...`);
        await connection.del(fileKey);

        // Also set a short TTL for the status key just in case
        await connection.expire(`status:${recordingId}`, 3600); // 1 hour retention for status

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
