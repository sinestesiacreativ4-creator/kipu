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
                where: { slug: slug.toLowerCase() },
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
                return res.status(404).json({
                    error: 'Organization not found',
                    message: `No organization exists with code: ${slug}`,
                    code: 'ORG_NOT_FOUND'
                });
            }

            res.json(organization);
        } catch (error: any) {
            console.error('[OrganizationController] Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
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
        } catch (error: any) {
            console.error('[OrganizationController] Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    }
};

// Routes
router.get('/organizations/:slug', OrganizationController.getBySlug);
router.get('/organizations/:id/profiles', OrganizationController.getProfiles);

export default router;
