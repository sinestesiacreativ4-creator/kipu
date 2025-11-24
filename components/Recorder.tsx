import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Square, Pause, Play, Flag } from 'lucide-react';
import Waveform from './Waveform';
import { RecordingStatus, Marker } from '../types';
import { formatTime } from '../utils';

interface RecorderProps {
  onComplete: (blob: Blob, duration: number, markers: Marker[]) => void;
  onCancel: () => void;
}

const Recorder: React.FC<RecorderProps> = ({ onComplete, onCancel }) => {
  const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.IDLE);
  const [duration, setDuration] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentChunksRef = useRef<Blob[]>([]);
  const completedSegmentsRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const SEGMENT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  const startNewSegment = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("Starting new segment...");
      mediaRecorderRef.current.stop();
      // The onstop handler will trigger, save the segment, and restart if status is still RECORDING
    }
  };

  const startRecording = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      // Determinar el mejor mimeType soportado
      let options: MediaRecorderOptions | undefined = undefined;

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4', audioBitsPerSecond: 64000 }; // Safari/iOS
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        options = { mimeType: 'audio/aac', audioBitsPerSecond: 64000 };
      }
      // Si ninguno es soportado explícitamente, dejar undefined para que el navegador elija el default

      console.log("Using MediaRecorder options:", options);

      const mediaRecorder = new MediaRecorder(audioStream, options);
      mediaRecorderRef.current = mediaRecorder;
      currentChunksRef.current = [];
      completedSegmentsRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          currentChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const segmentBlob = new Blob(currentChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (segmentBlob.size > 0) {
          completedSegmentsRef.current.push(segmentBlob);
          console.log(`Segment saved. Size: ${segmentBlob.size}, Total segments: ${completedSegmentsRef.current.length}`);
        }
        currentChunksRef.current = [];

        // If we are still in RECORDING state (meaning this was an auto-restart), start again
        if (status === RecordingStatus.RECORDING) {
          mediaRecorder.start();
        }
      };

      mediaRecorder.start();
      setStatus(RecordingStatus.RECORDING);
      setShowWarning(false);

      // Global Duration Timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Segment Timer (Restart recorder every X minutes)
      segmentTimerRef.current = window.setInterval(startNewSegment, SEGMENT_DURATION_MS);

    } catch (error: any) {
      console.error("Error accessing microphone:", error);
      alert(`Error al acceder al micrófono: ${error.message}.`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus(RecordingStatus.PAUSED);
      if (timerRef.current) clearInterval(timerRef.current);
      if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus(RecordingStatus.RECORDING);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      segmentTimerRef.current = window.setInterval(startNewSegment, SEGMENT_DURATION_MS);
    }
  };

  const stopRecording = useCallback(() => {
    // We need to set status to COMPLETED *before* stopping so onstop knows not to restart
    setStatus(RecordingStatus.COMPLETED);

    if (mediaRecorderRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);

      // If paused, we need to resume briefly to stop correctly
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setTimeout(() => {
          if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
        }, 100);
      } else {
        mediaRecorderRef.current.stop();
      }

      // Define a one-time onstop for the FINAL stop
      mediaRecorderRef.current.onstop = async () => {
        console.log('[Recorder] Stopping... Processing segments:', completedSegmentsRef.current.length);

        // Add final segment
        const segmentBlob = new Blob(currentChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        if (segmentBlob.size > 0) {
          completedSegmentsRef.current.push(segmentBlob);
        }

        // Clean up stream
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);

        // For long recordings, use a more efficient approach
        // Instead of combining all segments into one blob (which freezes the UI),
        // we pass the segments array directly
        console.log('[Recorder] Total segments:', completedSegmentsRef.current.length);
        console.log('[Recorder] Total size:', completedSegmentsRef.current.reduce((sum, seg) => sum + seg.size, 0), 'bytes');

        // Create a minimal combined blob for compatibility
        // but attach the segments for efficient processing
        const fullBlob = new Blob(completedSegmentsRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        (fullBlob as any).segments = completedSegmentsRef.current;

        console.log('[Recorder] Calling onComplete...');
        onComplete(fullBlob, duration, markers);
      };
    }
  }, [duration, markers, onComplete, stream]);

  const addMarker = () => {
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    setMarkers([...markers, {
      id: Date.now().toString(),
      timestamp: duration,
      label: `Marca en ${formatTime(duration)}`
    }]);
  };

  const handleButtonPress = (action: () => void) => {
    // Haptic feedback on all button presses
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    action();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial start
  useEffect(() => {
    startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="text-7xl md:text-8xl font-mono font-bold text-stone-800 dark:text-stone-100 mb-6 tracking-tighter tabular-nums drop-shadow-sm">
        {formatTime(duration)}
      </div>

      {/* Waveform Visualization */}
      <div className="w-full mb-12 bg-white/50 dark:bg-stone-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-inner relative">
        {status === RecordingStatus.RECORDING && (
          <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center opacity-10">
            <div className="w-32 h-32 bg-primary rounded-full animate-ping"></div>
          </div>
        )}
        <div className="relative z-10">
          <Waveform stream={stream} isRecording={status === RecordingStatus.RECORDING} />
        </div>
      </div>

      {/* Controls Container - Mobile Optimized */}
      <div className="flex items-center gap-4 md:gap-8">

        {/* Marker Button - Larger touch target */}
        <button
          onClick={() => handleButtonPress(addMarker)}
          disabled={status !== RecordingStatus.RECORDING}
          className={`min-w-[56px] min-h-[56px] p-4 rounded-full transition-all duration-200 border-2 active:scale-95 ${status === RecordingStatus.RECORDING
            ? 'border-stone-300 text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-700'
            : 'border-stone-200 text-stone-300 cursor-not-allowed opacity-50'
            }`}
          title="Agregar Marcador (Bandera)"
        >
          <Flag size={28} />
        </button>

        {/* Play/Pause/Stop Controls - Premium mobile touch targets */}
        {status === RecordingStatus.RECORDING ? (
          <button
            onClick={() => handleButtonPress(pauseRecording)}
            className="min-w-[72px] min-h-[72px] p-7 bg-stone-900 dark:bg-white text-white dark:text-black rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl"
          >
            <Pause size={36} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => handleButtonPress(resumeRecording)}
            className="min-w-[72px] min-h-[72px] p-7 bg-stone-900 dark:bg-white text-white dark:text-black rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl"
          >
            <Play size={36} fill="currentColor" />
          </button>
        )}

        <button
          onClick={() => handleButtonPress(stopRecording)}
          className="min-w-[72px] min-h-[72px] p-7 bg-primary hover:bg-primary-hover text-white rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-primary/30 flex items-center justify-center"
          title="Finalizar y Guardar"
        >
          <Square size={36} fill="currentColor" />
        </button>

      </div>

      <div className="mt-8 text-sm text-stone-500 dark:text-stone-400 font-medium">
        {status === RecordingStatus.RECORDING ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Grabando en curso...
          </span>
        ) : (
          <span>Grabación pausada</span>
        )}
      </div>

      {/* Markers List Preview */}
      {markers.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {markers.map(m => (
            <span key={m.id} className="px-3 py-1 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs rounded-full flex items-center gap-1 border border-stone-300 dark:border-stone-600">
              <Flag size={10} /> {formatTime(m.timestamp)}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onCancel}
        className="mt-12 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 underline text-sm"
      >
        Cancelar grabación
      </button>
    </div>
  );
};

export default Recorder;