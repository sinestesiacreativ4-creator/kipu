import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

export const OrganizationController = {
    /**
     * Get organization by slug (login code)
     */
    async getBySlug(req: Request, res: Response) {
        const { slug } = req.params;

        try {
            const organization = await prisma.organization.findUnique({
                where: { slug: slug.toLowerCase() }, // Ensure case-insensitive search logic if needed, but slug is usually lowercase
                include: {
                    profiles: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                            avatarColor: true
                        }
                    }
                }
            });

            if (!organization) {
                throw createError('Organization not found', 404, 'ORG_NOT_FOUND');
            }

            res.json(organization);
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get organization profiles
     */
    async getProfiles(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const profiles = await prisma.profile.findMany({
                where: { organizationId: id },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarColor: true
                }
            });

            res.json(profiles);
        } catch (error) {
            throw error;
        }
    }
};

// Routes
router.get('/organizations/:slug', OrganizationController.getBySlug);
router.get('/organizations/:id/profiles', OrganizationController.getProfiles);

export default router;
