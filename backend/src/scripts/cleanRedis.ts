import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

async function cleanRedis() {
    try {
        console.log('--- Cleaning Redis ---');

        // 1. Delete all recordings
        const recordingKeys = await redis.keys('recording:*');
        console.log(`Found ${recordingKeys.length} recording keys`);
        if (recordingKeys.length > 0) {
            await redis.del(...recordingKeys);
        }

        // 2. Delete all audio files
        const audioKeys = await redis.keys('audio:*');
        console.log(`Found ${audioKeys.length} audio keys`);
        if (audioKeys.length > 0) {
            await redis.del(...audioKeys);
        }

        // 3. Delete all file keys
        const fileKeys = await redis.keys('file:*');
        console.log(`Found ${fileKeys.length} file keys`);
        if (fileKeys.length > 0) {
            await redis.del(...fileKeys);
        }

        // 4. Delete all status hashes
        const statusKeys = await redis.keys('status:*');
        console.log(`Found ${statusKeys.length} status keys`);
        if (statusKeys.length > 0) {
            await redis.del(...statusKeys);
        }

        // 5. Delete all user recording sets
        const userRecKeys = await redis.keys('userRecordings:*');
        console.log(`Found ${userRecKeys.length} user recording keys`);
        if (userRecKeys.length > 0) {
            await redis.del(...userRecKeys);
        }

        // 6. Clean BullMQ queue (careful with this)
        const queueKeys = await redis.keys('bull:audio-processing-queue:*');
        console.log(`Found ${queueKeys.length} queue keys`);
        if (queueKeys.length > 0) {
            await redis.del(...queueKeys);
        }

        console.log('✅ Redis cleaned successfully!');
        console.log('Note: Organizations and profiles were preserved.');

    } catch (error) {
        console.error('❌ Cleaning failed:', error);
    } finally {
        redis.disconnect();
    }
}

cleanRedis();
