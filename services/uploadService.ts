// Upload Service - Handle file uploads to backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const uploadService = {
    /**
     * Upload audio file to Redis via backend with retry logic
     */
    async uploadFileToRedis(
        file: Blob,
        recordingId: string,
        userId: string,
        organizationId: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        const formData = new FormData();
        formData.append('file', file, `${recordingId}.webm`);
        formData.append('recordingId', recordingId);
        formData.append('userId', userId);
        formData.append('organizationId', organizationId);

        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                if (onProgress) onProgress(10 + (attempt * 10)); // Fake progress to show activity

                const response = await fetch(`${API_URL}/api/upload-redis`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    // Don't retry client errors (4xx), only server errors (5xx)
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
                    }
                    throw new Error(`Server error: ${response.status} - ${errorText}`);
                }

                const result = await response.json();
                console.log('[UploadService] Upload successful:', result);
                if (onProgress) onProgress(100);
                return; // Success

            } catch (error: any) {
                attempt++;
                console.warn(`[UploadService] Upload attempt ${attempt} failed:`, error);

                if (attempt >= MAX_RETRIES) {
                    throw new Error(`Failed to upload after ${MAX_RETRIES} attempts: ${error.message}`);
                }

                // Exponential backoff: 2s, 4s, 8s
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    /**
     * Poll status of processing job
     */
    async pollStatus(
        recordingId: string,
        onUpdate: (status: string, analysis?: any) => void
    ): Promise<void> {
        const maxAttempts = 180; // 15 minutes (5 second intervals) to match backend timeout
        let attempts = 0;
        let consecutiveErrors = 0;

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
                            onUpdate('ERROR', 'Timeout waiting for processing start');
                        }
                        return;
                    }
                    throw new Error(`Status check failed: ${response.status}`);
                }

                consecutiveErrors = 0; // Reset error count on success
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
                        onUpdate('ERROR', 'Processing timeout exceeded');
                    }
                }
            } catch (error: any) {
                console.error('[UploadService] Polling error:', error);
                consecutiveErrors++;

                // If we have too many consecutive connection errors, fail
                if (consecutiveErrors > 10) { // 50 seconds of downtime
                    onUpdate('ERROR', 'Connection lost with server');
                    return;
                }

                // Retry polling even on error (network blip)
                if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 5000);
                }
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
        await this.uploadFileToRedis(blob, recordingId, userId, organizationId, onProgress);
    }
};
