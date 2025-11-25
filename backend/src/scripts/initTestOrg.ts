import dotenv from 'dotenv';
import prisma from '../services/prisma';

dotenv.config();

async function initializeTestOrg() {
    try {
        console.log('[Init] Creating test organization...');

        // Check if it already exists
        const existing = await prisma.organization.findUnique({
            where: { slug: 'demo' }
        });

        if (existing) {
            console.log('[Init] Test organization "demo" already exists.');
            console.log(`[Init] ID: ${existing.id}`);
            process.exit(0);
        }

        // Create a test organization
        const testOrg = await prisma.organization.create({
            data: {
                name: 'Asesorías Étnicas Demo',
                slug: 'demo'
            }
        });

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
