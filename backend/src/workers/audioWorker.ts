import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import prisma from '../services/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { promisify } from 'util';
import { pipeline } from 'stream';

dotenv.config();

// Configure ffmpeg
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// Health check server disabled - Worker runs in same process as API
console.log('[Worker] Running in hybrid mode (same process as API)');

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
const streamPipeline = promisify(pipeline);

// --- HELPER FUNCTIONS ---

/**
 * Split audio file into chunks
 */
async function splitAudio(filePath: string, chunkDurationSec: number = 120): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const outputPattern = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}_part%03d${path.extname(filePath)}`);

        ffmpeg(filePath)
            .outputOptions([
                `-f segment`,
                `-segment_time ${chunkDurationSec}`,
                `-c copy` // Fast copy without re-encoding
            ])
            .output(outputPattern)
            .on('end', () => {
                // Find generated files
                const dir = path.dirname(filePath);
                const baseName = path.basename(filePath, path.extname(filePath));
                const files = fs.readdirSync(dir)
                    .filter(f => f.startsWith(`${baseName}_part`) && f.endsWith(path.extname(filePath)))
                    .map(f => path.join(dir, f))
                    .sort();
                resolve(files);
            })
            .on('error', (err) => reject(err))
            .run();
    });
}

/**
 * Extract JSON from Gemini response with robust error handling
 */
function extractJSON(text: string): any {
    // Strategy 1: Try to find JSON code block
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch (e) {
            console.warn('[Worker] Failed to parse JSON code block');
        }
    }

    // Strategy 2: Try to find JSON object directly
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.warn('[Worker] Failed to parse JSON object');
        }
    }

    // Strategy 3: Clean and parse entire text
    try {
        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^[^{]*/, '') // Remove text before first {
            .replace(/[^}]*$/, '') // Remove text after last }
            .trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('[Worker] All JSON extraction strategies failed');
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
    }
}

/**
 * Validate and normalize analysis structure
 */
function validateAnalysis(data: any): any {
    return {
        summary: Array.isArray(data.summary) ? data.summary : [],
        decisions: Array.isArray(data.decisions) ? data.decisions : [],
        actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
        participants: Array.isArray(data.participants) ? data.participants : [],
        keyTopics: Array.isArray(data.keyTopics) ? data.keyTopics : [],
        transcript: Array.isArray(data.transcript) ? data.transcript : []
    };
}

/**
 * Analyze a single audio chunk with robust error handling
 */
async function analyzeChunk(chunkPath: string, index: number, total: number): Promise<any> {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // Stable model with better free tier quotas
        generationConfig: {
            responseMimeType: "application/json" // Force JSON response
        }
    });

    const fileBuffer = fs.readFileSync(chunkPath);
    const audioBase64 = fileBuffer.toString('base64');

    const prompt = `
    Analiza este SEGMENTO ${index + 1} de ${total} de una grabación de audio.
    
    CRÍTICO: Responde SOLO con JSON válido, sin texto adicional.
    
    Formato requerido:
    {
      "summary": ["Punto clave 1", "Punto clave 2"],
      "decisions": ["Decisión tomada 1"],
      "actionItems": ["Tarea pendiente 1 (Responsable)"],
      "participants": ["Nombre 1"],
      "keyTopics": ["Tema 1"],
      "transcript": [
        {"speaker": "Hablante", "text": "Texto", "timestamp": "MM:SS"}
      ]
    }
    
    IMPORTANTE:
    - Los "decisions" son acuerdos o resoluciones concretas
    - Los "actionItems" deben incluir responsable entre paréntesis si se menciona
    - Los "participants" son personas mencionadas o identificables por voz
    - Los "keyTopics": temas específicos discutidos (ej: "Presupuesto Q1", no "Finanzas")
    `;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "audio/webm",
                    data: audioBase64
                }
            },
            { text: prompt }
        ]);

        const text = result.response.text();
        console.log(`[Worker] Gemini response for chunk ${index + 1} (first 200 chars):`, text.substring(0, 200));

        const parsedData = extractJSON(text);
        const validatedData = validateAnalysis(parsedData);

        return validatedData;
    } catch (error: any) {
        console.error(`[Worker] Error analyzing chunk ${index + 1}:`, error.message);
        // Return minimal valid structure instead of failing completely
        return {
            summary: [`Error procesando segmento ${index + 1}: ${error.message}`],
            decisions: [],
            actionItems: [],
            participants: [],
            keyTopics: [],
            transcript: []
        };
    }
}

/**
 * Merge analysis results and generate intelligent summary
 */
function mergeAnalyses(results: any[]): any {
    const merged = {
        title: "",
        category: "General",
        tags: [] as string[],
        summary: [] as string[],
        decisions: [] as string[],
        actionItems: [] as string[],
        participants: [] as string[],
        keyTopics: [] as string[],
        executiveSummary: "",
        transcript: [] as any[]
    };

    // Consolidate all fields from chunks
    results.forEach((res, index) => {
        if (res.summary) merged.summary.push(...res.summary);
        if (res.decisions) merged.decisions.push(...res.decisions);
        if (res.actionItems) merged.actionItems.push(...res.actionItems);
        if (res.participants) merged.participants.push(...res.participants);
        if (res.keyTopics) merged.keyTopics.push(...res.keyTopics);

        if (res.transcript) {
            merged.transcript.push(...res.transcript.map((t: any) => ({
                ...t,
                segment: index + 1
            })));
        }
    });

    // Deduplicate arrays
    merged.participants = [...new Set(merged.participants)];
    merged.keyTopics = [...new Set(merged.keyTopics)];
    merged.tags = merged.keyTopics.slice(0, 5); // Use top 5 topics as tags

    // Generate intelligent title
    if (merged.keyTopics.length > 0) {
        const mainTopic = merged.keyTopics[0];
        const category = merged.decisions.length > 0 ? "Reunión de Decisiones" :
            merged.actionItems.length > 0 ? "Reunión de Trabajo" : "Grabación";
        merged.title = `${category}: ${mainTopic}`;
        merged.category = category;
    } else {
        merged.title = "Grabación Procesada";
    }

    // Generate executive summary (first 3 most important points)
    const topPoints = merged.summary.slice(0, 3);
    merged.executiveSummary = topPoints.join(". ") + ".";

    return merged;
}

// --- WORKER ---
const PROCESSING_TIMEOUT = 15 * 60 * 1000; // 15 minutes max

const worker = new Worker('audio-processing-queue', async (job: Job) => {
    const { recordingId, fileKey, fileUri, mimeType, useRedis, filePath } = job.data;
    console.log(`[Worker] Processing job ${job.id} for recording ${recordingId}`);

    const tempDir = os.tmpdir();
    const ext = mimeType?.includes('mp4') ? '.mp4' : '.webm';
    // Default temp path if we need to write from Redis
    const defaultTempPath = path.join(tempDir, `${recordingId}${ext}`);
    let sourceFilePath = defaultTempPath;

    let chunks: string[] = [];

    // Wrap entire process in a timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout exceeded (15 minutes)')), PROCESSING_TIMEOUT);
    });

    const processingPromise = (async () => {
        try {
            // Update status
            await connection.hset(`status:${recordingId}`, 'status', 'PROCESSING');

            // 1. Retrieve File to Temp
            if (filePath && fs.existsSync(filePath)) {
                console.log(`[Worker] Using local file directly: ${filePath}`);
                sourceFilePath = filePath;
            } else if (useRedis) {
                console.log(`[Worker] Fetching from Redis...`);
                const fileBuffer = await connection.getBuffer(fileKey);
                if (!fileBuffer) throw new Error('File not found in Redis');
                fs.writeFileSync(sourceFilePath, fileBuffer);
            } else {
                console.log(`[Worker] Downloading from Gemini URI not supported for chunking yet.`);
                throw new Error("Chunking requires file access. Gemini File API storage does not support direct download for chunking.");
            }

            // 2. Split Audio
            console.log(`[Worker] Splitting audio file: ${sourceFilePath}`);
            chunks = await splitAudio(sourceFilePath);
            console.log(`[Worker] Created ${chunks.length} chunks`);

            // 3. Process Chunks
            const results = [];
            for (let i = 0; i < chunks.length; i++) {
                console.log(`[Worker] Processing chunk ${i + 1}/${chunks.length}`);
                // Update progress
                await connection.hset(`status:${recordingId}`, 'progress', Math.round(((i) / chunks.length) * 100).toString());

                // Retry logic for 429 errors
                let retries = 0;
                const maxRetries = 3;
                let success = false;

                while (!success && retries <= maxRetries) {
                    try {
                        const result = await analyzeChunk(chunks[i], i, chunks.length);
                        results.push(result);
                        success = true;

                        // Rate limiting delay between successful chunks (5 seconds)
                        if (i < chunks.length - 1) {
                            console.log('[Worker] Waiting 5s to respect rate limits...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }

                    } catch (err: any) {
                        if (err.message && err.message.includes('429') && retries < maxRetries) {
                            retries++;
                            const delay = Math.pow(2, retries) * 5000 + Math.random() * 1000;
                            console.warn(`[Worker] 429 Too Many Requests. Retrying chunk ${i + 1} in ${Math.round(delay / 1000)}s (Attempt ${retries}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
                            console.error(`[Worker] Error processing chunk ${i + 1}:`, err.message);
                            // Continue with other chunks to salvage partial results
                            break;
                        }
                    }
                }
            }

            if (results.length === 0) {
                throw new Error('All chunks failed to process');
            }

            // 4. Merge Results
            const finalAnalysis = mergeAnalyses(results);

            // 5. Save & Cleanup
            await connection.hset(`status:${recordingId}`, {
                status: 'COMPLETED',
                analysis: JSON.stringify(finalAnalysis)
            } as any);

            await prisma.recording.update({
                where: { id: recordingId },
                data: {
                    analysis: finalAnalysis,
                    status: 'COMPLETED'
                }
            });

            // Cleanup temp files
            if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);
            chunks.forEach(c => {
                if (fs.existsSync(c)) fs.unlinkSync(c);
            });

            if (useRedis) {
                await connection.del(fileKey);
            }

            console.log(`[Worker] Job ${job.id} completed successfully`);
            return { success: true };

        } catch (error: any) {
            console.error(`[Worker] Job ${job.id} failed:`, error.message);

            // Mark as ERROR in both Redis and DB
            await connection.hset(`status:${recordingId}`, {
                status: 'ERROR',
                error: error.message
            } as any);

            await prisma.recording.update({
                where: { id: recordingId },
                data: { status: 'ERROR' }
            });

            // Cleanup temp files even on error
            if (fs.existsSync(sourceFilePath)) {
                try { fs.unlinkSync(sourceFilePath); } catch { }
            }
            chunks.forEach(c => {
                if (fs.existsSync(c)) {
                    try { fs.unlinkSync(c); } catch { }
                }
            });

            throw error;
        }
    })();

    // Race between processing and timeout
    return Promise.race([processingPromise, timeoutPromise]);
}, { connection });

console.log('[Worker] Audio Processing Worker Started (Chunking Enabled)...');

// Event listeners
worker.on('ready', () => console.log('[Worker] Ready'));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));

export default worker;
