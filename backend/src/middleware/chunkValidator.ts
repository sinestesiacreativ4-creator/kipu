import { Request, Response, NextFunction } from 'express';
import { Buffer } from 'buffer';

const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // EBML header
const MIN_CHUNK_SIZE = 100; // Relaxed from 1024
const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB maximum

interface ChunkValidationResult {
    valid: boolean;
    reason?: string;
    repairable?: boolean;
}

/**
 * Validates audio chunk buffer for WebM format integrity
 */
export function validateChunk(buffer: Buffer): ChunkValidationResult {
    // Size validation
    if (buffer.length < MIN_CHUNK_SIZE) {
        return { valid: false, reason: `Chunk too small (${buffer.length} bytes)` };
    }

    if (buffer.length > MAX_CHUNK_SIZE) {
        return { valid: false, reason: 'Chunk too large' };
    }

    // Header validation - WebM/EBML signature
    const hasWebMSignature = buffer.subarray(0, 4).equals(WEBM_SIGNATURE);
    const hasDocTypeWebM = buffer.includes(Buffer.from('webm'));
    const hasDocTypeMatroska = buffer.includes(Buffer.from('matroska'));
    const hasMp4 = buffer.includes(Buffer.from('ftyp'));

    // Relaxed check: Just look for some binary data
    // In streaming, intermediate chunks might not have headers
    const isBinary = buffer.some(b => b > 0);

    const isValidWebM = hasWebMSignature || hasDocTypeWebM || hasDocTypeMatroska;
    const isValidMp4 = hasMp4;

    if (!isValidWebM && !isValidMp4) {
        // Log what we received for debugging
        const headerHex = buffer.subarray(0, 8).toString('hex');
        console.log(`[ChunkValidator] Warning: Chunk missing standard header. First 8 bytes: ${headerHex}`);

        // If it looks like binary data, let it pass to FFmpeg sandbox
        if (isBinary) {
            return { valid: true };
        }

        return { valid: false, reason: `Invalid audio format - unknown header: ${headerHex}` };
    }

    return { valid: true };
}

/**
 * Repairs WebM chunk by prepending valid EBML/WebM header
 */
export async function repairWebMChunk(buffer: Buffer): Promise<Buffer> {
    // Basic WebM/EBML header structure
    const WEBM_HEADER = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, // EBML
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, // Header size
        0x42, 0x86, // EBMLVersion
        0x81, 0x01, // Version 1
        0x42, 0xf7, // EBMLReadVersion
        0x81, 0x01, // Version 1
        0x42, 0x82, // DocType
        0x84, 0x77, 0x65, 0x62, 0x6d // "webm"
    ]);

    console.log('[ChunkValidator] Repairing chunk by prepending WebM header');
    return Buffer.concat([WEBM_HEADER, buffer]);
}

/**
 * Express middleware for chunk validation and repair
 */
export const chunkValidationMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No chunk file provided' });
    }

    try {
        // Read file buffer
        const fs = require('fs');
        const chunkBuffer = fs.readFileSync(req.file.path);

        const validation = validateChunk(chunkBuffer);

        if (!validation.valid) {
            if (validation.repairable) {
                console.warn(`[ChunkValidator] Chunk ${req.body.sequence} is invalid but repairable: ${validation.reason}`);
                try {
                    const repairedBuffer = await repairWebMChunk(chunkBuffer);

                    // Overwrite file with repaired version
                    fs.writeFileSync(req.file.path, repairedBuffer);
                    req.file.size = repairedBuffer.length;

                    console.log(`[ChunkValidator] Chunk ${req.body.sequence} repaired successfully (${repairedBuffer.length} bytes)`);
                } catch (error: any) {
                    console.error('[ChunkValidator] Repair failed:', error);
                    // Don't fail, let FFmpeg try
                }
            } else {
                console.warn(`[ChunkValidator] Chunk ${req.body.sequence} flagged as invalid: ${validation.reason}`);
                // CRITICAL CHANGE: Don't reject, just warn. Let FFmpeg sandbox decide.
                // return res.status(400).json({ error: 'Invalid chunk', reason: validation.reason });
            }
        } else {
            // console.log(`[ChunkValidator] Chunk ${req.body.sequence} validated successfully`);
        }

        next();
    } catch (error: any) {
        console.error('[ChunkValidator] Validation error:', error);
        // Fail open to avoid blocking uploads
        next();
    }
};
