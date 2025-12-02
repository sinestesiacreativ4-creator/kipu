import { useRef, useCallback } from 'react';

export const useWakeLock = () => {
    const wakeLock = useRef<WakeLockSentinel | null>(null);

    const requestLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLock.current = await navigator.wakeLock.request('screen');
                console.log('Wake Lock is active');
            }
        } catch (err: any) {
            console.error(`${err.name}, ${err.message}`);
        }
    }, []);

    const releaseLock = useCallback(async () => {
        if (wakeLock.current) {
            try {
                await wakeLock.current.release();
                wakeLock.current = null;
                console.log('Wake Lock released');
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    }, []);

    return { requestLock, releaseLock };
};
