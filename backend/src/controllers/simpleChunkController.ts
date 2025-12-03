import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../services/prisma';
import { TEMP_FOLDERS } from '../config/upload.config';
import { assembleRecording, ChunkMetadata } from '../services/masterAssembler';
import { createError } from '../middleware/errorHandler';

export const SimpleChunkController = {
    /**
     * Handle raw binary chunk upload
     * POST /api/chunks/:recordingId
     * Headers: x-chunk-index, Content-Type: video/webm
     * Body: Raw binary data
     */
    async uploadChunk(req: Request, res: Response) {
        try {
            const { recordingId } = req.params;
            const chunkIndex = req.headers['x-chunk-index'];

            if (!recordingId || !chunkIndex) {
                throw createError('Missing recordingId or x-chunk-index', 400, 'MISSING_METADATA');
            }

            const sequence = parseInt(chunkIndex as string);
            if (isNaN(sequence)) {
                throw createError('Invalid chunk index', 400, 'INVALID_METADATA');
            }

            // 1. Ensure directory exists
            const chunkDir = path.join(TEMP_FOLDERS.chunks, recordingId);
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            // 2. Write raw body to file
            const filename = `chunk_${String(sequence).padStart(6, '0')}.webm`;
            const filePath = path.join(chunkDir, filename);

            // req.body is a Buffer because we use express.raw() in index.ts
            fs.writeFileSync(filePath, req.body);

            console.log(`[SimpleUpload] Saved chunk ${sequence} for ${recordingId} (${req.body.length} bytes)`);

            // 3. Auto-create Recording if missing (Foreign Key Fix)
            // This is crucial for the first chunk
            if (sequence === 0) {
                const existing = await prisma.recording.findUnique({ where: { id: recordingId } });
                if (!existing) {
                    const defaultProfile = await prisma.profile.findFirst();
                    const defaultOrg = await prisma.organization.findFirst();
                    if (defaultProfile && defaultOrg) {
                        await prisma.recording.create({
                            data: {
                                id: recordingId,
                                userId: defaultProfile.id,
                                organizationId: defaultOrg.id,
                                status: 'RECORDING',
                                duration: 0
                            }
                        });
                        console.log(`[SimpleUpload] Auto-created recording ${recordingId}`);
                    }
                }
            }

            // 4. Register chunk in DB
            await prisma.recordingChunk.create({
                data: {
                    recordingId,
                    sequence,
                    filePath,
                    size: req.body.length,
                    mimeType: 'video/webm'
                }
            });

            res.json({ success: true, sequence });

        } catch (error: any) {
            console.error('[SimpleUpload] Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Finalize recording
     * POST /api/finalize/:recordingId
     */
    async finalize(req: Request, res: Response) {
        try {
            const { recordingId } = req.params;
            console.log(`[SimpleFinalize] Finalizing ${recordingId}`);

            // 1. Get all chunks from DB
            const chunks = await prisma.recordingChunk.findMany({
                where: { recordingId },
                orderBy: { sequence: 'asc' }
            });

            if (chunks.length === 0) {
                return res.status(400).json({
                    error: 'No chunks found',
                    code: 'NO_CHUNKS'
                });
            }

            console.log(`[SimpleFinalize] Found ${chunks.length} chunks`);

            // 2. Concatenate chunks (simple binary concat - webm supports this)
            const chunkBuffers: Buffer[] = [];
            let totalSize = 0;

            for (const chunk of chunks) {
                if (fs.existsSync(chunk.filePath)) {
                    const buffer = fs.readFileSync(chunk.filePath);
                    chunkBuffers.push(buffer);
                    totalSize += buffer.length;
                } else {
                    console.warn(`[SimpleFinalize] Chunk file missing: ${chunk.filePath}`);
                }
            }

            if (chunkBuffers.length === 0) {
                throw new Error('No chunk files found on disk');
            }

            // 3. Create concatenated file
            const finalFilename = `${recordingId}_final.webm`;
            const finalPath = path.join(TEMP_FOLDERS.merged, finalFilename);

            // Ensure merged directory exists
            if (!fs.existsSync(TEMP_FOLDERS.merged)) {
                fs.mkdirSync(TEMP_FOLDERS.merged, { recursive: true });
            }

            // Write concatenated file
            const finalBuffer = Buffer.concat(chunkBuffers);
            fs.writeFileSync(finalPath, finalBuffer);

            console.log(`[SimpleFinalize] Assembled ${chunkBuffers.length} chunks into ${finalPath} (${totalSize} bytes)`);

            // 4. Estimate duration (5 seconds per chunk)
            const estimatedDuration = chunks.length * 5;

            // 5. Update Recording
            await prisma.recording.update({
                where: { id: recordingId },
                data: {
                    audioKey: finalPath,
                    status: 'PROCESSING',
                    duration: estimatedDuration
                }
            });

            // 6. Cleanup chunks
            await prisma.recordingChunk.deleteMany({ where: { recordingId } });
            const chunkDir = path.join(TEMP_FOLDERS.chunks, recordingId);
            if (fs.existsSync(chunkDir)) {
                fs.rmSync(chunkDir, { recursive: true, force: true });
            }

            res.json({ success: true, path: finalPath, duration: estimatedDuration });

        } catch (error: any) {
            console.error('[SimpleFinalize] Error:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
