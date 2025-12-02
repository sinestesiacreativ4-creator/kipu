import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const profiles = await prisma.profile.findMany();
        console.log('Profiles:', profiles);
        const orgs = await prisma.organization.findMany();
        console.log('Orgs:', orgs);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
