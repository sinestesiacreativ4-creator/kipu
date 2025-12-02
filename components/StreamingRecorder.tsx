import React, { useState, useRef, useEffect } from 'react';
import { Square, Pause, Play } from 'lucide-react';
import Waveform from './Waveform';
import { RecordingStatus } from '../types';
import { useWakeLock } from '../hooks/useWakeLock';

interface StreamingRecorderProps {
    recordingId: string;
    onComplete: (recordingId: string) => void;
    onCancel: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const StreamingRecorder: React.FC<StreamingRecorderProps> = ({
    recordingId,
    onComplete,
    onCancel
}) => {
    const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.IDLE);
    const [duration, setDuration] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [uploadedChunks, setUploadedChunks] = useState(0);
    const [totalSize, setTotalSize] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunkSequenceRef = useRef(0);
    const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
    const timerRef = useRef<number | null>(null);

    const { requestLock, releaseLock } = useWakeLock();

    // ============================================
    // CHUNK UPLOAD HANDLER (Real-time streaming)
    // ============================================
    // ============================================
    // CHUNK UPLOAD HANDLER (Real-time streaming)
    // ============================================
    const uploadChunk = async (chunk: Blob, sequence: number): Promise<void> => {
        const formData = new FormData();
        // CRITICAL: Metadata MUST come before the file for Multer to process it correctly
        formData.append('fileId', recordingId);
        formData.append('chunkIndex', sequence.toString());
        formData.append('totalChunks', 'unknown'); // Streaming, so total is unknown yet
        formData.append('chunk', chunk, `chunk_${sequence}.webm`);

        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Use new robust endpoint
                const response = await fetch(`${API_URL}/upload/chunk`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
                }

                const result = await response.json();
                console.log(`[StreamingRecorder] Chunk ${sequence} uploaded:`, result);

                setUploadedChunks(prev => prev + 1);
                setTotalSize(prev => prev + chunk.size);
                return; // Success

            } catch (error) {
                console.error(`[StreamingRecorder] Upload attempt ${attempt + 1} failed:`, error);

                if (attempt === maxRetries - 1) {
                    throw error; // Final attempt failed
                }

                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                );
            }
        }
    };

    // ============================================
    // MEDIARECORDER SETUP
    // ============================================
    const startRecording = async () => {
        try {
            // Request Wake Lock
            await requestLock();

            // Get audio stream
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 48000
                }
            });
            streamRef.current = audioStream;
            setStream(audioStream);

            // Determine best MIME type
            const mimeTypes = [
                'audio/webm;codecs=opus',    // Best for most browsers
                'audio/webm',                // Fallback for WebM
                'audio/mp4',                 // Safari iOS
                'audio/ogg;codecs=opus'      // Firefox fallback
            ];

            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            if (!selectedMimeType) {
                throw new Error('No supported audio MIME type found');
            }

            console.log('[StreamingRecorder] Using MIME type:', selectedMimeType);

            // Create MediaRecorder with chunking
            const mediaRecorder = new MediaRecorder(audioStream, {
                mimeType: selectedMimeType,
                audioBitsPerSecond: 64000 // 64kbps = ~480KB/min
            });

            mediaRecorderRef.current = mediaRecorder;
            chunkSequenceRef.current = 0;

            // ============================================
            // CRITICAL: Chunk emission handler
            // ============================================
            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    const sequence = chunkSequenceRef.current++;
                    console.log(`[StreamingRecorder] Chunk ${sequence} captured: ${event.data.size} bytes`);

                    // Queue upload (non-blocking)
                    uploadQueueRef.current = uploadQueueRef.current
                        .then(() => uploadChunk(event.data, sequence))
                        .catch((error) => {
                            console.error(`[StreamingRecorder] Failed to upload chunk ${sequence}:`, error);
                            alert(`Error uploading audio chunk ${sequence}. Please check your connection.`);
                        });

                    // Blob is now uploaded - JavaScript can garbage collect it
                    // No memory accumulation!
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('[StreamingRecorder] MediaRecorder error:', event);
                alert('Recording error occurred');
            };

            // Start recording with 10-second chunks
            // Emits ondataavailable every 10 seconds
            const CHUNK_INTERVAL_MS = 10000; // 10 seconds
            mediaRecorder.start(CHUNK_INTERVAL_MS);
            setStatus(RecordingStatus.RECORDING);
            setDuration(0);
            setUploadedChunks(0);
            setTotalSize(0);

            // Duration timer
            timerRef.current = window.setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            mediaRecorder.onstop = async () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // Stop stream
                streamRef.current?.getTracks().forEach(track => track.stop());
                setStream(null);

                // Wait for all uploads to complete
                console.log('[StreamingRecorder] Waiting for upload queue to finish...');
                await uploadQueueRef.current;

                // Finalize recording on server (Merge chunks)
                try {
                    const response = await fetch(`${API_URL}/upload/merge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileId: recordingId,
                            fileName: `recording-${recordingId}.wav`,
                            totalChunks: chunkSequenceRef.current
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Finalization failed: ${response.status}`);
                    }

                    const result = await response.json();
                    console.log('[StreamingRecorder] Recording finalized:', result);

                    onComplete(recordingId);
                } catch (error) {
                    console.error('[StreamingRecorder] Finalization error:', error);
                    alert('Error finalizing recording. Please try again.');
                } finally {
                    releaseLock();
                }
            };

        } catch (error: any) {
            console.error('[StreamingRecorder] Failed to start recording:', error);
            alert(`Error al acceder al micrófono: ${error.message}`);
            releaseLock();
        }
    };

    // ============================================
    // PAUSE / RESUME / STOP
    // ============================================
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setStatus(RecordingStatus.PAUSED);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setStatus(RecordingStatus.RECORDING);
            timerRef.current = window.setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = () => {
        setStatus(RecordingStatus.COMPLETED);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            releaseLock();
        };
    }, [releaseLock]);

    // Auto-start on mount
    useEffect(() => {
        startRecording();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================
    // UI
    // ============================================
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-3xl mx-auto p-6 animate-fade-in">
            {/* Visual Recording Indicator */}
            {status === RecordingStatus.RECORDING && (
                <div className="mb-4 flex items-center gap-3">
                    <div className="relative">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-red-500 font-semibold text-lg">REC</span>
                </div>
            )}

            {/* Timer Display */}
            <div className="mb-8">
                <div className="flex items-center justify-center gap-2">
                    <div className="flex flex-col items-center">
                        <div className="text-8xl md:text-9xl font-mono font-black text-stone-800 dark:text-white">
                            {Math.floor(duration / 60).toString().padStart(2, '0')}
                        </div>
                        <span className="text-xs font-semibold text-stone-400 uppercase mt-2">
                            Min
                        </span>
                    </div>

                    <div className="text-7xl md:text-8xl font-mono font-black text-stone-400 mb-6">
                        :
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="text-8xl md:text-9xl font-mono font-black text-stone-800 dark:text-white">
                            {(duration % 60).toString().padStart(2, '0')}
                        </div>
                        <span className="text-xs font-semibold text-stone-400 uppercase mt-2">
                            Seg
                        </span>
                    </div>
                </div>

                {/* Duration indicator bar */}
                <div className="mt-6 w-full max-w-md mx-auto">
                    <div className="h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${status === RecordingStatus.RECORDING
                                ? 'bg-gradient-to-r from-primary via-red-500 to-primary animate-pulse'
                                : 'bg-stone-400'
                                }`}
                            style={{
                                width: `${Math.min((duration / (60 * 30)) * 100, 100)}%`
                            }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-stone-400">
                        <span>0:00</span>
                        <span>30:00</span>
                    </div>
                </div>

                {/* Streaming Stats */}
                <div className="mt-4 text-center text-sm text-stone-500">
                    <div>Chunks: {uploadedChunks} | Tamaño: {(totalSize / 1024 / 1024).toFixed(2)} MB</div>
                    <div className="text-xs text-green-600 mt-1">
                        ✓ Streaming en tiempo real - Memoria estable
                    </div>
                </div>
            </div>

            {/* Waveform */}
            <div className="w-full mb-12 bg-white/50 dark:bg-stone-800/50 rounded-2xl overflow-hidden border border-stone-200">
                <Waveform stream={stream} isRecording={status === RecordingStatus.RECORDING} />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 md:gap-8">
                {status === RecordingStatus.RECORDING ? (
                    <button
                        onClick={pauseRecording}
                        className="min-w-[72px] min-h-[72px] p-7 bg-stone-900 text-white rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl"
                    >
                        <Pause size={36} fill="currentColor" />
                    </button>
                ) : status === RecordingStatus.PAUSED ? (
                    <button
                        onClick={resumeRecording}
                        className="min-w-[72px] min-h-[72px] p-7 bg-stone-900 text-white rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl"
                    >
                        <Play size={36} fill="currentColor" />
                    </button>
                ) : null}

                <button
                    onClick={stopRecording}
                    className="min-w-[72px] min-h-[72px] p-7 bg-primary hover:bg-primary-hover text-white rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl flex items-center justify-center"
                    disabled={status === RecordingStatus.COMPLETED}
                >
                    <Square size={36} fill="currentColor" />
                </button>
            </div>

            <div className="mt-8 text-sm text-stone-500 font-medium">
                {status === RecordingStatus.RECORDING ? (
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Grabando en curso...
                    </span>
                ) : status === RecordingStatus.PAUSED ? (
                    <span>Grabación pausada</span>
                ) : status === RecordingStatus.COMPLETED ? (
                    <span>Finalizando...</span>
                ) : null}
            </div>

            <button
                onClick={onCancel}
                className="mt-12 text-stone-400 hover:text-stone-600 underline text-sm"
            >
                Cancelar grabación
            </button>
        </div>
    );
};

export default StreamingRecorder;
