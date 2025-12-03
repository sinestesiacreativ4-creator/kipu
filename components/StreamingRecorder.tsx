import React, { useState, useRef, useEffect } from 'react';
import { Square, Pause, Play } from 'lucide-react';
import Waveform from './Waveform';
import { RecordingStatus } from '../types';
import { useWakeLock } from '../hooks/useWakeLock';
import { simpleRecorder } from '../services/simpleRecorder';

interface StreamingRecorderProps {
    recordingId: string;
    onComplete: (recordingId: string) => void;
    onCancel: () => void;
}

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
    const [isFinalizing, setIsFinalizing] = useState(false);

    const timerRef = useRef<number | null>(null);
    const { requestLock, releaseLock } = useWakeLock();

    // Start recording on mount
    useEffect(() => {
        startRecording();
        return () => {
            // Cleanup on unmount
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            simpleRecorder.cancel();
            releaseLock();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startRecording = async () => {
        try {
            await requestLock();

            await simpleRecorder.startRecording((chunk: Blob) => {
                // Track chunks
                setUploadedChunks(prev => prev + 1);
                setTotalSize(prev => prev + chunk.size);
            });

            // Get the stream for waveform
            if (simpleRecorder.stream) {
                setStream(simpleRecorder.stream);
            }

            setStatus(RecordingStatus.RECORDING);

            // Start timer
            timerRef.current = window.setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            console.log('[StreamingRecorder] Recording started');
        } catch (error) {
            console.error('[StreamingRecorder] Failed to start recording:', error);
            alert('Error al iniciar la grabación. Por favor verifica los permisos del micrófono.');
            onCancel();
        }
    };

    const pauseRecording = () => {
        if (simpleRecorder.mediaRecorder && simpleRecorder.mediaRecorder.state === 'recording') {
            simpleRecorder.mediaRecorder.pause();
            setStatus(RecordingStatus.PAUSED);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const resumeRecording = () => {
        if (simpleRecorder.mediaRecorder && simpleRecorder.mediaRecorder.state === 'paused') {
            simpleRecorder.mediaRecorder.resume();
            setStatus(RecordingStatus.RECORDING);
            timerRef.current = window.setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = async () => {
        try {
            setIsFinalizing(true);
            setStatus(RecordingStatus.COMPLETED);

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            console.log('[StreamingRecorder] Stopping recording...');
            const result = await simpleRecorder.stopRecording();

            console.log('[StreamingRecorder] Recording stopped and finalized:', result);

            releaseLock();
            onComplete(simpleRecorder.recordingId || recordingId);
        } catch (error: any) {
            console.error('[StreamingRecorder] Error stopping recording:', error);
            alert(`Error al finalizar la grabación: ${error.message}`);
            setIsFinalizing(false);
            setStatus(RecordingStatus.ERROR);
        }
    };

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
                    disabled={isFinalizing}
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
                ) : status === RecordingStatus.COMPLETED || isFinalizing ? (
                    <span>Finalizando...</span>
                ) : null}
            </div>

            <button
                onClick={onCancel}
                className="mt-12 text-stone-400 hover:text-stone-600 underline text-sm"
                disabled={isFinalizing}
            >
                Cancelar grabación
            </button>
        </div>
    );
};

export default StreamingRecorder;
