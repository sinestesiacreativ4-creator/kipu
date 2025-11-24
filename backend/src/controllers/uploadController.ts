import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { audioQueue } from '../services/queue';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANTE: Usar Service Role Key para permisos de admin
);

export const UploadController = {
    /**
     * 1. Generar URL firmada para subida directa (Direct-to-Storage)
     * Evita que el archivo pase por nuestro servidor Node.js
     */
    async getUploadUrl(req: Request, res: Response) {
        try {
            const { fileName, fileType } = req.body;
            const userId = req.body.userId; // En prod, obtener de req.user (Auth Middleware)

            const filePath = `${userId}/${Date.now()}_${fileName}`;

            // Crear URL firmada para subir el archivo (válida por 1 hora)
            const { data, error } = await supabase
                .storage
                .from('recordings')
                .createSignedUploadUrl(filePath);

            if (error) throw error;

            res.json({
                uploadUrl: data.signedUrl,
                filePath: data.path,
                token: data.token // Token necesario para la subida TUS o directa
            });
        } catch (error: any) {
            console.error('Error generating upload URL:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * 2. Webhook / Notificación de subida completada
     * El frontend llama a esto cuando termina de subir el archivo a Supabase
     */
    async notifyUploadComplete(req: Request, res: Response) {
        try {
            const { filePath, recordingId, userId, organizationId } = req.body;

            // Validar que el archivo realmente existe en Supabase (Opcional pero recomendado)
            // const { data } = await supabase.storage.from('recordings').list(userId);

            // 3. Meter el trabajo a la cola (Background Job)
            // Esto responde INMEDIATAMENTE al frontend, no bloquea.
            await audioQueue.add('process-audio', {
                filePath,
                recordingId,
                userId,
                organizationId
            }, {
                attempts: 3, // Reintentar 3 veces si falla
                backoff: {
                    type: 'exponential',
                    delay: 5000
                },
                removeOnComplete: true
            });

            // Actualizar estado en DB a "QUEUED"
            await supabase
                .from('recordings')
                .update({ status: 'QUEUED' })
                .eq('id', recordingId);

            res.json({
                success: true,
                message: 'Processing job queued successfully',
                jobId: recordingId
            });

        } catch (error: any) {
            console.error('Error queueing job:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
