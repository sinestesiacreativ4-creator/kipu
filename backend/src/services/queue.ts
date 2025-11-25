import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Conexión a Redis (Esencial para BullMQ)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisOptions: any = {
    maxRetriesPerRequest: null,
};

if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false
    };
}

const connection = new IORedis(redisUrl, redisOptions);

// Definición de la Cola
export const audioQueue = new Queue('audio-processing-queue', { connection });

// Tipos de trabajos
export interface AudioJobData {
    recordingId: string;
    fileKey: string; // Redis key for file
    userId: string;
    organizationId: string;
    mimeType?: string;
}
