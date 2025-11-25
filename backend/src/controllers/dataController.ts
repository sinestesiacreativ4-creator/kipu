import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const DataController = {
    // =============== ORGANIZATIONS ===============

    async createOrganization(req: Request, res: Response) {
        try {
            const { name, slug } = req.body;

            if (!name || !slug) {
                return res.status(400).json({ error: 'Name and slug are required' });
            }

            const org = await prisma.organization.create({
                data: {
                    name,
                    slug
                }
            });
            res.json(org);
        } catch (error: any) {
            console.error('[DataController] Error creating organization:', error);
            // Handle unique constraint violation
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'Organization slug already exists' });
            }
            res.status(500).json({ error: error.message });
        }
    },

    async getOrganizationBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const org = await prisma.organization.findUnique({
                where: { slug }
            });

            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }

            res.json(org);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============== PROFILES ===============

    async getProfiles(req: Request, res: Response) {
        try {
            const { orgId } = req.params;
            const profiles = await prisma.profile.findMany({
                where: { organizationId: orgId },
                orderBy: { createdAt: 'desc' }
            });
            res.json(profiles);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    async createProfile(req: Request, res: Response) {
        try {
            const profile = req.body;

            if (!profile.name || !profile.organizationId) {
                return res.status(400).json({ error: 'Name and organizationId are required' });
            }

            const newProfile = await prisma.profile.create({
                data: {
                    id: profile.id, // Optional, Prisma generates uuid if not provided
                    name: profile.name,
                    role: profile.role || 'user',
                    avatarColor: profile.avatarColor,
                    organizationId: profile.organizationId
                }
            });
            res.json({ success: true, profile: newProfile });
        } catch (error: any) {
            console.error('[DataController] Error creating profile:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async deleteProfile(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.profile.delete({
                where: { id }
            });
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============== RECORDINGS ===============

    async getRecordings(req: Request, res: Response) {
        try {
            const { userId, orgId } = req.params;
            const recordings = await prisma.recording.findMany({
                where: {
                    userId,
                    organizationId: orgId
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json(recordings);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    async deleteRecording(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.recording.delete({
                where: { id }
            });
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
};
