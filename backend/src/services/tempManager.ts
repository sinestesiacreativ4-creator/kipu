import fs from 'fs';
import path from 'path';
import { TEMP_FOLDERS } from '../config/upload.config';

/**
 * Enterprise temp folder management
 * Auto-cleanup, validation, safe deletion
 */
export class TempManager {
    /**
     * Cleanup files older than specified age
     */
    static async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;
        let totalDeleted = 0;

        console.log(`[TempManager] Running cleanup (max age: ${maxAgeHours}h)...`);

        for (const [name, folder] of Object.entries(TEMP_FOLDERS)) {
            if (!fs.existsSync(folder)) {
                console.log(`[TempManager] Skipping ${name} (doesn't exist)`);
                continue;
            }

            try {
                const files = fs.readdirSync(folder);
                let deleted = 0;

                for (const file of files) {
                    const filePath = path.join(folder, file);

                    try {
                        const stats = fs.statSync(filePath);

                        if (now - stats.mtimeMs > maxAge) {
                            fs.unlinkSync(filePath);
                            deleted++;
                        }
                    } catch (fileError) {
                        console.warn(`[TempManager] Could not process ${file}:`, fileError);
                    }
                }

                if (deleted > 0) {
                    console.log(`[TempManager] ✓ ${name}: deleted ${deleted} old file(s)`);
                    totalDeleted += deleted;
                }
            } catch (error) {
                console.error(`[TempManager] Error cleaning ${name}:`, error);
            }
        }

        if (totalDeleted === 0) {
            console.log('[TempManager] ✓ No old files to delete');
        } else {
            console.log(`[TempManager] ✓ Total deleted: ${totalDeleted} file(s)`);
        }
    }

    /**
     * Get validated temp file path
     */
    static getTempPath(folder: keyof typeof TEMP_FOLDERS, filename: string): string {
        const folderPath = TEMP_FOLDERS[folder];

        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
            console.log(`[TempManager] Creating missing folder: ${folder}`);
            fs.mkdirSync(folderPath, { recursive: true, mode: 0o755 });
        }

        // Sanitize filename
        const sanitized = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        return path.join(folderPath, sanitized);
    }

    /**
     * Safe file deletion with retries
     */
    static async safeDelete(filePath: string, retries: number = 3): Promise<boolean> {
        if (!filePath || !fs.existsSync(filePath)) {
            return true; // Already gone
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                fs.unlinkSync(filePath);
                console.log(`[TempManager] ✓ Deleted: ${path.basename(filePath)}`);
                return true;
            } catch (error: any) {
                if (attempt === retries - 1) {
                    console.error(
                        `[TempManager] ✗ Failed to delete ${path.basename(filePath)} after ${retries} attempts:`,
                        error.message
                    );
                    return false;
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
                }
            }
        }

        return false;
    }

    /**
     * Get folder disk usage
     */
    static async getFolderSize(folder: keyof typeof TEMP_FOLDERS): Promise<number> {
        const folderPath = TEMP_FOLDERS[folder];

        if (!fs.existsSync(folderPath)) {
            return 0;
        }

        let totalSize = 0;

        try {
            const files = fs.readdirSync(folderPath);

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                try {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                } catch {
                    // Skip files we can't read
                }
            }
        } catch (error) {
            console.error(`[TempManager] Error calculating size for ${folder}:`, error);
        }

        return totalSize;
    }

    /**
     * Get diagnostics for all temp folders
     */
    static async getDiagnostics(): Promise<Record<string, any>> {
        const diagnostics: Record<string, any> = {};

        for (const [name, folder] of Object.entries(TEMP_FOLDERS)) {
            try {
                const exists = fs.existsSync(folder);

                if (!exists) {
                    diagnostics[name] = { exists: false };
                    continue;
                }

                const files = fs.readdirSync(folder);
                const size = await TempManager.getFolderSize(name as keyof typeof TEMP_FOLDERS);

                diagnostics[name] = {
                    exists: true,
                    path: folder,
                    fileCount: files.length,
                    sizeBytes: size,
                    sizeMB: (size / 1024 / 1024).toFixed(2)
                };
            } catch (error) {
                diagnostics[name] = {
                    exists: false,
                    error: (error as Error).message
                };
            }
        }

        return diagnostics;
    }
    /**
     * Auto-cleanup job
     * Runs every hour to clean old temp files
     */
    private static cleanupInterval: NodeJS.Timeout | null = null;

    static startAutoCleanup(intervalHours: number = 1): void {
        if (TempManager.cleanupInterval) {
            console.log('[TempManager] Auto-cleanup already running');
            return;
        }

        console.log(`[TempManager] Starting auto-cleanup (every ${intervalHours}h)`);

        // Run immediately
        TempManager.cleanupOldFiles();

        // Then schedule
        TempManager.cleanupInterval = setInterval(() => {
            TempManager.cleanupOldFiles();
        }, intervalHours * 60 * 60 * 1000);
    }

    static stopAutoCleanup(): void {
        if (TempManager.cleanupInterval) {
            clearInterval(TempManager.cleanupInterval);
            TempManager.cleanupInterval = null;
            console.log('[TempManager] Auto-cleanup stopped');
        }
    }
}
