import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const stat = promisify(fs.stat);

export class ChunkUploadService {
    private readonly UPLOAD_ROOT: string;
    private readonly TEMP_ROOT: string;

    constructor() {
        // Absolute paths compatible with Render
        this.UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
        this.TEMP_ROOT = path.join(this.UPLOAD_ROOT, 'temp');

        this.initFolders();
    }

    private initFolders() {
        if (!fs.existsSync(this.UPLOAD_ROOT)) {
            fs.mkdirSync(this.UPLOAD_ROOT, { recursive: true });
        }
        if (!fs.existsSync(this.TEMP_ROOT)) {
            fs.mkdirSync(this.TEMP_ROOT, { recursive: true });
        }
    }

    public getChunkDir(fileId: string): string {
        if (!fileId) throw new Error('fileId is required to generate chunk path');
        // Sanitize fileId to prevent path traversal
        const safeFileId = fileId.replace(/[^a-zA-Z0-9-_]/g, '');
        return path.join(this.TEMP_ROOT, safeFileId);
    }

    public getFinalPath(fileName: string): string {
        // Sanitize fileName
        const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9.-_]/g, '_');
        return path.join(this.UPLOAD_ROOT, safeFileName);
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
