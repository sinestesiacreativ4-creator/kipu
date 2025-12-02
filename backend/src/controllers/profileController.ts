import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';

const router = Router();

export const ProfileController = {
    /**
     * Get profile by ID
     */
    async getProfile(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const profile = await prisma.profile.findUnique({
                where: { id },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            });

            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            res.json(profile);
        } catch (error: any) {
            console.error('[ProfileController] Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get all profiles for an organization
     */
    async getOrganizationProfiles(req: Request, res: Response) {
        const { organizationId } = req.params;

        try {
            const profiles = await prisma.profile.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarColor: true
                }
            });

            res.json(profiles);
        } catch (error: any) {
            console.error('[ProfileController] Error:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

// Routes
router.get('/profiles/:id', ProfileController.getProfile);
router.get('/organizations/:organizationId/profiles', ProfileController.getOrganizationProfiles);

export default router;
