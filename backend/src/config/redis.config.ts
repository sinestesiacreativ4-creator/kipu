import IORedis from 'ioredis';

/**
 * Production-grade Redis client factory
 * Includes health checks and eviction policy validation
 */
export function createRedisClient(): IORedis {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('[Redis] Connecting to:', redisUrl.replace(/:[^:]*@/, ':****@')); // Hide password

    const options: any = {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: true,
        connectTimeout: 10000,
        lazyConnect: false,
        retryStrategy: (times: number) => {
            if (times > 10) {
                console.error('[Redis] Max retries (10) reached, giving up');
                return null;
            }
            const delay = Math.min(times * 200, 3000);
            console.log(`[Redis] Retry attempt ${times}/10 in ${delay}ms`);
            return delay;
        }
    };

    // TLS for Upstash/Redis Cloud
    if (redisUrl.startsWith('rediss://')) {
        options.tls = {
            rejectUnauthorized: false
        };
        console.log('[Redis] Using TLS connection');
    }

    const redis = new IORedis(redisUrl, options);

    // Event handlers
    redis.on('connect', () => {
        console.log('[Redis] ✓ Connected successfully');
        validateRedisConfig(redis);
    });

    redis.on('ready', () => {
        console.log('[Redis] ✓ Ready for operations');
    });

    redis.on('error', (err) => {
        console.error('[Redis] ✗ Error:', err.message);
    });

    redis.on('close', () => {
        console.warn('[Redis] Connection closed');
    });

    redis.on('reconnecting', (delay) => {
        console.log(`[Redis] Reconnecting in ${delay}ms...`);
    });

    return redis;
}

/**
 * Validate Redis configuration for production
 */
async function validateRedisConfig(redis: IORedis): Promise<void> {
    try {
        // Check eviction policy
        const policyResult = await redis.config('GET', 'maxmemory-policy');
        const policy = policyResult?.[1];

        if (policy !== 'noeviction') {
            console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.warn('[Redis] ⚠️  WARNING: Eviction policy mismatch!');
            console.warn(`[Redis] Current: "${policy}"`);
            console.warn(`[Redis] Required: "noeviction"`);
            console.warn('[Redis] This can cause queue data loss!');
            console.warn('[Redis]');
            console.warn('[Redis] FIX: Run this command:');
            console.warn('[Redis]   redis-cli CONFIG SET maxmemory-policy noeviction');
            console.warn('[Redis]   redis-cli CONFIG REWRITE');
            console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
            console.log('[Redis] ✓ Eviction policy: noeviction (correct)');
        }

        // Check memory limit
        const maxmemoryResult = await redis.config('GET', 'maxmemory');
        const maxmemory = parseInt(maxmemoryResult?.[1] || '0');

        if (maxmemory === 0) {
            console.warn('[Redis] ⚠️  No memory limit set (maxmemory: 0)');
        } else {
            const maxmemoryGB = (maxmemory / 1024 / 1024 / 1024).toFixed(2);
            console.log(`[Redis] ✓ Memory limit: ${maxmemoryGB}GB`);
        }

        // Check persistence
        const aofResult = await redis.config('GET', 'appendonly');
        const aofEnabled = aofResult?.[1] === 'yes';

        if (!aofEnabled) {
            console.warn('[Redis] ⚠️  AOF persistence disabled (data loss risk on crash)');
        } else {
            console.log('[Redis] ✓ AOF persistence: enabled');
        }

    } catch (error) {
        console.warn('[Redis] Could not validate configuration:', error);
    }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(redis: IORedis): Promise<boolean> {
    try {
        const pong = await redis.ping();
        return pong === 'PONG';
    } catch (error) {
        console.error('[Redis] Health check failed:', error);
        return false;
    }
}

/**
 * Graceful shutdown
 */
export async function closeRedisConnection(redis: IORedis): Promise<void> {
    try {
        console.log('[Redis] Closing connection...');
        await redis.quit();
        console.log('[Redis] ✓ Connection closed gracefully');
    } catch (error) {
        console.error('[Redis] Error during shutdown:', error);
        redis.disconnect();
    }
}
