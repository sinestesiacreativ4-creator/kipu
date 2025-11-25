// Upload Service - Handle file uploads to backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const uploadService = {
    /**
     * Upload audio file to Redis via backend
     */
    async uploadFileToRedis(
        file: Blob,
        recordingId: string,
        userId: string,
        organizationId: string
    ): Promise<void> {
        const formData = new FormData();
        formData.append('file', file, `${recordingId}.webm`);
        formData.append('recordingId', recordingId);
        formData.append('userId', userId);
        formData.append('organizationId', organizationId);

        const response = await fetch(`${API_URL}/api/upload-redis`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('[UploadService] Upload successful:', result);
    },

    /**
     * Poll status of processing job
     */
    async pollStatus(
        recordingId: string,
        onUpdate: (status: string, analysis?: any) => void
    ): Promise<void> {
        const maxAttempts = 120; // 10 minutes (5 second intervals)
        let attempts = 0;

        const poll = async () => {
            try {
                const response = await fetch(`${API_URL}/api/status/${recordingId}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        // Not yet queued, retry
                        if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(poll, 5000);
                        } else {
                            onUpdate('ERROR', 'Timeout waiting for processing');
                        }
                        return;
                    }
                    throw new Error(`Status check failed: ${response.status}`);
                }

                const status = await response.json();
                console.log('[UploadService] Status:', status);

                if (status.status === 'COMPLETED') {
                    onUpdate('COMPLETED', status.analysis);
                } else if (status.status === 'ERROR') {
                    onUpdate('ERROR', status.error || 'Processing failed');
                } else if (status.status === 'PROCESSING' || status.status === 'QUEUED') {
                    // Still processing, poll again
                    if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(poll, 5000);
                    } else {
                        onUpdate('ERROR', 'Processing timeout');
                    }
                }
            } catch (error: any) {
                console.error('[UploadService] Polling error:', error);
                onUpdate('ERROR', error.message);
            }
        };

        // Start polling
        poll();
    },

    /**
     * Upload recording (new recording from recorder)
     */
    async uploadRecording(
        blob: Blob,
        recordingId: string,
        userId: string,
        organizationId: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        if (onProgress) onProgress(0);

        await this.uploadFileToRedis(blob, recordingId, userId, organizationId);

        if (onProgress) onProgress(100);
    }
};
