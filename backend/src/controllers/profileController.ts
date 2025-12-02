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
    }
};

// Routes with UUID validation
router.get('/profiles/:id', validateUUID('id'), ProfileController.getProfile);

export default router;
