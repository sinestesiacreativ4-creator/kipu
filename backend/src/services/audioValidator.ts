import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Audio file validation result
 */
export interface AudioValidation {
    valid: boolean;
    format?: string;
    codec?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    size?: number;
    error?: string;
}

/**
 * Validate audio file using FFprobe
 * CRITICAL: Run this BEFORE FFmpeg processing to prevent crashes
 */
export async function validateAudioFile(filePath: string): Promise<AudioValidation> {
    try {
        // Basic file checks
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'File does not exist' };
        }

        const stats = fs.statSync(filePath);
        
        if (stats.size === 0) {
            return { valid: false, error: 'File is empty (0 bytes)' };
        }

        if (stats.size < 100) {
            return { valid: false, error: `File too small (${stats.size} bytes)` };
        }

        // Use FFprobe to analyze file
        const command = `ffprobe -v error -show_format -show_streams -of json "${filePath}"`;
        
        const { stdout } = await execAsync(command, {
            timeout: 15000, // 15s timeout
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        const probeData = JSON.parse(stdout);

        // Validate has streams
        if (!probeData.streams || probeData.streams.length === 0) {
            return { valid: false, error: 'No streams found in file' };
        }

        // Find audio stream
        const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');
        
        if (!audioStream) {
            return {
                valid: false,
                error: 'No audio stream found (file may be video-only or corrupted)'
            };
        }

        // Extract metadata
        const format = probeData.format?.format_name || 'unknown';
        const codec = audioStream.codec_name || 'unknown';
        const duration = parseFloat(probeData.format?.duration || '0');
        const bitrate = parseInt(probeData.format?.bit_rate || '0');
        const sampleRate = parseInt(audioStream.sample_rate || '0');
        const channels = audioStream.channels || 0;

        // Validation checks
        if (duration === 0) {
            return { valid: false, error: 'Audio duration is 0 seconds' };
        }

        if (duration > 7200) { // 2 hours max
            return {
                valid: false,
                error: `Audio too long (${Math.floor(duration / 60)} minutes, max 120 minutes)`
            };
        }

        console.log(`[AudioValidator] ✓ Valid audio: ${format}/${codec}, ${duration.toFixed(1)}s, ${bitrate} bps`);

        return {
            valid: true,
            format,
            codec,
            duration,
            bitrate,
            sampleRate,
            channels,
            size: stats.size
        };
    } catch (error: any) {
        console.error('[AudioValidator] Validation failed:', error.message);
        
        return {
            valid: false,
            error: `FFprobe failed: ${error.message}`
        };
    }
}

/**
 * Sanitize audio file (convert to safe, standardized format)
 * Use when file is valid but needs normalization
 */
export async function sanitizeAudioFile(
    inputPath: string,
    outputPath: string
): Promise<void> {
    console.log('[AudioValidator] Sanitizing audio file...');

    const command = [
        'ffmpeg',
        '-i', `"${inputPath}"`,
        '-acodec pcm_s16le', // Safe, uncompressed codec
        '-ar 16000', // Standard sample rate for speech
        '-ac 1', // Mono channel
        '-f wav', // WAV format (most compatible)
        '-y', // Overwrite
        `"${outputPath}"`
    ].join(' ');

    try {
        await execAsync(command, {
            timeout: 120000, // 2 minutes max
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        });

        console.log('[AudioValidator] ✓ Sanitization complete');
    } catch (error: any) {
        console.error('[AudioValidator] Sanitization failed:', error.message);
        throw new Error(`Failed to sanitize audio: ${error.message}`);
    }
}

/**
 * Quick file format check (lighter than full validation)
 */
export function quickFormatCheck(filePath: string): { valid: boolean; error?: string } {
    try {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'File not found' };
        }

        const buffer = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 12, 0);
        fs.closeSync(fd);

        // Check for common audio file signatures
        const signatures = {
            webm: [0x1a, 0x45, 0xdf, 0xa3], // EBML (WebM)
            mp4: [0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70], // ftyp
            mp3: [0xff, 0xfb], // MP3 frame sync (approximate)
            wav: [0x52, 0x49, 0x46, 0x46], // RIFF
            ogg: [0x4f, 0x67, 0x67, 0x53] // OggS
        };

        for (const [format, sig] of Object.entries(signatures)) {
            let match = true;
            for (let i = 0; i < sig.length; i++) {
                if (sig[i] !== null && buffer[i] !== sig[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                console.log(`[AudioValidator] Quick check: ${format} format detected`);
                return { valid: true };
            }
        }

        return { valid: false, error: 'Unknown file format (header check failed)' };
    } catch (error: any) {
        return { valid: false, error: error.message };
    }
}
