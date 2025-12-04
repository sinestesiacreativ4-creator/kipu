import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    isPlaying: boolean;
    isListening: boolean;
    volume?: number; // 0 to 1
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, isListening, volume = 0 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        let phase = 0;

        const draw = () => {
            const width = rect.width;
            const height = rect.height;
            const centerY = height / 2;

            ctx.clearRect(0, 0, width, height);

            // Determine active state and color
            const isActive = isPlaying || isListening;
            const baseColor = isPlaying
                ? 'rgb(59, 130, 246)' // Blue for AI
                : isListening
                    ? 'rgb(239, 68, 68)' // Red for User
                    : 'rgb(156, 163, 175)'; // Gray for idle

            if (!isActive) {
                // Draw flat line
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.strokeStyle = 'rgba(156, 163, 175, 0.2)';
                ctx.lineWidth = 2;
                ctx.stroke();
                return;
            }

            // Draw waveform
            ctx.beginPath();
            ctx.moveTo(0, centerY);

            const amplitude = isActive ? (volume * 50) + 10 : 0;
            const frequency = 0.1;
            const speed = 0.2;

            phase += speed;

            for (let x = 0; x < width; x++) {
                // Combine multiple sine waves for organic look
                const y = centerY +
                    Math.sin(x * frequency + phase) * amplitude * Math.sin(x / width * Math.PI) +
                    Math.sin(x * frequency * 2 + phase * 1.5) * (amplitude / 2) * Math.sin(x / width * Math.PI);

                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = baseColor;
            ctx.stroke();

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, isListening, volume]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-24 rounded-xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800"
        />
    );
};

export default AudioVisualizer;
