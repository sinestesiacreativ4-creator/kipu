import { useState, useEffect, useCallback, useRef } from 'react';

export const useWakeLock = () => {
    const [isLocked, setIsLocked] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Tiny silent video for iOS fallback
    // 1x1 pixel black silent mp4
    const NO_SLEEP_VIDEO = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAsdtZGF0AAAC...'; // Truncated for brevity, will use a real one or generate a simple one.
    // Actually, let's use a proper minimal valid base64 for a silent video.
    // This is a very small valid MP4 file (silent, black)
    const SILENT_VIDEO_BASE64 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoAAAAAgAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABudHJhYwAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAABtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAAABAAAAAAAAYWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAAB2aWRlb2hhbmRsZXIAAAAAZnZpbmYAAAAQZGluZgAAAAx1cmwgAAAAAQAAAFRzdGJsAAAAQHN0c2QAAAAAAAAAAQAAADRhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAAAAAABAAAAAAAAAAAAAAABc3R0cwAAAAAAAAABAAAAAQAAAAAAAAAoc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAAQAAAAAAAAA0c3RzegAAAAAAAAAAAAAAAQAAABBzdGNvAAAAAAAAAAEAAAAM';

    const requestLock = useCallback(async () => {
        try {
            // 1. Try Native Wake Lock API
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => {
                    console.log('[WakeLock] Lock released');
                    setIsLocked(false);
                });
                console.log('[WakeLock] Native lock acquired');
            }

            // 2. iOS Video Fallback (Always run this as backup/primary for iOS)
            if (!videoRef.current) {
                const video = document.createElement('video');
                video.setAttribute('playsinline', '');
                video.setAttribute('no-fullscreen', '');
                video.setAttribute('loop', '');
                video.src = SILENT_VIDEO_BASE64;
                video.style.display = 'none'; // Hidden but active
                videoRef.current = video;
                document.body.appendChild(video);
            }

            // Play must be triggered by user interaction (which this function usually is)
            await videoRef.current.play().catch(e => console.warn('[WakeLock] Video play failed:', e));
            console.log('[WakeLock] Fallback video playing');

            setIsLocked(true);
        } catch (err) {
            console.error('[WakeLock] Failed to acquire lock:', err);
            setIsLocked(false);
        }
    }, []);

    const releaseLock = useCallback(async () => {
        // 1. Release Native Lock
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err) {
                console.error('[WakeLock] Failed to release native lock:', err);
            }
        }

        // 2. Stop Video Fallback
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.src = '';
            if (videoRef.current.parentNode) {
                videoRef.current.parentNode.removeChild(videoRef.current);
            }
            videoRef.current = null;
        }

        setIsLocked(false);
        console.log('[WakeLock] Lock released manually');
    }, []);

    // Re-acquire lock when visibility changes (tab switch/screen off/on)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isLocked) {
                console.log('[WakeLock] App visible again, re-acquiring lock...');
                await requestLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isLocked, requestLock]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseLock();
        };
    }, [releaseLock]);

    return { isLocked, requestLock, releaseLock };
};
