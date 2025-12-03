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

// Import Circuit Breaker (Module 5)
import { modelCircuitBreaker, executeWithBackoff } from '../services/circuitBreaker';

// Model configuration with fallback priority
const PRIMARY_MODEL = "gemini-2.0-flash";
const FALLBACK_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro"
];
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds
const BACKOFF_MULTIPLIER = 2;

// --- HELPER FUNCTIONS ---

/**
 * Split audio file into chunks
 * Optimized: 45s chunks for better context/token balance
 */
async function splitAudio(filePath: string, chunkDurationSec: number = 45): Promise<string[]> {
    return new Promise((resolve, reject) => {
        try {
            // Create a dedicated temp directory for chunks to avoid path issues
            const baseName = path.basename(filePath, path.extname(filePath));
            const chunkDir = path.join(os.tmpdir(), `${baseName}_chunks`);

            console.log(`[Worker] Creating chunk directory: ${chunkDir}`);

            // Ensure directory exists with proper permissions
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true, mode: 0o755 });
                console.log(`[Worker] Created directory: ${chunkDir}`);
            } else {
                console.log(`[Worker] Directory already exists: ${chunkDir}`);
            }

            // Verify directory is writable
            try {
                fs.accessSync(chunkDir, fs.constants.W_OK);
                console.log(`[Worker] Directory is writable`);
            } catch (e) {
                throw new Error(`Directory not writable: ${chunkDir}`);
            }

            // Simple pattern: chunk_%03d.ext
            const outputPattern = path.join(chunkDir, `chunk_%03d${path.extname(filePath)}`);

            console.log(`[Worker] Splitting to: ${outputPattern} (Duration: ${chunkDurationSec}s)`);

            ffmpeg(filePath)
                .outputOptions([
                    `-f`, `segment`,
                    `-segment_time`, `${chunkDurationSec}`,
                    `-c`, `copy`, // Fast copy without re-encoding
                    `-reset_timestamps`, `1` // Reset timestamps for each segment
                ])
                .output(outputPattern)
                .on('start', (cmd) => {
                    console.log(`[Worker] FFmpeg split command: ${cmd}`);
                })
                .on('end', () => {
                    // Find generated files
                    try {
                        const files = fs.readdirSync(chunkDir)
                            .filter(f => f.startsWith('chunk_') && f.endsWith(path.extname(filePath)))
                            .map(f => path.join(chunkDir, f))
                            .sort();

                        console.log(`[Worker] Split complete. Generated ${files.length} files`);
                        resolve(files);
                    } catch (e) {
                        console.error('[Worker] Error reading chunk directory:', e);
                        reject(e);
                    }
                })
                .on('error', (err) => {
                    console.error('[Worker] ffmpeg split error:', err);
                    reject(err);
                })
                .run();
        } catch (error) {
            console.error('[Worker] Error in splitAudio setup:', error);
            reject(error);
        }
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
        title: data.title || "",
        summary: Array.isArray(data.summary) ? data.summary : [],
        decisions: Array.isArray(data.decisions) ? data.decisions : [],
        actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
        participants: Array.isArray(data.participants) ? data.participants : [],
        keyTopics: Array.isArray(data.keyTopics) ? data.keyTopics : [],
        transcript: Array.isArray(data.transcript) ? data.transcript : [],
        tags: Array.isArray(data.tags) ? data.tags : []
    };
}

/**
 * Execute function with exponential backoff retry for 503/429 errors
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    maxRetries: number = MAX_RETRIES
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if it's a retryable error (503 or 429)
            const is503 = error.message?.includes('503') || error.status === 503;
            const is429 = error.message?.includes('429') || error.status === 429;

            if ((is503 || is429) && attempt < maxRetries) {
                const backoffMs = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
                console.warn(
                    `[Retry] ${operation} failed with ${is503 ? '503' : '429'}. ` +
                    `Retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms`
                );
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }

            // Non-retryable error or max retries reached
            throw error;
        }
    }

    throw lastError;
}

/**
 * Analyze a single audio chunk with robust error handling and model fallback
 */
async function analyzeChunk(
    chunkPath: string,
    index: number,
    total: number,
    fallbackIndex: number = -1
): Promise<any> {
    // Determine which model to use
    const modelName = fallbackIndex === -1 ? PRIMARY_MODEL : FALLBACK_MODELS[fallbackIndex];
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    const fileBuffer = fs.readFileSync(chunkPath);
    const audioBase64 = fileBuffer.toString('base64');

    const prompt = `
    Analiza este SEGMENTO ${index + 1} de ${total} de una grabación de audio.
    
    CRÍTICO: 
    1. Responde SOLO con JSON válido.
    2. IDIOMA DE SALIDA: ESPAÑOL (Siempre).
    
    OBJETIVO: Realizar un análisis EXHAUSTIVO y PROFESIONAL del audio.
    
    Formato JSON requerido:
    {
      "title": "Título profesional y descriptivo (5-10 palabras)",
      "transcript": [
        {"speaker": "Hablante 1", "text": "Texto exacto dicho por el hablante.", "timestamp": "MM:SS"}
      ],
      "summary": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "actionItems": ["Tarea 1 (Responsable)", "Tarea 2 (Responsable)"],
      "participants": ["Nombre 1", "Nombre 2"],
      "keyTopics": ["Tema 1", "Tema 2"],
      "decisions": ["Decisión 1", "Decisión 2"]
    }
    
    INSTRUCCIONES DE CALIDAD:
    1. TRANSCRIPCIÓN: Prioridad MÁXIMA. Debe ser VERBATIM (palabra por palabra). No resumas. Captura todo. Si el audio es ininteligible, indícalo.
    2. RESUMEN: Extrae los puntos más importantes y decisiones clave.
    3. TAREAS: Identifica claramente quién debe hacer qué.
    4. PARTICIPANTES: Identifica nombres si se mencionan.
    5. TEMAS: Categoriza el contenido.
    `;

    // Determine MIME type from file extension
    const ext = path.extname(chunkPath).toLowerCase();
    let mimeType = "audio/webm"; // Default
    if (ext === '.mp4' || ext === '.m4a') mimeType = "audio/mp4";
    else if (ext === '.mp3') mimeType = "audio/mp3";
    else if (ext === '.wav') mimeType = "audio/wav";
    else if (ext === '.ogg') mimeType = "audio/ogg";
    else if (ext === '.aac') mimeType = "audio/aac";

    const executeAnalysis = async () => {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: audioBase64
                }
            },
            { text: prompt }
        ]);

        const text = result.response.text();
        console.log(
            `[Worker] ${modelName} response for chunk ${index + 1} (first 200 chars):`,
            text.substring(0, 200)
        );

        const parsedData = extractJSON(text);
        return validateAnalysis(parsedData);
    };

    try {
        // Try current model with retry
        return await retryWithBackoff(
            executeAnalysis,
            `Chunk ${index + 1}/${total} with ${modelName}`
        );
    } catch (error: any) {
        const errorMsg = error.message || String(error);
        console.error(
            `[Worker] ${modelName} failed for chunk ${index + 1}:`,
            errorMsg
        );

        // Check if we have fallback models to try
        const nextFallbackIndex = fallbackIndex + 1;
        if (nextFallbackIndex < FALLBACK_MODELS.length) {
            const nextModel = FALLBACK_MODELS[nextFallbackIndex];
            console.warn(
                `[Worker] Trying fallback model ${nextModel} (${nextFallbackIndex + 1}/${FALLBACK_MODELS.length}) for chunk ${index + 1}`
            );

            // Check if error is quota-related (429)
            const is429 = errorMsg.includes('429') || error.status === 429;
            if (is429) {
                console.warn(`[Worker] Quota exceeded on ${modelName}, switching to ${nextModel}`);
                // Add a small delay before trying next model to avoid cascading quota issues
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            try {
                return await analyzeChunk(chunkPath, index, total, nextFallbackIndex);
            } catch (fallbackError: any) {
                // Continue to next fallback or graceful degradation
                console.error(
                    `[Worker] Fallback model ${nextModel} also failed for chunk ${index + 1}:`,
                    fallbackError.message || String(fallbackError)
                );
            }
        }

        // All models failed - return graceful degradation
        console.warn(
            `[Worker] All models exhausted for chunk ${index + 1}. Returning graceful degradation.`
        );
        return {
            title: "Error de Procesamiento",
            summary: [
                `Segmento ${index + 1}/${total}: Análisis temporalmente no disponible debido a limitaciones de API. ` +
                `El contenido de audio fue recibido pero no pudo ser procesado completamente. ` +
                `Por favor, intente procesar esta grabación nuevamente más tarde.`
            ],
            decisions: [],
            actionItems: [],
            participants: [],
            keyTopics: ["Procesamiento Parcial - Reintentar"],
            transcript: [],
            tags: ["Error"]
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
        if (res.tags) merged.tags.push(...res.tags);

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
    merged.tags = [...new Set(merged.tags)].slice(0, 5); // Top 5 tags
    merged.decisions = [...new Set(merged.decisions)];
    merged.actionItems = [...new Set(merged.actionItems)];

    // Generate intelligent title
    // Prefer the title from the first chunk that has one, or the longest one
    const titles = results.map(r => r.title).filter(t => t && t.length > 5 && !t.includes("Error"));
    if (titles.length > 0) {
        merged.title = titles[0]; // Use the first valid title
    } else if (merged.tags.length > 0) {
        merged.title = `Grabación: ${merged.tags[0]}`;
    } else {
        merged.title = "Nueva Grabación";
    }

    // Generate executive summary (first 3 most important points)
    const topPoints = merged.summary.slice(0, 3);
    merged.executiveSummary = topPoints.join(". ") + ".";

    return merged;
}

// --- WORKER ---
const PROCESSING_TIMEOUT = 120 * 60 * 1000; // 120 minutes max

const worker = new Worker('audio-processing-queue', async (job: Job) => {
    const { recordingId, fileKey, fileUri, mimeType, useRedis, filePath } = job.data;
    console.log(`[Worker] Processing job ${job.id} for recording ${recordingId}`);

    const tempDir = os.tmpdir();
    let ext = '.webm'; // Default
    if (mimeType) {
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = '.mp4';
        else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = '.mp3';
        else if (mimeType.includes('wav')) ext = '.wav';
        else if (mimeType.includes('ogg')) ext = '.ogg';
        else if (mimeType.includes('aac')) ext = '.aac';
    }
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

            // Log duration for debugging
            try {
                await new Promise<void>((resolve) => {
                    ffmpeg.ffprobe(sourceFilePath, (err, metadata) => {
                        if (!err && metadata && metadata.format && metadata.format.duration) {
                            console.log(`[Worker] Source file duration: ${metadata.format.duration}s`);
                        } else {
                            console.log(`[Worker] Could not probe source duration.`);
                        }
                        resolve();
                    });
                });
            } catch (e) { console.warn('[Worker] Probe failed', e); }

            chunks = await splitAudio(sourceFilePath);
            console.log(`[Worker] Created ${chunks.length} chunks`);

            // 3. Process Chunks in Parallel Batches
            const results: any[] = [];
            const BATCH_SIZE = 3; // Process 3 chunks at a time

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batch = chunks.slice(i, i + BATCH_SIZE);
                console.log(`[Worker] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (Chunks ${i + 1}-${i + batch.length})`);

                // Process batch in parallel
                const batchPromises = batch.map((chunkPath, batchIndex) => {
                    const globalIndex = i + batchIndex;
                    return (async () => {
                        // Add small staggering delay to avoid hitting API exactly at same ms
                        await new Promise(resolve => setTimeout(resolve, batchIndex * 1000));

                        // analyzeChunk now handles all retries and fallback internally
                        return await analyzeChunk(chunkPath, globalIndex, chunks.length);
                    })();
                });

                const batchResults = await Promise.all(batchPromises);

                // Filter out nulls (failed chunks) and add to results
                batchResults.forEach(res => {
                    if (res) results.push(res);
                });

                // Update progress
                const progress = Math.round(((i + batch.length) / chunks.length) * 100);
                await connection.hset(`status:${recordingId}`, 'progress', progress.toString());

                // Rate limiting delay between batches
                if (i + BATCH_SIZE < chunks.length) {
                    console.log('[Worker] Waiting 5s between batches to respect rate limits...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            if (results.length === 0) {
                console.warn('[Worker] All chunks returned degraded results. Proceeding with partial analysis.');
                // Don't throw - let merge handle empty/partial results
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
