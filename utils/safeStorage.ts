/**
 * Safe localStorage wrapper
 * Falls back to in-memory storage when localStorage is blocked
 */

// In-memory fallback storage
const memoryStorage: Record<string, string> = {};

// Check if localStorage is available
let localStorageAvailable = false;
try {
    const testKey = '__test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    localStorageAvailable = true;
} catch (e) {
    console.warn('localStorage is not available. Using in-memory storage fallback.');
}

export const safeStorage = {
    getItem(key: string): string | null {
        try {
            if (localStorageAvailable) {
                return localStorage.getItem(key);
            }
            return memoryStorage[key] || null;
        } catch (e) {
            console.error(`Error getting item "${key}":`, e);
            return memoryStorage[key] || null;
        }
    },

    setItem(key: string, value: string): void {
        try {
            if (localStorageAvailable) {
                localStorage.setItem(key, value);
            }
            // Always store in memory as backup
            memoryStorage[key] = value;
        } catch (e) {
            console.error(`Error setting item "${key}":`, e);
            memoryStorage[key] = value;
        }
    },

    removeItem(key: string): void {
        try {
            if (localStorageAvailable) {
                localStorage.removeItem(key);
            }
            delete memoryStorage[key];
        } catch (e) {
            console.error(`Error removing item "${key}":`, e);
            delete memoryStorage[key];
        }
    },

    clear(): void {
        try {
            if (localStorageAvailable) {
                localStorage.clear();
            }
            Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
        } catch (e) {
            console.error('Error clearing storage:', e);
            Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
        }
    }
};
