import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

async function initializeTestOrg() {
    try {
        console.log('[Init] Creating test organization...');

        // Create a test organization
        const testOrg = {
            id: uuidv4(),
            name: 'Asesorías Étnicas Demo',
            slug: 'demo',
            createdAt: Date.now()
        };

        await redis.set(`org:${testOrg.id}`, JSON.stringify(testOrg));
        await redis.set(`orgSlug:${testOrg.slug}`, testOrg.id);

        console.log('[Init] Test organization created!');
        console.log(`[Init] Organization: ${testOrg.name}`);
        console.log(`[Init] Slug: ${testOrg.slug}`);
        console.log(`[Init] ID: ${testOrg.id}`);
        console.log('');
        console.log(`[Init] Use this code to login: demo`);

        process.exit(0);
    } catch (error) {
        console.error('[Init] Error:', error);
        process.exit(1);
    }
}

initializeTestOrg();
