import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

async function diagnose() {
    const recordingId = 'f3edb9b7-9b10-4b16-bb5d-cf8d9876f4c6'; // ID from logs

    try {
        console.log('--- Redis Diagnosis ---');
        console.log(`Checking recording: ${recordingId}`);

        // 1. Check Status Hash
        const status = await redis.hgetall(`status:${recordingId}`);
        console.log('Status Hash:', status);

        // 2. Check Recording Data
        const recordingData = await redis.get(`recording:${recordingId}`);
        if (recordingData) {
            const parsed = JSON.parse(recordingData);
            console.log('Recording Data (Status):', parsed.status);
            console.log('Recording Data (Analysis):', parsed.analysis ? 'Present' : 'Missing');
        } else {
            console.log('Recording Data: Not Found');
        }

        // 3. Check Queue (BullMQ uses specific keys)
        const queueKeys = await redis.keys('bull:audio-processing-queue:*');
        console.log('Queue Keys found:', queueKeys.length);

    } catch (error) {
        console.error('Diagnosis failed:', error);
    } finally {
        redis.disconnect();
    }
}

diagnose();
