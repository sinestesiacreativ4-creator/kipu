import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
});

const audioQueue = new Queue('audio-processing-queue', { connection });

async function test() {
    console.log('Testing Queue Consumer...');

    // Use a hardcoded path that we know exists or a dummy one.
    // We need a valid path to generate a signed URL.
    // Let's use the path from the user's recent upload if possible, or a known one.
    // User uploaded: 7a6e69af-21a7-4b7e-8034-5c68df365d4c
    // Path format: USER_ID/TIMESTAMP_FILENAME
    // We don't know the timestamp.

    // Let's try to list files in the bucket to find a valid path.
    // But we can't list easily here without supabase client.

    // Let's just assume the worker is running and we want to see if it picks up ANY job.
    // Even if it fails later, we want to see the "Processing job" log.

    const jobId = 'test-job-' + Date.now();
    console.log('Adding job:', jobId);

    await audioQueue.add('process-audio', {
        filePath: 'dummy/path/audio.webm',
        recordingId: 'dummy-recording-id',
        userId: 'dummy-user-id',
        organizationId: 'dummy-org-id'
    }, {
        jobId: jobId
    });

    console.log('Job added. Check backend logs for "Processing job..."');

    await new Promise(resolve => setTimeout(resolve, 5000));
    process.exit(0);
}

test();
