import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Request } from 'express';

/**
 * GUARANTEED temp folder structure
 * All paths validated and auto-created
 */
export const TEMP_FOLDERS = {
    root: path.join(os.tmpdir(), 'kipu-audio'),
    uploads: path.join(os.tmpdir(), 'kipu-audio', 'uploads'),
    chunks: path.join(os.tmpdir(), 'kipu-audio', 'chunks'),
    merged: path.join(os.tmpdir(), 'kipu-audio', 'merged'),
    processed: path.join(os.tmpdir(), 'kipu-audio', 'processed')
};

/**
 * Initialize all temp folders
 * MUST be called on app startup
 */
export function initTempFolders(): void {
    console.log('[TempFolders] Initializing...');

    Object.entries(TEMP_FOLDERS).forEach(([name, folder]) => {
        try {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true, mode: 0o755 });
                console.log(`[TempFolders] ✓ Created: ${name} → ${folder}`);
            } else {
                console.log(`[TempFolders] ✓ Exists: ${name} → ${folder}`);
            }
        } catch (error) {
            console.error(`[TempFolders] ✗ Failed to create ${name}:`, error);
            throw new Error(`Critical: Could not initialize temp folder ${name}`);
        }
    });

    console.log('[TempFolders] Initialization complete ✓');
}

/**
 * Validate file MIME type before upload
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = [
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/x-m4a',
        'audio/mp3',
        'audio/aac'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error(
            `Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`
        );
        (error as any).code = 'INVALID_FILE_TYPE';
        cb(error);
    }
};

/**
 * Production-grade Multer configuration
 * ZERO undefined paths guaranteed
 */
export const uploadConfig = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            // CRITICAL FIX: Always return valid path, never undefined
            const dest = TEMP_FOLDERS.uploads;

            // Paranoid check: ensure folder exists
            if (!fs.existsSync(dest)) {
                try {
                    fs.mkdirSync(dest, { recursive: true, mode: 0o755 });
                    console.log('[Multer] Created missing uploads folder');
                } catch (error) {
                    console.error('[Multer] CRITICAL: Cannot create uploads folder:', error);
                    const err = new Error('Upload folder unavailable');
                    (err as any).code = 'UPLOAD_FOLDER_ERROR';
                    return cb(err, '');
                }
            }

            cb(null, dest);
        },
        filename: (req, file, cb) => {
            // Sanitize filename to prevent path traversal
            const sanitized = file.originalname
                .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Remove special chars
                .replace(/\.+/g, '.') // Remove multiple dots
                .substring(0, 100); // Limit length

            const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const ext = path.extname(sanitized) || '.webm';
            const basename = path.basename(sanitized, ext) || 'upload';
            const filename = `${basename}-${uniqueSuffix}${ext}`;

            cb(null, filename);
        }
    }),
    fileFilter: fileFilter as any, // Cast to any to avoid strict type mismatch if Express.Multer.File differs
    limits: {
        fileSize: 1 * 1024 * 1024 * 1024, // 1GB max
        files: 1,
        fieldSize: 10 * 1024 * 1024 // 10MB field size
    }
});

/**
 * Multer error handler middleware
 * Provides clear, structured error responses
 */
export function handleMulterError(err: any, req: any, res: any, next: any) {
    if (err instanceof multer.MulterError) {
        console.error('[Multer] Error:', err.code, err.message);

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(413).json({
                    error: 'File too large',
                    maxSize: '1GB',
                    code: 'FILE_TOO_LARGE'
                });

            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    error: 'Too many files',
                    maxFiles: 1,
                    code: 'TOO_MANY_FILES'
                });

            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    error: 'Unexpected field name',
                    expectedField: 'file',
                    code: 'INVALID_FIELD'
                });

            default:
                return res.status(400).json({
                    error: err.message,
                    code: err.code || 'MULTER_ERROR'
                });
        }
    }

    // Custom errors (file type, etc)
    if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            error: err.message,
            code: 'INVALID_FILE_TYPE'
        });
    }

    if (err.code === 'UPLOAD_FOLDER_ERROR') {
        return res.status(500).json({
            error: 'Server storage unavailable',
            code: 'UPLOAD_FOLDER_ERROR'
        });
    }

    // Pass to global error handler
    next(err);
}
