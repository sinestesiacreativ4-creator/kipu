import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../services/prisma';
import { TEMP_FOLDERS } from '../config/upload.config';
import { createError } from '../middleware/errorHandler';
import { audioQueue } from '../services/queue';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Configure ffmpeg
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// Helper: Validate chunk sequence completeness
const validateChunkSequence = (chunks: any[]) => {
    if (chunks.length === 0) return { valid: false, missing: [] };

    const sorted = chunks.sort((a, b) => a.sequence - b.sequence);
    const missing: number[] = [];

    // Check for gaps from 0 to N
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].sequence !== i) {
            // Found a gap
            for (let j = (i > 0 ? sorted[i - 1].sequence + 1 : 0); j < sorted[i].sequence; j++) {
                missing.push(j);
            }
        }
    }

    return {
        valid: missing.length === 0 && sorted[0].sequence === 0,
        missing,
        maxSequence: sorted[sorted.length - 1].sequence
    };
};

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

            if (!recordingId || chunkIndex === undefined) {
                throw createError('Missing recordingId or x-chunk-index', 400, 'MISSING_METADATA');
            }

            const sequence = parseInt(chunkIndex as string);
            if (isNaN(sequence)) {
                throw createError('Invalid chunk index', 400, 'INVALID_METADATA');
            }

            console.log(`[ChunkUpload] Receiving chunk ${sequence} for ${recordingId}`);

            // 1. Ensure directory exists
            const chunkDir = path.join(TEMP_FOLDERS.chunks, recordingId);
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            // 2. Determine file path
            const contentType = req.headers['content-type'] || 'video/webm';
            let ext = '.webm';
            if (contentType.includes('mp4') || contentType.includes('m4a')) ext = '.mp4';
            else if (contentType.includes('aac')) ext = '.aac';
            else if (contentType.includes('ogg')) ext = '.ogg';

            const filename = `chunk_${String(sequence).padStart(6, '0')}${ext}`;
            const filePath = path.join(chunkDir, filename);

            // 3. Write file (Idempotent: overwrite if exists)
            fs.writeFileSync(filePath, req.body);
            console.log(`[ChunkUpload] Saved file ${filename} (${req.body.length} bytes)`);

            // 4. Auto-create Recording if missing (Sequence 0)
            if (sequence === 0) {
                const existing = await prisma.recording.findUnique({ where: { id: recordingId } });
                if (!existing) {
                    const userId = req.headers['x-user-id'] as string;
                    const organizationId = req.headers['x-organization-id'] as string;

                    // Fallback to default profile/org if headers missing (Dev/Test mode)
                    let targetUserId = userId;
                    let targetOrgId = organizationId;

                    if (!targetUserId || !targetOrgId) {
                        const defaultProfile = await prisma.profile.findFirst();
                        const defaultOrg = await prisma.organization.findFirst();
                        if (defaultProfile) targetUserId = defaultProfile.id;
                        if (defaultOrg) targetOrgId = defaultOrg.id;
                    }

                    if (targetUserId && targetOrgId) {
                        await prisma.recording.create({
                            data: {
                                id: recordingId,
                                userId: targetUserId,
                                organizationId: targetOrgId,
                                status: 'RECORDING',
                                duration: 0
                            }
                        });
                        console.log(`[ChunkUpload] Created new recording ${recordingId}`);
                    }
                }
            }

            // 5. Register in DB (Handle duplicates gracefully)
            const existingChunk = await prisma.recordingChunk.findUnique({
                where: {
                    recordingId_sequence: {
                        recordingId,
                        sequence
                    }
                }
            });

            if (!existingChunk) {
                await prisma.recordingChunk.create({
                    data: {
                        recordingId,
                        sequence,
                        filePath,
                        size: req.body.length,
                        mimeType: contentType
                    }
                });
            } else {
                // Update existing chunk info if needed
                await prisma.recordingChunk.update({
                    where: { id: existingChunk.id },
                    data: {
                        size: req.body.length,
                        filePath // Ensure path is correct
                    }
                });
                console.log(`[ChunkUpload] Updated existing chunk ${sequence}`);
            }

            res.json({ success: true, sequence });

        } catch (error: any) {
            console.error('[ChunkUpload] Error:', error);
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
            console.log(`[Finalize] Starting finalization for ${recordingId}`);

            // 1. Get all chunks
            const chunks = await prisma.recordingChunk.findMany({
                where: { recordingId },
                orderBy: { sequence: 'asc' }
            });

            if (chunks.length === 0) {
                return res.status(400).json({ error: 'No chunks found', code: 'NO_CHUNKS' });
            }
        };
