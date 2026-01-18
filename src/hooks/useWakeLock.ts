import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to keep the screen awake using either the standard Wake Lock API
 * or the Bluefy browser specific API.
 */
export const useWakeLock = (enabled: boolean = true) => {
    const [isLocked, setIsLocked] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    const requestWakeLock = useCallback(async () => {
        if (!enabled) return;

        // 1. Try Bluefy API
        // Bluefy: setScreenDimEnabled(enabled: boolean)
        // Based on docs/screenshot: "Allows webapp developers to manage device's display dimming preferences."
        // Usually pass `false` to disable dimming (keep awake).
        if (window.navigator?.bluetooth?.setScreenDimEnabled) {
            try {
                window.navigator.bluetooth.setScreenDimEnabled(false);
                setIsLocked(true);
                console.log('Bluefy WakeLock active');
                return;
            } catch (err) {
                console.warn('Failed to set Bluefy screen dimming:', err);
            }
        }

        // 2. Try Standard Wake Lock API
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                wakeLockRef.current = wakeLock;
                setIsLocked(true);
                console.log('Standard WakeLock active');

                wakeLock.addEventListener('release', () => {
                    setIsLocked(false);
                    console.log('Standard WakeLock released');
                });
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.warn('Failed to request Wake Lock:', err);
                }
            }
        }
    }, [enabled]);

    const releaseWakeLock = useCallback(async () => {
        // 1. Release Bluefy
        if (window.navigator?.bluetooth?.setScreenDimEnabled) {
            try {
                window.navigator.bluetooth.setScreenDimEnabled(true); // Re-enable dimming
                console.log('Bluefy WakeLock released');
            } catch (err) {
                console.warn('Failed to reset Bluefy screen dimming:', err);
            }
        }

        // 2. Release Standard
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err) {
                console.warn('Failed to release Wake Lock:', err);
            }
        }
        setIsLocked(false);
    }, []);

    useEffect(() => {
        if (enabled) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        // Re-request wake lock when page visibility changes (standard API behavior)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && enabled && !window.navigator?.bluetooth?.setScreenDimEnabled) {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, requestWakeLock, releaseWakeLock]);

    return { isLocked };
};
