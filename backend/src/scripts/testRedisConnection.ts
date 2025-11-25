import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testConnection() {
    console.log('--- Redis Connection Test ---');

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ REDIS_URL is not defined in .env');
        process.exit(1);
    }

    // Mask password for display
    const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`Target URL: ${maskedUrl}`);

    if (redisUrl.includes('localhost')) {
        console.warn('⚠️ WARNING: REDIS_URL points to localhost. This is NOT the remote instance.');
    } else {
        console.log('✅ REDIS_URL points to a remote instance.');
    }

    console.log('Connecting...');

    const redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
    });

    try {
        await new Promise((resolve, reject) => {
            redis.on('connect', () => {
                console.log('✅ Connected to Redis!');
                resolve(true);
            });
            redis.on('error', (err) => {
                console.error('❌ Connection Error:', err.message);
                reject(err);
            });
        });

        const pingResult = await redis.ping();
        console.log(`✅ PING response: ${pingResult}`);

        const info = await redis.info();
        console.log(`✅ Redis Info retrieved (Server version: ${info.match(/redis_version:([\d.]+)/)?.[1]})`);

    } catch (error) {
        console.error('❌ Failed to connect or ping Redis.');
    } finally {
        redis.disconnect();
        console.log('--- Test Complete ---');
    }
}

testConnection();
