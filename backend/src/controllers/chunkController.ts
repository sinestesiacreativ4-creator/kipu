import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os'; // Import os directly
import prisma from '../services/prisma';
import { chunkValidationMiddleware } from '../middleware/chunkValidator';
import { processChunkInSandbox } from '../services/ffmpegSandbox';
import { assembleRecording, ChunkMetadata } from '../services/masterAssembler';
import { TEMP_FOLDERS } from '../config/upload.config';
import { createError } from '../middleware/errorHandler';

const router = Router();

// ============================================
// DEFENSIVE MULTER CONFIG
// ============================================
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            try {
                // 1. Safe Recording ID
                let recordingId = req.body.recordingId;
                if (!recordingId || typeof recordingId !== 'string') {
                    console.warn('[ChunkController] ⚠️ Missing or invalid recordingId, defaulting to "unknown"');
                    recordingId = 'unknown';
                }

                // 2. Safe Base Directory
                // Try imported config, fallback to os.tmpdir() hardcoded path
                let baseDir = TEMP_FOLDERS?.chunks;

                if (!baseDir || typeof baseDir !== 'string') {
                    console.warn('[ChunkController] ⚠️ TEMP_FOLDERS.chunks is undefined! Using fallback.');
                    baseDir = path.join(os.tmpdir(), 'kipu-audio', 'chunks');
                }

                // 3. Construct Path (Guaranteed strings)
                const chunkDir = path.join(baseDir, recordingId);

                // 4. Create Directory
                if (!fs.existsSync(chunkDir)) {
                    fs.mkdirSync(chunkDir, { recursive: true, mode: 0o755 });
                }

                cb(null, chunkDir);
            } catch (error: any) {
                console.error('[ChunkController] 🔴 CRITICAL DESTINATION ERROR:', error);
                // Fallback to strict temp dir to prevent crash
                cb(null, os.tmpdir());
            }
        },
        filename: (req, file, cb) => {
            try {
                const sequence = req.body.sequence || '0';
                const paddedSequence = String(sequence).padStart(6, '0');
                // Ensure filename is safe
                const safeFilename = `chunk_${paddedSequence}.webm`.replace(/[^a-zA-Z0-9._-]/g, '');
                cb(null, safeFilename);
            } catch (error) {
                cb(null, `fallback-${Date.now()}.webm`);
            }
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max per chunk
    }
});

// ============================================
// UPLOAD CHUNK ENDPOINT
// ============================================
router.post('/upload-chunk',
    upload.single('chunk'),
    chunkValidationMiddleware,
    async (req: Request, res: Response) => {
        try {
            // Re-validate recordingId here since we allowed 'unknown' in Multer
            const { recordingId, sequence, mimeType } = req.body;

            if (!recordingId || recordingId === 'unknown') {
                // If we saved to 'unknown', we should probably clean it up or reject
                throw createError('Missing valid recordingId', 400, 'MISSING_FIELD');
            }

            if (!req.file) {
                throw createError('No chunk file uploaded', 400, 'NO_FILE');
            }

            console.log(`[ChunkUpload] Processing chunk ${sequence} for ${recordingId}`);

            const processResult = await processChunkInSandbox(req.file.path);
            const finalPath = processResult.success ? processResult.outputPath : req.file.path;

            await prisma.recordingChunk.create({
                data: {
                    recordingId,
                    sequence: parseInt(sequence),
                    filePath: finalPath || req.file.path,
                    size: processResult.success ? fs.statSync(finalPath!).size : req.file.size,
                    mimeType: processResult.success ? 'audio/wav' : (mimeType || 'audio/webm')
                }
            });

            res.json({
                success: true,
                sequence: parseInt(sequence),
                processed: processResult.success
            });

        } catch (error: any) {
            console.error('[ChunkUpload] Error:', error);
            throw error;
        }
    }
);

// ============================================
// FINALIZE RECORDING
// ============================================
router.post('/finalize-recording', async (req: Request, res: Response) => {
    const { recordingId } = req.body;

    try {
        console.log(`[Finalize] Assembly requested for ${recordingId}`);

        const dbChunks = await prisma.recordingChunk.findMany({
            where: { recordingId },
            orderBy: { sequence: 'asc' }
        });

        if (dbChunks.length === 0) {
            throw createError('No chunks found', 400, 'NO_CHUNKS');
        }

        const chunkMetadata: ChunkMetadata[] = dbChunks.map(chunk => ({
            chunk_id: chunk.id,
            sequence: chunk.sequence,
            status: fs.existsSync(chunk.filePath) ? 'ok' : 'hole',
            duration: 10,
            worker_id: 0,
            file_path: chunk.filePath,
            timestamp: chunk.createdAt.getTime()
        }));

        const assemblyResult = await assembleRecording(recordingId, chunkMetadata);

        if (!assemblyResult.success) {
            throw createError(assemblyResult.error || 'Assembly failed', 500, 'ASSEMBLY_FAILED');
        }

        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                audioKey: assemblyResult.finalPath,
                status: 'PROCESSING',
                duration: assemblyResult.totalDuration
            }
        });

        await prisma.recordingChunk.deleteMany({ where: { recordingId } });

        // Cleanup
        const chunkDir = path.join(TEMP_FOLDERS?.chunks || path.join(os.tmpdir(), 'kipu-audio', 'chunks'), recordingId);
        if (fs.existsSync(chunkDir)) {
            fs.rmSync(chunkDir, { recursive: true, force: true });
        }

        res.json({
            success: true,
            finalPath: assemblyResult.finalPath,
            duration: assemblyResult.totalDuration
        });

    } catch (error: any) {
        console.error('[Finalize] Error:', error);
        throw error;
    }
});

export default router;
