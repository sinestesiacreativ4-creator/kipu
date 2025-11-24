import { UserProfile, Recording } from '../types';

const STORAGE_PREFIX = 'AsesoriasEtnicas_';
const KEYS = {
  PROFILES: `${STORAGE_PREFIX}profiles`,
  RECORDINGS: `${STORAGE_PREFIX}recordings`,
  TEST_KEY: `${STORAGE_PREFIX}test`,
};

// Helper to simulate async delay to match the Promise interface
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Check if localStorage is available and working
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = KEYS.TEST_KEY;
    localStorage.setItem(testKey, 'test');
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    return result === 'test';
  } catch {
    return false;
  }
};

// Show warning if localStorage is not working
const checkStorageAvailability = () => {
  if (!isLocalStorageAvailable()) {
    alert('⚠️ ADVERTENCIA: El almacenamiento local no está disponible.\n\n' +
      'Tus grabaciones NO se guardarán. Esto puede ocurrir si:\n' +
      '• Estás en modo incógnito/privado\n' +
      '• El navegador bloqueó el almacenamiento\n' +
      '• No hay espacio disponible\n\n' +
      'Por favor, usa el navegador en modo normal.');
    return false;
  }
  return true;
};

export const db = {
  async getProfiles(): Promise<UserProfile[]> {
    await delay(50);
    try {
      const data = localStorage.getItem(KEYS.PROFILES);
      console.log('[DB] Loading profiles:', data ? 'found' : 'empty');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading profiles from localStorage:", error);
      return [];
    }
  },

  async addProfile(profile: UserProfile): Promise<void> {
    await delay(50);
    if (!checkStorageAvailability()) return;

    try {
      const profiles = await this.getProfiles();
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index >= 0) {
        profiles[index] = profile;
      } else {
        profiles.push(profile);
      }
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles));
      console.log('[DB] Saved profile:', profile.name);
    } catch (error) {
      console.error("Error saving profile to localStorage:", error);
      throw error;
    }
  },

  async getRecordings(userId: string): Promise<Recording[]> {
    await delay(50);
    try {
      const data = localStorage.getItem(KEYS.RECORDINGS);
      const allRecordings: Recording[] = data ? JSON.parse(data) : [];
      console.log('[DB] Loading recordings for user:', userId, '- found:', allRecordings.filter(r => r.userId === userId).length);

      return allRecordings
        .filter(r => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error("Error reading recordings from localStorage:", error);
      return [];
    }
  },

  async saveRecording(recording: Recording): Promise<void> {
    await delay(50);
    if (!checkStorageAvailability()) {
      throw new Error('LocalStorage not available');
    }

    try {
      const data = localStorage.getItem(KEYS.RECORDINGS);
      const allRecordings: Recording[] = data ? JSON.parse(data) : [];

      const index = allRecordings.findIndex(r => r.id === recording.id);
      if (index >= 0) {
        allRecordings[index] = recording;
      } else {
        allRecordings.push(recording);
      }

      localStorage.setItem(KEYS.RECORDINGS, JSON.stringify(allRecordings));
      console.log('[DB] Saved recording:', recording.id, '- total:', allRecordings.length);

      // Verify it was saved
      const verify = localStorage.getItem(KEYS.RECORDINGS);
      if (!verify) {
        throw new Error('Failed to verify recording save');
      }
    } catch (error) {
      console.error("Error saving recording to localStorage:", error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        alert("¡Espacio lleno! LocalStorage tiene un límite de ~5MB. Intenta borrar grabaciones antiguas.");
      }
      throw error;
    }
  },

  async deleteRecording(id: string): Promise<void> {
    await delay(50);
    try {
      const data = localStorage.getItem(KEYS.RECORDINGS);
      let allRecordings: Recording[] = data ? JSON.parse(data) : [];

      allRecordings = allRecordings.filter(r => r.id !== id);

      localStorage.setItem(KEYS.RECORDINGS, JSON.stringify(allRecordings));
      console.log('[DB] Deleted recording:', id, '- remaining:', allRecordings.length);
    } catch (error) {
      console.error("Error deleting recording from localStorage:", error);
      throw error;
    }
  }
};