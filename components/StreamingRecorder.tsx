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
    currentUser?: { id: string };
    currentOrg?: { id: string };
}

const StreamingRecorder: React.FC<StreamingRecorderProps> = ({
    recordingId,
    onComplete,
    onCancel,
    currentUser,
    currentOrg
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

            // Pass user and org IDs to simpleRecorder
            await simpleRecorder.startRecording((chunk: Blob) => {
                // Track chunks
                setUploadedChunks(prev => prev + 1);
                setTotalSize(prev => prev + chunk.size);
            }, currentUser?.id, currentOrg?.id);

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
        } catch (error: any) {
            console.error('[StreamingRecorder] Failed to start recording:', error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert('⚠️ Acceso al micrófono denegado.\n\nPor favor ve a:\nConfiguración -> Safari -> Micrófono\ny permite el acceso, o toca el icono "AA" en la barra de dirección -> Configuración del sitio web.');
            } else if (error.name === 'NotFoundError') {
                alert('⚠️ No se encontró ningún micrófono en este dispositivo.');
            } else if (error.name === 'NotReadableError') {
                alert('⚠️ El micrófono está siendo usado por otra aplicación o hay un error de hardware.');
            } else {
                alert(`⚠️ Error al iniciar la grabación: ${error.name || 'Error desconocido'}\n${error.message || ''}`);
            }

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
            <div className="mb-12 relative">
                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center">
                        <div className="text-7xl md:text-9xl font-display font-bold text-stone-900 dark:text-white tracking-tighter tabular-nums">
                            {Math.floor(duration / 60).toString().padStart(2, '0')}
                        </div>
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">
                            Minutos
                        </span>
                    </div>

                    <div className="text-6xl md:text-8xl font-display font-light text-stone-300 dark:text-stone-700 mb-8 animate-pulse">
                        :
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="text-7xl md:text-9xl font-display font-bold text-stone-900 dark:text-white tracking-tighter tabular-nums">
                            {(duration % 60).toString().padStart(2, '0')}
                        </div>
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">
                            Segundos
                        </span>
                    </div>
                </div>

                {/* Streaming Stats Badge */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-full border border-stone-200 dark:border-stone-700">
                    <div className={`w-2 h-2 rounded-full ${status === RecordingStatus.RECORDING ? 'bg-green-500 animate-pulse' : 'bg-stone-400'}`}></div>
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                        {status === RecordingStatus.RECORDING ? 'Grabando en Nube' : 'En Pausa'}
                    </span>
                    <span className="text-[10px] text-stone-300 dark:text-stone-600">|</span>
                    <span className="text-[10px] font-mono text-stone-400">
                        {(totalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                </div>
            </div>

            {/* Waveform */}
            <div className="w-full mb-12 glass p-1 rounded-2xl overflow-hidden">
                <div className="bg-stone-50 dark:bg-stone-900/50 rounded-xl overflow-hidden h-32">
                    <Waveform stream={stream} isRecording={status === RecordingStatus.RECORDING} />
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6 md:gap-10">
                {status === RecordingStatus.RECORDING ? (
                    <button
                        onClick={pauseRecording}
                        className="w-20 h-20 flex items-center justify-center bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl border border-stone-200 dark:border-stone-700"
                    >
                        <Pause size={32} fill="currentColor" />
                    </button>
                ) : status === RecordingStatus.PAUSED ? (
                    <button
                        onClick={resumeRecording}
                        className="w-20 h-20 flex items-center justify-center bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl border border-stone-200 dark:border-stone-700"
                    >
                        <Play size={32} fill="currentColor" className="ml-1" />
                    </button>
                ) : null}

                <button
                    onClick={stopRecording}
                    className="w-24 h-24 flex items-center justify-center bg-primary hover:bg-primary-hover text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/30"
                    disabled={isFinalizing}
                >
                    {isFinalizing ? (
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <Square size={40} fill="currentColor" />
                    )}
                </button>
            </div>

            <div className="mt-8 text-center h-8">
                {isFinalizing && (
                    <div className="animate-fade-in flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-stone-600 dark:text-stone-300">Guardando y procesando...</span>
                        <span className="text-xs text-stone-400">Esto puede tomar unos segundos</span>
                    </div>
                )}
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
