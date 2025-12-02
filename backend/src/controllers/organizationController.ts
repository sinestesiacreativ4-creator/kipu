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
     * Create a new organization
     */
    async create(req: Request, res: Response) {
        try {
            const { name } = req.body;
            // Generate slug from name or random UUID if not provided
            const slug = name
                ? name.toLowerCase().replace(/[^a-z0-9]/g, '-')
                : `org-${Math.random().toString(36).substring(2, 9)}`;

            // Check if exists
            const existing = await prisma.organization.findUnique({
                where: { slug }
            });

            if (existing) {
                return res.status(409).json({
                    error: 'Organization already exists',
                    code: 'ORG_EXISTS'
                });
            }

            // Create Org
            const organization = await prisma.organization.create({
                data: {
                    name: name || slug,
                    slug: slug
                }
            });

            // Create Default Admin Profile
            const adminProfile = await prisma.profile.create({
                data: {
                    organizationId: organization.id,
                    name: 'Administrador',
                    role: 'admin',
                    avatarColor: '#3b82f6'
                }
            });

            res.status(201).json({
                success: true,
                organization,
                adminProfile
            });

        } catch (error: any) {
            console.error('[OrganizationController] Create error:', error);
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
router.post('/organizations', OrganizationController.create);
router.get('/organizations/:slug', OrganizationController.getBySlug);
router.get('/organizations/:id/profiles', OrganizationController.getProfiles);

export default router;
