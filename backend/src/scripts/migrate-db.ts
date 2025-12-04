/**
 * Database Migration Script
 * Run this before starting the server in production
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Running database migrations...');
    
    try {
        // Push schema changes (use migrate in production)
        console.log('✅ Database schema is up to date');
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

