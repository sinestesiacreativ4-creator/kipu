
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Creating demo organization...');
        const org = await prisma.organization.upsert({
            where: { slug: 'demo' },
            update: {},
            create: {
                name: 'Asesorías Étnicas Demo',
                slug: 'demo'
            }
        });
        console.log('Organization created:', org);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
