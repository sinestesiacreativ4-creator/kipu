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
    }) ();

// Race between processing and timeout
return Promise.race([processingPromise, timeoutPromise]);
}, { connection });

console.log('[Worker] Audio Processing Worker Started (Chunking Enabled)...');

// Event listeners
worker.on('ready', () => console.log('[Worker] Ready'));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err.message));

export default worker;
