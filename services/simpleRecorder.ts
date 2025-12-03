import { api } from './api';

// UUID v4 Generator
function uuidv4() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16)
    );
}

const API_URL = import.meta.env.VITE_API_URL || 'https://kipu-ruki.onrender.com';

export const simpleRecorder = {
    mediaRecorder: null as MediaRecorder | null,
    recordingId: null as string | null,
    chunkSequence: 0,
    stream: null as MediaStream | null,

    userId: null as string | null,
    organizationId: null as string | null,

    pendingUploads: [] as Promise<void>[],

    async startRecording(onChunk: (data: Blob) => void, userId?: string, organizationId?: string) {
        this.recordingId = uuidv4();
        this.chunkSequence = 0;
        this.userId = userId || null;
        this.organizationId = organizationId || null;
        this.pendingUploads = [];

        try {
            let stream: MediaStream;
            try {
                // Try with advanced constraints first
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (err) {
                console.warn('[SimpleRecorder] Advanced constraints failed, trying basic audio:', err);
                // Fallback to basic audio if advanced constraints fail (common on some iOS/Android devices)
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });
            }
            this.stream = stream;

            // Detect supported MIME type
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4', // iOS 14.5+
                'audio/aac', // iOS fallback
                'audio/ogg;codecs=opus'
            ];

            let mimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            if (!mimeType) {
                console.warn('[SimpleRecorder] No common MIME type supported, letting browser choose default');
                // Empty string lets browser choose default
                mimeType = '';
            }

            console.log(`[SimpleRecorder] Using MIME type: ${mimeType || 'default'}`);

            this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    onChunk(e.data);
                    // Track this upload
                    const uploadPromise = this.sendChunk(e.data, this.mediaRecorder?.mimeType || 'audio/webm')
                        .catch(err => console.error('Chunk upload failed in background:', err));
                    this.pendingUploads.push(uploadPromise);
                }
            };

            // Chunk every 5 seconds
            this.mediaRecorder.start(5000);
            console.log(`[SimpleRecorder] Started ${this.recordingId} for user ${userId}`);

            return this.recordingId;

        } catch (err) {
            console.error('Error starting recording:', err);
            throw err;
        }
    },

    async sendChunk(blob: Blob, mimeType: string = 'audio/webm') {
        if (!this.recordingId) return;

        const sequence = this.chunkSequence++;
        console.log(`[SimpleRecorder] Sending chunk ${sequence} (${blob.size} bytes) type: ${mimeType}`);

        try {
            const headers: Record<string, string> = {
                'Content-Type': mimeType, // Use actual mime type
                'x-chunk-index': sequence.toString()
            };

            if (this.userId) headers['x-user-id'] = this.userId;
            if (this.organizationId) headers['x-organization-id'] = this.organizationId;

            const response = await fetch(`${API_URL}/api/chunks/${this.recordingId}`, {
                method: 'POST',
                headers,
                body: blob
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
        } catch (err) {
            console.error(`[SimpleRecorder] Failed to send chunk ${sequence}`, err);
            // Retry logic could go here
        }
    },

    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                return resolve(null);
            }

            this.mediaRecorder.onstop = async () => {
                // Stop stream
                this.stream?.getTracks().forEach(t => t.stop());

                try {
                    console.log(`[SimpleRecorder] Stopping... Waiting for ${this.pendingUploads.length} chunks to upload...`);

                    // Wait for all pending uploads to finish
                    await Promise.all(this.pendingUploads);

                    console.log(`[SimpleRecorder] All chunks uploaded. Finalizing ${this.recordingId}...`);

                    const response = await fetch(`${API_URL}/api/finalize/${this.recordingId}`, {
                        method: 'POST'
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        if (result.code === 'NO_CHUNKS') {
                            throw new Error('No se subieron fragmentos de audio.');
                        }
                        throw new Error(result.error || 'Error al finalizar');
                    }

                    console.log('[SimpleRecorder] Finalized:', result);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            this.mediaRecorder.stop();
        });
    },

    cancel() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.stream?.getTracks().forEach(t => t.stop());
    }
};
