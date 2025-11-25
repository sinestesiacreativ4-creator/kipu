import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
});

const audioQueue = new Queue('audio-processing-queue', { connection });

async function showFailedJobs() {
    try {
        const failedJobs = await audioQueue.getFailed();

        console.log(`\n=== FAILED JOBS (${failedJobs.length}) ===\n`);

        for (const job of failedJobs.slice(0, 3)) {
            console.log(`Job ID: ${job.id}`);
            console.log(`Recording ID: ${job.data.recordingId}`);
            console.log(`File Path: ${job.data.filePath}`);
            console.log(`Failed Reason: ${job.failedReason}`);
            console.log(`Stack Trace:`);
            console.log(job.stacktrace?.join('\n') || 'No stack trace');
            console.log('\n---\n');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.quit();
        process.exit(0);
    }
}

showFailedJobs();
