import { Request, Response, NextFunction } from 'express';
import { Buffer } from 'buffer';

const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // EBML header
const MIN_CHUNK_SIZE = 1024; // 1KB minimum
const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB maximum

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
        return { valid: false, reason: 'Chunk too small' };
    }

    if (buffer.length > MAX_CHUNK_SIZE) {
        return { valid: false, reason: 'Chunk too large' };
    }

    // Header validation - WebM/EBML signature
    const hasWebMSignature = buffer.subarray(0, 4).equals(WEBM_SIGNATURE);
    const hasDocTypeWebM = buffer.includes(Buffer.from('webm'));
    const hasDocTypeMatroska = buffer.includes(Buffer.from('matroska'));
    const hasMp4 = buffer.includes(Buffer.from('ftyp'));

    const isValidWebM = hasWebMSignature || hasDocTypeWebM || hasDocTypeMatroska;
    const isValidMp4 = hasMp4;

    if (!isValidWebM && !isValidMp4) {
        // Check if repairable (has opus data but missing header)
        if (buffer.length > 100 && buffer.includes(Buffer.from('opus'))) {
            return {
                valid: false,
                reason: 'Missing WebM header',
                repairable: true
            };
        }
        return { valid: false, reason: 'Invalid audio format - not WebM or MP4' };
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
                    return res.status(400).json({
                        error: 'Chunk repair failed',
                        reason: validation.reason
                    });
                }
            } else {
                console.error(`[ChunkValidator] Chunk ${req.body.sequence} rejected: ${validation.reason}`);
                return res.status(400).json({
                    error: 'Invalid chunk',
                    reason: validation.reason
                });
            }
        } else {
            console.log(`[ChunkValidator] Chunk ${req.body.sequence} validated successfully (${chunkBuffer.length} bytes)`);
        }

        next();
    } catch (error: any) {
        console.error('[ChunkValidator] Validation error:', error);
        return res.status(500).json({ error: 'Chunk validation failed' });
    }
};
