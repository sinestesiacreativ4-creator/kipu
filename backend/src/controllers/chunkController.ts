import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import prisma from '../services/prisma';

const execAsync = promisify(exec);
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
// UPLOAD CHUNK ENDPOINT
// ============================================
router.post('/upload-chunk', upload.single('chunk'), async (req: Request, res: Response) => {
    try {
        const { recordingId, sequence, mimeType } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No chunk file uploaded' });
        }

        console.log(`[ChunkUpload] Received chunk ${sequence} for recording ${recordingId}`);
        console.log(`[ChunkUpload] Chunk size: ${req.file.size} bytes`);

        // Track chunk in database
        await prisma.recordingChunk.create({
            data: {
                recordingId,
                sequence: parseInt(sequence),
                filePath: req.file.path,
                size: req.file.size,
                mimeType: mimeType || 'audio/webm'
            }
        });

        res.json({
            success: true,
            sequence: parseInt(sequence),
            size: req.file.size
        });

    } catch (error: any) {
        console.error('[ChunkUpload] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// FINALIZE RECORDING (FFmpeg Reassembly)
// ============================================
router.post('/finalize-recording', async (req: Request, res: Response) => {
    const { recordingId } = req.body;

    try {
        console.log(`[Finalize] Starting finalization for recording ${recordingId}...`);

        // Get all chunks ordered by sequence
        const chunks = await prisma.recordingChunk.findMany({
            where: { recordingId },
            orderBy: { sequence: 'asc' }
        });

        if (chunks.length === 0) {
            return res.status(400).json({ error: 'No chunks found for recording' });
        }

        console.log(`[Finalize] Found ${chunks.length} chunks to merge`);

        // ============================================
        // FFMPEG REASSEMBLY
        // ============================================
        const chunkDir = path.dirname(chunks[0].filePath);
        const outputPath = path.join(chunkDir, `${recordingId}_final.webm`);
        const concatListPath = path.join(chunkDir, 'concat_list.txt');

        // Create FFmpeg concat file list
        const concatList = chunks
            .map(chunk => `file '${path.basename(chunk.filePath)}'`)
            .join('\n');

        fs.writeFileSync(concatListPath, concatList);

        // Run FFmpeg concat (lossless, fast)
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;

        console.log('[Finalize] Running FFmpeg concatenation...');
        await execAsync(ffmpegCommand);

        // Verify output file exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFmpeg failed to create output file');
        }

        const fileStats = fs.statSync(outputPath);
        console.log(`[Finalize] Final file created: ${fileStats.size} bytes`);

        // Calculate approximate duration (chunks * 10 seconds each)
        const approximateDuration = chunks.length * 10;

        // Update recording in database
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                audioKey: outputPath,
                status: 'PROCESSING',
                duration: approximateDuration
            }
        });

        // Cleanup temporary chunks
        chunks.forEach(chunk => {
            try {
                fs.unlinkSync(chunk.filePath);
            } catch (e) {
                console.warn(`[Finalize] Failed to delete chunk: ${chunk.filePath}`);
            }
        });

        try {
            fs.unlinkSync(concatListPath);
        } catch (e) {
            console.warn('[Finalize] Failed to delete concat list');
        }

        // Delete chunk records
        await prisma.recordingChunk.deleteMany({
            where: { recordingId }
        });

        console.log(`[Finalize] Recording ${recordingId} finalized successfully`);

        res.json({
            success: true,
            finalPath: outputPath,
            totalSize: fileStats.size,
            chunksProcessed: chunks.length,
            duration: approximateDuration
        });

    } catch (error: any) {
        console.error('[Finalize] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
