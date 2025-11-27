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
 * Analyze a single audio chunk
 */
async function analyzeChunk(chunkPath: string, index: number, total: number): Promise<any> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const fileBuffer = fs.readFileSync(chunkPath);
    const audioBase64 = fileBuffer.toString('base64');

    const prompt = `
    Analiza este SEGMENTO ${index + 1} de ${total} de una grabación.
    
    Genera un JSON con:
    {
      "summary": ["Puntos clave de este segmento"],
      "transcript": [
        {"speaker": "Hablante", "text": "Texto", "timestamp": "MM:SS (relativo al segmento)"}
      ]
    }
    `;

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: "audio/webm", // Assuming webm/opus from frontend
                data: audioBase64
            }
        },
        { text: prompt }
    ]);

    const text = result.response.text();
    const jsonString = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonString);
}

/**
 * Merge analysis results
 */
function mergeAnalyses(results: any[]): any {
    const merged = {
        title: "Grabación Procesada",
        category: "General",
        tags: [] as string[],
        summary: [] as string[],
        actionItems: [] as string[],
        transcript: [] as any[]
    };

    results.forEach((res, index) => {
        if (res.summary) merged.summary.push(...res.summary);
        if (res.transcript) {
            // Adjust timestamps would be complex, simply appending for now
            const adjustedTranscript = res.transcript.map((t: any) => ({
                ...t,
                text: `[Parte ${index + 1}] ${t.text}`
            }));
            merged.transcript.push(...adjustedTranscript);
        }
    });

    return merged;
}

// --- WORKER ---
const worker = new Worker('audio-processing-queue', async (job: Job) => {
    const { recordingId, fileKey, fileUri, mimeType, useRedis } = job.data;
    console.log(`[Worker] Processing job ${job.id} for recording ${recordingId}`);

    const tempDir = os.tmpdir();
    const ext = mimeType?.includes('mp4') ? '.mp4' : '.webm'; // Simple extension detection
    const tempFilePath = path.join(tempDir, `${recordingId}${ext}`);

    try {
        // Update status
        await connection.hset(`status:${recordingId}`, 'status', 'PROCESSING');

        // 1. Retrieve File to Temp
        if (useRedis) {
            console.log(`[Worker] Fetching from Redis...`);
            const fileBuffer = await connection.getBuffer(fileKey);
            if (!fileBuffer) throw new Error('File not found in Redis');
            fs.writeFileSync(tempFilePath, fileBuffer);
        } else {
            console.log(`[Worker] Downloading from Gemini URI not supported for chunking yet. Assuming direct upload or implementing download logic here.`);
            // NOTE: For Gemini File API, we can't easily download back. 
            // Ideally, the producer should have saved to S3 or similar if it's large.
            // For now, assuming we might skip chunking for Gemini-hosted files OR 
            // we need to change Producer to save to disk/S3 first.
            // FALLBACK: If it's a Gemini URI, we try to process it as a whole (legacy mode)
            // or throw error if we strictly want chunking.

            // For this refactor, let's assume we ONLY support Redis-uploaded files for chunking 
            // OR we implement a way to get the file. 
            // Since the user asked to refactor the Consumer, and the Producer puts large files in Gemini...
            // We actually have a problem: Gemini File API doesn't allow downloading the file content back easily via API for processing with ffmpeg.
            // FIX: We will assume for this step that we are handling files that we HAVE access to.
            // If the file is already in Gemini, we can't chunk it with ffmpeg locally unless we have the bytes.

            throw new Error("Chunking requires file access. Gemini File API storage does not support direct download for chunking.");
        }

        // 2. Split Audio
        console.log(`[Worker] Splitting audio file: ${tempFilePath}`);
        const chunks = await splitAudio(tempFilePath);
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

                    // Rate limiting delay between successful chunks (10 seconds)
                    if (i < chunks.length - 1) {
                        console.log('[Worker] Waiting 10s to respect rate limits...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    }

                } catch (err: any) {
                    if (err.message && err.message.includes('429') && retries < maxRetries) {
                        retries++;
                        const delay = Math.pow(2, retries) * 5000 + Math.random() * 1000; // Exponential backoff: 5s, 10s, 20s...
                        console.warn(`[Worker] 429 Too Many Requests. Retrying chunk ${i + 1} in ${Math.round(delay / 1000)}s (Attempt ${retries}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        console.error(`[Worker] Error processing chunk ${i + 1}:`, err);
                        // If it's not a 429 or we ran out of retries, we skip this chunk but continue with others
                        // to try to salvage partial results.
                        break;
                    }
                }
            }
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
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        chunks.forEach(c => {
            if (fs.existsSync(c)) fs.unlinkSync(c);
        });

        if (useRedis) {
            await connection.del(fileKey);
        }

        console.log(`[Worker] Job ${job.id} completed`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Worker] Job ${job.id} failed:`, error);
        await connection.hset(`status:${recordingId}`, { status: 'ERROR', error: error.message } as any);

        // Cleanup
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

        throw error;
    }
}, { connection });

console.log('[Worker] Audio Processing Worker Started (Chunking Enabled)...');

// Event listeners
worker.on('ready', () => console.log('[Worker] Ready'));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));
