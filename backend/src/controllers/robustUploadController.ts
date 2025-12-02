import { Request, Response, Router } from 'express';
import { chunkUploadService } from '../services/chunkUploadService';
import { robustUpload } from '../config/robustUpload.config';
import { createError } from '../middleware/errorHandler';

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

            console.log(`[RobustUpload] Chunk ${chunkIndex}/${totalChunks} received for ${fileId}`);

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
