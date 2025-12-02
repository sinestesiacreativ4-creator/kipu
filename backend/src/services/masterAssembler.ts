import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Module 4: Master Assembler
 * Transactional concatenation of processed chunks with hole detection
 */

export interface ChunkMetadata {
    chunk_id: string;
    sequence: number;
    status: 'ok' | 'repaired' | 'hole';
    duration: number;
    worker_id?: number;
    file_path?: string;
    error?: string;
    timestamp: number;
}

export interface AssemblyResult {
    success: boolean;
    finalPath?: string;
    totalChunks: number;
    successfulChunks: number;
    holes: number;
    holeSequences: number[];
    totalDuration: number;
    metadataPath?: string;
    error?: string;
}

/**
 * Assemble recording from processed chunks
 */
export async function assembleRecording(
    recordingId: string,
    chunkMetadata: ChunkMetadata[]
): Promise<AssemblyResult> {
    console.log(`[MasterAssembler] Starting assembly for ${recordingId} with ${chunkMetadata.length} chunks`);

    // Sort by sequence
    const sortedChunks = [...chunkMetadata].sort((a, b) => a.sequence - b.sequence);

    // Detect holes
    const holes = sortedChunks.filter(c => c.status === 'hole');
    if (holes.length > 0) {
        console.warn(
            `[MasterAssembler] Recording ${recordingId} has ${holes.length} holes at sequences:`,
            holes.map(h => h.sequence)
        );
    }

    // Filter valid chunks with file paths
    const validChunks = sortedChunks.filter(c =>
        c.status !== 'hole' && c.file_path && fs.existsSync(c.file_path)
    );

    if (validChunks.length === 0) {
        return {
            success: false,
            error: 'No valid chunks to assemble',
            totalChunks: sortedChunks.length,
            successfulChunks: 0,
            holes: holes.length,
            holeSequences: holes.map(h => h.sequence),
            totalDuration: 0
        };
    }

    try {
        const tempDir = path.dirname(validChunks[0].file_path!);
        const concatListPath = path.join(tempDir, `${recordingId}_concat.txt`);
        const outputPath = path.join(tempDir, `${recordingId}_final.wav`);

        // Create FFmpeg concat list
        const concatList = validChunks
            .map(chunk => `file '${path.basename(chunk.file_path!)}'`)
            .join('\n');

        fs.writeFileSync(concatListPath, concatList);

        console.log(`[MasterAssembler] Concatenating ${validChunks.length} chunks...`);

        // Assemble with FFmpeg (lossless copy)
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;

        await execAsync(ffmpegCommand, {
            timeout: 120000, // 2 minutes max for assembly
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        });

        // Validate output
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFmpeg did not produce final output file');
        }

        const stats = fs.statSync(outputPath);
        const totalDuration = validChunks.reduce((sum, c) => sum + c.duration, 0);

        console.log(`[MasterAssembler] Assembly complete: ${stats.size} bytes, ${validChunks.length}/${sortedChunks.length} chunks`);

        // Save metadata
        const metadata = {
            recordingId,
            totalChunks: sortedChunks.length,
            successfulChunks: validChunks.length,
            holes: holes.length,
            holeSequences: holes.map(h => h.sequence),
            fileSize: stats.size,
            totalDuration,
            assembledAt: Date.now(),
            chunks: sortedChunks.map(c => ({
                sequence: c.sequence,
                status: c.status,
                duration: c.duration,
                error: c.error
            }))
        };

        const metadataPath = path.join(tempDir, `${recordingId}_metadata.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        // Cleanup temporary files
        try {
            fs.unlinkSync(concatListPath);
            validChunks.forEach(chunk => {
                if (chunk.file_path && fs.existsSync(chunk.file_path)) {
                    fs.unlinkSync(chunk.file_path);
                }
            });
        } catch (cleanupError) {
            console.warn('[MasterAssembler] Cleanup warning:', cleanupError);
        }

        return {
            success: true,
            finalPath: outputPath,
            totalChunks: sortedChunks.length,
            successfulChunks: validChunks.length,
            holes: holes.length,
            holeSequences: holes.map(h => h.sequence),
            totalDuration,
            metadataPath
        };
    } catch (error: any) {
        console.error('[MasterAssembler] Assembly failed:', error.message);
        return {
            success: false,
            error: error.message,
            totalChunks: sortedChunks.length,
            successfulChunks: validChunks.length,
            holes: holes.length,
            holeSequences: holes.map(h => h.sequence),
            totalDuration: 0
        };
    }
}

/**
 * Validate chunk sequence for gaps
 */
export function detectSequenceGaps(chunks: ChunkMetadata[]): number[] {
    const sequences = chunks.map(c => c.sequence).sort((a, b) => a - b);
    const gaps: number[] = [];

    for (let i = 0; i < sequences.length - 1; i++) {
        const expected = sequences[i] + 1;
        const actual = sequences[i + 1];

        if (actual !== expected) {
            // Found gap
            for (let missing = expected; missing < actual; missing++) {
                gaps.push(missing);
            }
        }
    }

    return gaps;
}
