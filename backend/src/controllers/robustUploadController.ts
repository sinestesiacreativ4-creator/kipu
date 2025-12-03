import { Request, Response, Router } from 'express';
import { chunkUploadService } from '../services/chunkUploadService';
import { robustUpload } from '../config/robustUpload.config';
import { createError } from '../middleware/errorHandler';
import prisma from '../services/prisma';

const router = Router();

const RobustUploadController = {
    // Middleware wrapper to handle Multer errors specifically
    uploadMiddleware: (req: Request, res: Response, next: Function) => {
        const upload = robustUpload.single('chunk');

        upload(req, res, (err: any) => {
            if (err) {
                console.error('[RobustUpload] Multer Error:', err);
                if (err.message === 'Missing fileId in request body') {
                    return res.status(400).json({ error: 'Missing fileId', code: 'MISSING_FILE_ID' });
                }
                if (err.message === 'Missing chunkIndex in request body') {
                    return res.status(400).json({ error: 'Missing chunkIndex', code: 'MISSING_CHUNK_INDEX' });
                }
                return res.status(500).json({ error: err.message, code: 'UPLOAD_FAILED' });
            }
            next();
        });
    },

    async uploadChunk(req: Request, res: Response) {
        try {
            if (!req.file) {
                throw createError('No chunk file received', 400, 'NO_FILE');
            }

            const { fileId, chunkIndex, totalChunks } = req.body;
            const recordingId = fileId; // fileId is the recording ID

            console.log(`[RobustUpload] Chunk ${chunkIndex}/${totalChunks} received for ${fileId}`);

            // Auto-create Recording if missing (Foreign Key Fix)
            if (parseInt(chunkIndex) === 0) {
                const existingRecording = await prisma.recording.findUnique({
                    where: { id: recordingId }
                });

                if (!existingRecording) {
                    console.log(`[RobustUpload] Auto-creating missing recording record: ${recordingId}`);
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
                        console.log(`[RobustUpload] Recording created successfully`);
                    } else {
                        console.warn('[RobustUpload] Cannot auto-create recording: No default profile/org found.');
                    }
                }
            }

            // Save chunk to database
            await prisma.recordingChunk.create({
                data: {
                    recordingId,
                    sequence: parseInt(chunkIndex),
                    filePath: req.file.path,
                    size: req.file.size,
                    mimeType: req.file.mimetype || 'video/webm'
                }
            });

            console.log(`[RobustUpload] Chunk ${chunkIndex} saved to database`);

            res.json({
                success: true,
                message: 'Chunk uploaded successfully',
                fileId,
                chunkIndex
            });

        } catch (error: any) {
            console.error('[RobustUpload] Error uploading chunk:', error);
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    },

    async mergeChunks(req: Request, res: Response) {
        try {
            const { fileId, fileName, totalChunks } = req.body;

            if (!fileId || !fileName || !totalChunks) {
                throw createError('Missing required fields: fileId, fileName, totalChunks', 400, 'MISSING_FIELDS');
            }

            console.log(`[RobustUpload] Merging ${totalChunks} chunks for ${fileId}...`);

            const finalPath = await chunkUploadService.mergeChunks(fileId, fileName, parseInt(totalChunks));

            console.log(`[RobustUpload] Merge complete: ${finalPath}`);

            res.json({
                success: true,
                message: 'File merged successfully',
                path: finalPath
            });

        } catch (error: any) {
            console.error('[RobustUpload] Error merging chunks:', error);
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }
};

// Define Routes
router.post('/upload/chunk', RobustUploadController.uploadMiddleware, RobustUploadController.uploadChunk);
router.post('/upload/merge', RobustUploadController.mergeChunks);

export default router;
