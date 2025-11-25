import { Request, Response } from 'express';
import { redisDb } from '../services/redisDb';

export const DataController = {
    // =============== ORGANIZATIONS ===============

    async createOrganization(req: Request, res: Response) {
        try {
            const { name, slug } = req.body;

            if (!name || !slug) {
                return res.status(400).json({ error: 'Name and slug are required' });
            }

            const org = await redisDb.createOrganization(name, slug);
            res.json(org);
        } catch (error: any) {
            console.error('[DataController] Error creating organization:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getOrganizationBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const org = await redisDb.getOrganizationBySlug(slug);

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
            const profiles = await redisDb.getProfiles(orgId);
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

            await redisDb.addProfile(profile);
            res.json({ success: true, profile });
        } catch (error: any) {
            console.error('[DataController] Error creating profile:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async deleteProfile(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await redisDb.deleteProfile(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    // =============== RECORDINGS ===============

    async getRecordings(req: Request, res: Response) {
        try {
            const { userId, orgId } = req.params;
            const recordings = await redisDb.getRecordings(userId, orgId);
            res.json(recordings);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    async deleteRecording(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await redisDb.deleteRecording(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
};
