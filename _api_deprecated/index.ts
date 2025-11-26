import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import express from 'express';
import cors from 'cors';

// --- CONFIGURACIÓN REDIS & QUEUE ---
const connection = new IORedis('redis://default:fqF0A6V0fLHaDtVTQJqYmBmA7cW1d6gG@redis-16356.c14.us-east-1-3.ec2.cloud.redislabs.com:16356', {
    maxRetriesPerRequest: null,
});

const audioQueue = new Queue('audio-processing-queue', { connection });

// --- CONFIGURACIÓN SUPABASE ---
const supabase = createClient(
    'https://enuwmaxkigsgnftcjxob.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXdtYXhraWdzZ25mdGNqeG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODIzNTIsImV4cCI6MjA3OTI1ODM1Mn0.0wG0e7CLnIQz6RRePpwwDWpiphXH3zsh-qM8xMgAV2Y'
);

// --- CONTROLADORES ---
export const UploadController = {
    async getUploadUrl(req: Request, res: Response) {
        try {
            console.log('[API] getUploadUrl called with body:', req.body);
            const { fileName, fileType, userId } = req.body;

            if (!fileName || !userId) {
                return res.status(400).json({ error: 'Missing fileName or userId' });
            }

            const filePath = `${userId}/${Date.now()}_${fileName}`;
            console.log('[API] Creating signed upload URL for path:', filePath);

            const { data, error } = await supabase
                .storage
                .from('recordings')
                .createSignedUploadUrl(filePath);

            if (error) {
                console.error('[API] Supabase error:', error);
                throw error;
            }

            console.log('[API] Successfully created upload URL');
            res.json({
                uploadUrl: data.signedUrl,
                filePath: data.path,
                token: data.token
            });
        } catch (error: any) {
            console.error('[API] Error generating upload URL:', error);
            res.status(500).json({ error: error.message || 'Unknown error' });
        }
    },

    async notifyUploadComplete(req: Request, res: Response) {
        try {
            console.log('[API] notifyUploadComplete called with body:', req.body);
            const { filePath, recordingId, userId, organizationId } = req.body;

            if (!filePath || !recordingId) {
                return res.status(400).json({ error: 'Missing filePath or recordingId' });
            }

            console.log('[API] Adding job to queue...');
            await audioQueue.add('process-audio', {
                filePath,
                recordingId,
                userId,
                organizationId
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true
            });

            console.log('[API] Updating recording status to QUEUED...');
            await supabase
                .from('recordings')
                .update({ status: 'QUEUED' })
                .eq('id', recordingId);

            console.log('[API] Job queued successfully');
            res.json({ success: true, message: 'Processing job queued successfully' });
        } catch (error: any) {
            console.error('[API] Error queueing job:', error);
            res.status(500).json({ error: error.message || 'Unknown error' });
        }
    }
};

// --- EXPRESS APP PARA VERCEL ---
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/upload-url', UploadController.getUploadUrl);
app.post('/api/upload-complete', UploadController.notifyUploadComplete);
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Vercel API is running' }));

export default app;
