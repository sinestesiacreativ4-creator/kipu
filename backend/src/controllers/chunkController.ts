import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../services/prisma';
import { chunkValidationMiddleware } from '../middleware/chunkValidator';
import { processChunkInSandbox } from '../services/ffmpegSandbox';
import { assembleRecording, ChunkMetadata } from '../services/masterAssembler';

const router = Router();

// ============================================
// MULTER STORAGE (Temporary chunk storage)
// ============================================
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const recordingId = req.body.recordingId;
            const chunkDir = path.join(__dirname, '../../temp_chunks', recordingId);

            // Create directory if doesn't exist
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            cb(null, chunkDir);
        },
        filename: (req, file, cb) => {
            const sequence = req.body.sequence;
            // Pad sequence for correct alphabetical sorting
            const paddedSequence = String(sequence).padStart(6, '0');
            cb(null, `chunk_${paddedSequence}.webm`);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max per chunk
    }
});

// ============================================
// UPLOAD CHUNK ENDPOINT (with validation)
// ============================================
router.post('/upload-chunk',
    upload.single('chunk'),
    chunkValidationMiddleware, // Module 1: Validate and repair
    async (req: Request, res: Response) => {
        try {
            const { recordingId, sequence, mimeType } = req.body;

            if (!req.file) {
                return res.status(400).json({ error: 'No chunk file uploaded' });
            }

            console.log(`[ChunkUpload] Validated chunk ${sequence} for recording ${recordingId}`);

            // Process chunk in sandbox immediately after upload
            // Module 3: FFmpeg Sandbox
            const processResult = await processChunkInSandbox(req.file.path);

            const chunkStatus = processResult.success ? 'ok' : 'hole';
            const finalPath = processResult.success ? processResult.outputPath : req.file.path;

            if (!processResult.success) {
                console.warn(`[ChunkUpload] Chunk ${sequence} failed processing: ${processResult.error}`);
            }

            // Track chunk in database with processing status
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
                size: req.file.size,
                processed: processResult.success,
                status: chunkStatus
            });

        } catch (error: any) {
            console.error('[ChunkUpload] Error:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================
// FINALIZE RECORDING (Master Assembler)
// ============================================
router.post('/finalize-recording', async (req: Request, res: Response) => {
    const { recordingId } = req.body;

    try {
        console.log(`[Finalize] Starting robust assembly for recording ${recordingId}...`);

        // Get all chunks ordered by sequence
        const dbChunks = await prisma.recordingChunk.findMany({
            where: { recordingId },
            orderBy: { sequence: 'asc' }
        });

        if (dbChunks.length === 0) {
            return res.status(400).json({ error: 'No chunks found for recording' });
        }

        console.log(`[Finalize] Found ${dbChunks.length} chunks`);

        // Convert to ChunkMetadata format
        const chunkMetadata: ChunkMetadata[] = dbChunks.map(chunk => {
            const fileExists = fs.existsSync(chunk.filePath);
            const status: 'ok' | 'hole' = fileExists && chunk.filePath.includes('_processed.wav') ? 'ok' : 'hole';

            return {
                chunk_id: chunk.id,
                sequence: chunk.sequence,
                status,
                duration: 10, // Approximate 10s per chunk
                worker_id: 0,
                file_path: fileExists ? chunk.filePath : undefined,
                error: fileExists ? undefined : 'File not found',
                timestamp: chunk.createdAt.getTime()
            };
        });

        // Module 4: Master Assembler
        const assemblyResult = await assembleRecording(recordingId, chunkMetadata);

        if (!assemblyResult.success) {
            throw new Error(assemblyResult.error || 'Assembly failed');
        }

        console.log(`[Finalize] Assembly complete: ${assemblyResult.successfulChunks}/${assemblyResult.totalChunks} chunks, ${assemblyResult.holes} holes`);

        // Update recording in database
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                audioKey: assemblyResult.finalPath,
                status: 'PROCESSING',
                duration: assemblyResult.totalDuration
            }
        });

        // Delete chunk records
        await prisma.recordingChunk.deleteMany({
            where: { recordingId }
        });

        res.json({
            success: true,
            finalPath: assemblyResult.finalPath,
            totalChunks: assemblyResult.totalChunks,
            successfulChunks: assemblyResult.successfulChunks,
            holes: assemblyResult.holes,
            holeSequences: assemblyResult.holeSequences,
            duration: assemblyResult.totalDuration,
            metadataPath: assemblyResult.metadataPath
        });

    } catch (error: any) {
        console.error('[Finalize] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
