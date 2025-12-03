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

    async startRecording(onChunk: (data: Blob) => void) {
        this.recordingId = uuidv4();
        this.chunkSequence = 0;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            this.stream = stream;

            // Prefer webm/opus
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
            }

            this.mediaRecorder = new MediaRecorder(stream, { mimeType });

            this.mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    onChunk(e.data);
                    await this.sendChunk(e.data);
                }
            };

            // Chunk every 5 seconds
            this.mediaRecorder.start(5000);
            console.log(`[SimpleRecorder] Started ${this.recordingId}`);

            return this.recordingId;

        } catch (err) {
            console.error('Error starting recording:', err);
            throw err;
        }
    },

    async sendChunk(blob: Blob) {
        if (!this.recordingId) return;

        const sequence = this.chunkSequence++;
        console.log(`[SimpleRecorder] Sending chunk ${sequence} (${blob.size} bytes)`);

        try {
            const response = await fetch(`${API_URL}/api/chunks/${this.recordingId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'video/webm',
                    'x-chunk-index': sequence.toString()
                },
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
                    console.log(`[SimpleRecorder] Finalizing ${this.recordingId}...`);
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
