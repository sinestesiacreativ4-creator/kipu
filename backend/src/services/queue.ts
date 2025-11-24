import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Conexión a Redis (Esencial para BullMQ)
// En producción, usar URL segura de Redis (ej: Upstash o AWS ElastiCache)
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Definición de la Cola
export const audioQueue = new Queue('audio-processing-queue', { connection });

// Tipos de trabajos
export interface AudioJobData {
    recordingId: string;
    filePath: string; // Ruta en Supabase Storage
    userId: string;
    organizationId: string;
}
