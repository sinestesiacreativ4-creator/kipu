import { Request, Response, Router } from 'express';
import prisma from '../services/prisma';
import { validateUUID } from '../middleware/validateUUID';

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
                return res.status(404).json({
                    error: 'Profile not found',
                    message: `No profile exists with ID: ${id}`,
                    code: 'PROFILE_NOT_FOUND'
                });
            }

            res.json(profile);
        } catch (error: any) {
            console.error('[ProfileController] Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    },

    /**
     * Create a new profile
     * POST /api/profiles
     */
    async createProfile(req: Request, res: Response) {
        try {
            const { id, name, role, avatarColor, organizationId } = req.body;

            console.log('[ProfileController] Creating profile:', { id, name, role, avatarColor, organizationId });

            if (!name || !organizationId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'name and organizationId are required',
                    code: 'MISSING_FIELDS'
                });
            }

            // Verify organization exists
            const organization = await prisma.organization.findUnique({
                where: { id: organizationId }
            });

            if (!organization) {
                return res.status(404).json({
                    error: 'Organization not found',
                    message: `No organization exists with ID: ${organizationId}`,
                    code: 'ORG_NOT_FOUND'
                });
            }

            // Create profile
            const profile = await prisma.profile.create({
                data: {
                    id: id || undefined, // Use provided ID or let Prisma generate one
                    name,
                    role: role || 'user',
                    avatarColor: avatarColor || 'bg-blue-600',
                    organizationId
                }
            });

            console.log('[ProfileController] Profile created:', profile.id);

            res.status(201).json(profile);
        } catch (error: any) {
            console.error('[ProfileController] Create error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    },

    /**
     * Delete a profile
     * DELETE /api/profiles/:id
     */
    async deleteProfile(req: Request, res: Response) {
        const { id } = req.params;

        try {
            console.log('[ProfileController] Deleting profile:', id);

            // Check if profile exists
            const profile = await prisma.profile.findUnique({
                where: { id }
            });

            if (!profile) {
                return res.status(404).json({
                    error: 'Profile not found',
                    message: `No profile exists with ID: ${id}`,
                    code: 'PROFILE_NOT_FOUND'
                });
            }

            // Delete all recordings for this profile first (cascade)
            await prisma.recording.deleteMany({
                where: { userId: id }
            });

            // Delete the profile
            await prisma.profile.delete({
                where: { id }
            });

            console.log('[ProfileController] Profile deleted:', id);

            res.json({
                success: true,
                message: 'Profile deleted successfully'
            });
        } catch (error: any) {
            console.error('[ProfileController] Delete error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    }
};

// Routes
router.get('/profiles/:id', validateUUID('id'), ProfileController.getProfile);
router.post('/profiles', ProfileController.createProfile);
router.delete('/profiles/:id', validateUUID('id'), ProfileController.deleteProfile);

export default router;
