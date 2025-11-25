import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Types
interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: number;
}

interface UserProfile {
    id: string;
    name: string;
    role: string;
    organizationId: string;
    avatarColor: string;
    createdAt: number;
}

interface Recording {
    id: string;
    userId: string;
    organizationId: string;
    audioBase64?: string | null;
    audioKey?: string;
    duration: number;
    createdAt: number;
    status: string;
    markers: any[];
    analysis?: any;
}

// Redis Connection Configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isProduction = process.env.NODE_ENV === 'production';

// Configure Redis options for production (SSL support)
const redisOptions: any = {
    maxRetriesPerRequest: null,
};

// If using rediss:// protocol or in production, enable TLS
if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false // Allow self-signed certs (common in some cloud providers)
    };
}

const redis = new IORedis(redisUrl, redisOptions);

export const redisDb = {
    // =============== ORGANIZATIONS ===============

    async getOrganization(id: string): Promise<Organization | null> {
        try {
            const data = await redis.get(`org:${id}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('[RedisDb] Error getting organization:', error);
            return null;
        }
    },

    async getOrganizationBySlug(slug: string): Promise<Organization | null> {
        try {
            const orgId = await redis.get(`orgSlug:${slug}`);
            if (!orgId) return null;
            return this.getOrganization(orgId);
        } catch (error) {
            console.error('[RedisDb] Error getting organization by slug:', error);
            return null;
        }
    },

    async createOrganization(name: string, slug: string): Promise<Organization> {
        try {
            // Check if slug exists
            const existing = await this.getOrganizationBySlug(slug);
            if (existing) {
                throw new Error('Organization slug already exists');
            }

            const org: Organization = {
                id: uuidv4(),
                name,
                slug,
                createdAt: Date.now()
            };

            await redis.set(`org:${org.id}`, JSON.stringify(org));
            await redis.set(`orgSlug:${slug}`, org.id);

            console.log(`[RedisDb] Organization created: ${org.name} (${org.slug})`);
            return org;
        } catch (error) {
            console.error('[RedisDb] Error creating organization:', error);
            throw error;
        }
    },

    // =============== PROFILES ===============

    async getProfiles(organizationId: string): Promise<UserProfile[]> {
        try {
            const profileIds = await redis.smembers(`orgProfiles:${organizationId}`);
            const profiles: UserProfile[] = [];

            for (const id of profileIds) {
                const data = await redis.get(`profile:${id}`);
                if (data) {
                    profiles.push(JSON.parse(data));
                }
            }

            return profiles.sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.error('[RedisDb] Error getting profiles:', error);
            return [];
        }
    },

    async addProfile(profile: UserProfile): Promise<void> {
        try {
            const profileData = {
                ...profile,
                id: profile.id || uuidv4(),
                createdAt: profile.createdAt || Date.now()
            };

            await redis.set(`profile:${profileData.id}`, JSON.stringify(profileData));
            await redis.sadd(`orgProfiles:${profile.organizationId}`, profileData.id);

            console.log(`[RedisDb] Profile created: ${profileData.name}`);
        } catch (error) {
            console.error('[RedisDb] Error adding profile:', error);
            throw error;
        }
    },

    async deleteProfile(id: string): Promise<void> {
        try {
            const data = await redis.get(`profile:${id}`);
            if (!data) return;

            const profile: UserProfile = JSON.parse(data);

            await redis.del(`profile:${id}`);
            await redis.srem(`orgProfiles:${profile.organizationId}`, id);

            console.log(`[RedisDb] Profile deleted: ${id}`);
        } catch (error) {
            console.error('[RedisDb] Error deleting profile:', error);
            throw error;
        }
    },

    // =============== RECORDINGS ===============

    async getRecordings(userId: string, organizationId: string): Promise<Recording[]> {
        try {
            const recordingIds = await redis.zrevrange(
                `userRecordings:${userId}:${organizationId}`,
                0,
                -1
            );

            const recordings: Recording[] = [];

            for (const id of recordingIds) {
                const data = await redis.get(`recording:${id}`);
                if (data) {
                    const recording = JSON.parse(data);

                    // If audio is stored separately, load it
                    if (recording.audioKey && !recording.audioBase64) {
                        recording.audioBase64 = await redis.get(recording.audioKey);
                    }

                    recordings.push(recording);
                }
            }

            return recordings;
        } catch (error) {
            console.error('[RedisDb] Error getting recordings:', error);
            return [];
        }
    },

    async saveRecording(recording: Recording): Promise<void> {
        try {
            const recordingData = { ...recording };

            // If audio is too large (>1MB), store separately
            if (recordingData.audioBase64 && recordingData.audioBase64.length > 1_000_000) {
                const audioKey = `audio:${recording.id}`;
                await redis.set(audioKey, recordingData.audioBase64);
                await redis.expire(audioKey, 604800); // 7 days TTL

                recordingData.audioKey = audioKey;
                delete recordingData.audioBase64;
            }

            await redis.set(`recording:${recording.id}`, JSON.stringify(recordingData));
            await redis.zadd(
                `userRecordings:${recording.userId}:${recording.organizationId}`,
                recording.createdAt,
                recording.id
            );

            console.log(`[RedisDb] Recording saved: ${recording.id}`);
        } catch (error) {
            console.error('[RedisDb] Error saving recording:', error);
            throw error;
        }
    },

    async updateRecordingAnalysis(id: string, analysis: any, status: string): Promise<void> {
        try {
            const data = await redis.get(`recording:${id}`);
            if (!data) {
                console.warn(`[RedisDb] Recording ${id} not found for update`);
                return;
            }

            const recording = JSON.parse(data);
            recording.analysis = analysis;
            recording.status = status;

            await redis.set(`recording:${id}`, JSON.stringify(recording));
            console.log(`[RedisDb] Recording updated: ${id}`);
        } catch (error) {
            console.error('[RedisDb] Error updating recording analysis:', error);
            throw error;
        }
    },

    async deleteRecording(id: string): Promise<void> {
        try {
            const data = await redis.get(`recording:${id}`);
            if (!data) return;

            const recording: Recording = JSON.parse(data);

            // Delete audio if stored separately
            if (recording.audioKey) {
                await redis.del(recording.audioKey);
            }

            await redis.del(`recording:${id}`);
            await redis.zrem(
                `userRecordings:${recording.userId}:${recording.organizationId}`,
                id
            );

            console.log(`[RedisDb] Recording deleted: ${id}`);
        } catch (error) {
            console.error('[RedisDb] Error deleting recording:', error);
            throw error;
        }
    },

    // =============== UTILITIES ===============

    async healthCheck(): Promise<boolean> {
        try {
            const result = await redis.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('[RedisDb] Health check failed:', error);
            return false;
        }
    },

    // Get raw Redis client for direct operations
    getClient() {
        return redis;
    }
};

redis.on('connect', () => {
    console.log('[RedisDb] Connected to Redis');
});

redis.on('error', (err) => {
    console.error('[RedisDb] Redis error:', err);
});
