import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import { chunkUploadService } from '../services/chunkUploadService';

/**
 * Predictive storage engine for Multer
 * Ensures destination always exists and fileId is present
 */
const storage = multer.diskStorage({
    destination: (req: Request, file, cb) => {
        try {
            const { fileId } = req.body;

            if (!fileId) {
                return cb(new Error('Missing fileId in request body'), '');
            }

            const chunkDir = chunkUploadService.getChunkDir(fileId);

            // Auto-create folder if it doesn't exist
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            cb(null, chunkDir);
        } catch (error: any) {
            cb(error, '');
        }
    },
    filename: (req: Request, file, cb) => {
        try {
            const { chunkIndex } = req.body;

            if (chunkIndex === undefined || chunkIndex === null) {
                return cb(new Error('Missing chunkIndex in request body'), '');
            }

            // Filename: chunk-<index>
            cb(null, `chunk-${chunkIndex}`);
        } catch (error: any) {
            cb(error, '');
        }
    }
});

export const robustUpload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per chunk limit
    }
});
