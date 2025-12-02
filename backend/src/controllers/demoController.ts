import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * TEMPORARY ENDPOINT: Initialize demo data
 * Creates organization "hernandez" and a demo profile
 */
router.post('/init-demo', async (req: Request, res: Response) => {
    try {
        console.log('[DemoInit] Creating demo organization and profile...');

        // 1. Create or get Organization "hernandez"
        let organization = await prisma.organization.findFirst({
            where: { name: 'hernandez' }
        });

        if (!organization) {
            organization = await prisma.organization.create({
                data: {
                    id: uuidv4(),
                    name: 'hernandez',
                    settings: {}
                }
            });
            console.log('[DemoInit] ✓ Created organization:', organization.id);
        } else {
            console.log('[DemoInit] ✓ Organization already exists:', organization.id);
        }

        // 2. Create or get demo Profile
        let profile = await prisma.profile.findFirst({
            where: {
                organizationId: organization.id,
                name: 'Usuario Demo'
            }
        });

        if (!profile) {
            profile = await prisma.profile.create({
                data: {
                    id: uuidv4(),
                    organizationId: organization.id,
                    name: 'Usuario Demo',
                    role: 'Administrador',
                    avatar: '👤'
                }
            });
            console.log('[DemoInit] ✓ Created profile:', profile.id);
        } else {
            console.log('[DemoInit] ✓ Profile already exists:', profile.id);
        }

        res.json({
            success: true,
            message: 'Demo data initialized successfully',
            data: {
                organization: {
                    id: organization.id,
                    name: organization.name
                },
                profile: {
                    id: profile.id,
                    name: profile.name,
                    role: profile.role
                }
            }
        });

    } catch (error: any) {
        console.error('[DemoInit] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get all organizations and profiles
 */
router.get('/data', async (req: Request, res: Response) => {
    try {
        const organizations = await prisma.organization.findMany({
            include: {
                profiles: true,
                recordings: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        res.json({
            success: true,
            organizations
        });
    } catch (error: any) {
        console.error('[DemoData] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
