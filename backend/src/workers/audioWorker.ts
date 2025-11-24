import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
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
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// --- UTILIDADES ---

// Descargar archivo a disco temporalmente (necesario para Gemini File API)
async function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

// Procesar con IA Real
async function processAudioWithAI(signedUrl: string, jobId: string): Promise<any> {
    const tempFilePath = path.join(__dirname, `temp_${jobId}.webm`);

    try {
        console.log(`[AI Engine] Downloading audio to ${tempFilePath}...`);
        await downloadFile(signedUrl, tempFilePath);

        console.log(`[AI Engine] Uploading to Gemini File Manager...`);
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: "audio/webm",
            displayName: `Recording ${jobId}`,
        });

        const fileUri = uploadResult.file.uri;
        console.log(`[AI Engine] File uploaded: ${fileUri}`);

        // Esperar a que el archivo esté activo
        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === FileState.PROCESSING) {
            console.log(`[AI Engine] Waiting for file processing...`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state === FileState.FAILED) {
            throw new Error("Gemini File Processing Failed");
        }

        console.log(`[AI Engine] File ready. Generating analysis...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" }); // 1.5 Flash es excelente para long context

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
            { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
            { text: prompt }
        ]);

        const responseText = result.response.text();

        // Limpiar JSON
        const jsonString = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(jsonString);

        // Cleanup (Borrar archivo de Gemini y local)
        /* await fileManager.deleteFile(uploadResult.file.name); */ // Opcional: mantener para caché
        fs.unlink(tempFilePath, () => { });

        return analysis;

    } catch (error) {
        // Asegurar limpieza en caso de error
        if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => { });
        throw error;
    }
}

// --- WORKER ---
const worker = new Worker<AudioJobData>('audio-processing-queue', async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} for recording ${job.data.recordingId}`);

    try {
        await supabase
            .from('recordings')
            .update({ status: 'PROCESSING' })
            .eq('id', job.data.recordingId);

        // Obtener URL firmada de descarga (4 horas de validez)
        const { data: urlData } = await supabase
            .storage
            .from('recordings')
            .createSignedUrl(job.data.filePath, 14400);

        if (!urlData?.signedUrl) throw new Error("Could not generate download URL");

        // PROCESAMIENTO REAL
        const analysisResult = await processAudioWithAI(urlData.signedUrl, job.id!);

        await supabase
            .from('recordings')
            .update({
                status: 'COMPLETED',
                analysis: analysisResult
            })
            .eq('id', job.data.recordingId);

        console.log(`[Worker] Job ${job.id} completed successfully`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Worker] Job ${job.id} failed:`, error);
        await supabase
            .from('recordings')
            .update({ status: 'ERROR' })
            .eq('id', job.data.recordingId);
        throw error;
    }
}, { connection });

console.log('[Worker] Audio Processing Worker Started (Powered by Gemini 1.5)...');
