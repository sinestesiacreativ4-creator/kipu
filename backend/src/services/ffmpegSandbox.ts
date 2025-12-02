import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Module 3: FFmpeg Sandbox
 * Processes each chunk individually in isolation to prevent cascade failures
 */

export interface ProcessResult {
    success: boolean;
    outputPath?: string;
    error?: string;
    duration?: number;
}

/**
 * Process audio chunk in FFmpeg sandbox with robust re-encoding
 * Converts WebM/MP4 to standardized WAV format
 */
export async function processChunkInSandbox(
    inputPath: string
): Promise<ProcessResult> {
    const startTime = Date.now();
    const outputPath = inputPath.replace(/\.\w+$/, '_processed.wav');

    // Critical FFmpeg flags for robustness:
    // -fflags +genpts: Generate missing presentation timestamps (repairs broken chunks)
    // -ac 1: Mono channel (stable for speech)
    // -ar 16000: 16kHz sample rate (speech-to-text standard)
    // -f wav: Force WAV output (most compatible format)
    const ffmpegCommand = [
        'ffmpeg',
        '-fflags +genpts',
        '-i', `"${inputPath}"`,
        '-ac 1',
        '-ar 16000',
        '-f wav',
        '-y', // Overwrite without asking
        `"${outputPath}"`
    ].join(' ');

    try {
        console.log('[FFmpegSandbox] Processing:', path.basename(inputPath));

        const { stdout, stderr } = await execAsync(ffmpegCommand, {
            timeout: 30000, // 30s max per chunk
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        // Validate output
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFmpeg did not produce output file');
        }

        const stats = fs.statSync(outputPath);
        if (stats.size < 1000) {
            throw new Error('Output file too small, likely corrupted');
        }

        const duration = Date.now() - startTime;
        console.log('[FFmpegSandbox] Success:', path.basename(outputPath), `(${stats.size} bytes, ${duration}ms)`);

        // Delete original chunk to save space
        try {
            fs.unlinkSync(inputPath);
        } catch (e) {
            console.warn('[FFmpegSandbox] Failed to delete input file:', e);
        }

        return {
            success: true,
            outputPath,
            duration
        };
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error('[FFmpegSandbox] Error:', error.message);

        // Don't throw - return error result
        // This allows master assembler to handle "holes"
        return {
            success: false,
            error: error.message,
            duration
        };
    }
}

/**
 * Batch process multiple chunks in parallel (with concurrency limit)
 */
export async function processChunksInParallel(
    inputPaths: string[],
    concurrency: number = 3
): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    for (let i = 0; i < inputPaths.length; i += concurrency) {
        const batch = inputPaths.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(path => processChunkInSandbox(path))
        );
        results.push(...batchResults);
    }

    return results;
}
