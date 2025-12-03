import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const stat = promisify(fs.stat);

import { TEMP_FOLDERS } from '../config/upload.config';

export class ChunkUploadService {

    constructor() {
        // No init needed, handled by upload.config.ts
    }

    public getChunkDir(fileId: string): string {
        if (!fileId) throw new Error('fileId is required to generate chunk path');
        // Sanitize fileId to prevent path traversal
        const safeFileId = fileId.replace(/[^a-zA-Z0-9-_]/g, '');
        return path.join(TEMP_FOLDERS.chunks, safeFileId);
    }

    public getFinalPath(fileName: string): string {
        // Sanitize fileName
        const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9.-_]/g, '_');
        return path.join(TEMP_FOLDERS.uploads, safeFileName);
    }

    public async mergeChunks(fileId: string, fileName: string, totalChunks: number): Promise<string> {
        const chunkDir = this.getChunkDir(fileId);
        const finalPath = this.getFinalPath(fileName);

        if (!fs.existsSync(chunkDir)) {
            throw new Error(`Chunks directory not found for fileId: ${fileId}`);
        }

        // Verify all chunks exist
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkDir, `chunk-${i}`);
            if (!fs.existsSync(chunkPath)) {
                throw new Error(`Missing chunk ${i} for fileId: ${fileId}`);
            }
        }

        // Merge using streams
        const writeStream = fs.createWriteStream(finalPath);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(chunkDir, `chunk-${i}`);
                await this.appendChunk(chunkPath, writeStream);
            }
            writeStream.end();
        } catch (error) {
            writeStream.destroy();
            throw error;
        }

        // Cleanup chunks
        await this.cleanup(fileId);

        return finalPath;
    }

    private appendChunk(chunkPath: string, writeStream: fs.WriteStream): Promise<void> {
        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(chunkPath);
            readStream.pipe(writeStream, { end: false });
            readStream.on('end', () => resolve());
            readStream.on('error', (err) => reject(err));
        });
    }

    public async cleanup(fileId: string): Promise<void> {
        const chunkDir = this.getChunkDir(fileId);
        if (fs.existsSync(chunkDir)) {
            try {
                const files = await readdir(chunkDir);
                await Promise.all(files.map(file => unlink(path.join(chunkDir, file))));
                await rmdir(chunkDir);
            } catch (error) {
                console.error(`[ChunkUploadService] Cleanup failed for ${fileId}:`, error);
            }
        }
    }
}

export const chunkUploadService = new ChunkUploadService();
