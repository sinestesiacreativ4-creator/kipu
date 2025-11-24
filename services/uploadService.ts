import { Recording } from '../types';

const BACKEND_URL = '/api';

export const uploadService = {
    /**
     * 1. Obtener URL firmada del backend
     */
    async getUploadUrl(fileName: string, fileType: string, userId: string): Promise<{ uploadUrl: string, filePath: string, token: string }> {
        const response = await fetch(`${BACKEND_URL}/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, fileType, userId })
        });

        if (!response.ok) throw new Error('Failed to get upload URL');
        return response.json();
    },

    /**
     * 2. Subir archivo directamente a Supabase usando la URL firmada
     */
    async uploadFileToSupabase(uploadUrl: string, file: Blob, token: string, onProgress?: (progress: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl); // Supabase signed URLs usually use PUT
            xhr.setRequestHeader('Content-Type', file.type);
            // xhr.setRequestHeader('Authorization', `Bearer ${token}`); // Sometimes needed depending on setup

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Upload network error'));
            xhr.send(file);
        });
    },

    /**
     * 3. Notificar al backend para iniciar procesamiento
     */
    async notifyUploadComplete(filePath: string, recordingId: string, userId: string, organizationId: string): Promise<void> {
        const response = await fetch(`${BACKEND_URL}/upload-complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, recordingId, userId, organizationId })
        });

        if (!response.ok) throw new Error('Failed to notify upload completion');
    }
};
