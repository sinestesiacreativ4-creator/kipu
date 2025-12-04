import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { PaymentService } from '../services/paymentService';

/**
 * Extend Express Request to include organization context
 */
declare global {
    namespace Express {
        interface Request {
            organization?: {
                id: string;
                name: string;
                code: string;
                plan: string;
                status: string;
                limits: {
                    maxUsers: number;
                    maxRecordings: number;
                    maxStorageGB: number;
                    currentStorageGB: number;
                };
            };
            user?: {
                id: string;
                email: string;
                name: string;
                role: string;
            };
        }
    }
}

/**
 * Multi-tenant authentication middleware
 * Validates organization code and sets organization context
 */
export const authenticateOrganization = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get organization code from header, query, or body
        const orgCode = 
            req.headers['x-organization-code'] as string ||
            req.query.orgCode as string ||
            req.body.organizationCode as string;

        if (!orgCode) {
            return res.status(401).json({
                error: 'Organization code required',
                message: 'Please provide organization code in header (x-organization-code), query (?orgCode=xxx), or body'
            });
        }

        // Validate organization code
        const organization = await PaymentService.validateOrganizationCode(orgCode);

        if (!organization) {
            return res.status(401).json({
                error: 'Invalid organization code',
                message: 'The provided organization code is invalid or expired'
            });
        }

        // Check organization status
        if (organization.status === 'SUSPENDED' || organization.status === 'CANCELLED') {
            return res.status(403).json({
                error: 'Organization suspended',
                message: 'Your organization subscription has been suspended. Please contact support.'
            });
        }

        // Set organization context
        req.organization = {
            id: organization.id,
            name: organization.name,
            code: organization.code,
            plan: organization.plan,
            status: organization.status,
            limits: {
                maxUsers: organization.maxUsers,
                maxRecordings: organization.maxRecordings,
                maxStorageGB: organization.maxStorageGB,
                currentStorageGB: organization.currentStorageGB
            }
        };

        next();
    } catch (error: any) {
        console.error('[Auth] Organization authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: error.message || 'Failed to authenticate organization'
        });
    }
};

/**
 * User authentication middleware (optional, for user-specific operations)
 */
export const authenticateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get user ID from header or query
        const userId = 
            req.headers['x-user-id'] as string ||
            req.query.userId as string;

        if (!userId) {
            return res.status(401).json({
                error: 'User ID required'
            });
        }

        // Verify organization context exists
        if (!req.organization) {
            return res.status(401).json({
                error: 'Organization context required',
                message: 'Please authenticate organization first'
            });
        }

        // Get user and verify they belong to the organization
        const user = await prisma.appUser.findUnique({
            where: { id: userId }
        });

        if (!user || user.organizationId !== req.organization.id) {
            return res.status(403).json({
                error: 'User not found or does not belong to organization'
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        next();
    } catch (error: any) {
        console.error('[Auth] User authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: error.message || 'Failed to authenticate user'
        });
    }
};

/**
 * Check organization limits middleware
 */
export const checkOrganizationLimits = (resource: 'users' | 'recordings' | 'storage') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.organization) {
            return res.status(401).json({ error: 'Organization context required' });
        }

        const org = req.organization;

        try {
            switch (resource) {
                case 'users':
                    const userCount = await prisma.appUser.count({
                        where: { organizationId: org.id }
                    });
                    if (userCount >= org.limits.maxUsers) {
                        return res.status(403).json({
                            error: 'User limit exceeded',
                            message: `Maximum ${org.limits.maxUsers} users allowed for ${org.plan} plan`
                        });
                    }
                    break;

                case 'recordings':
                    const recordingCount = await prisma.recording.count({
                        where: { organizationId: org.id }
                    });
                    if (recordingCount >= org.limits.maxRecordings) {
                        return res.status(403).json({
                            error: 'Recording limit exceeded',
                            message: `Maximum ${org.limits.maxRecordings} recordings allowed for ${org.plan} plan`
                        });
                    }
                    break;

                case 'storage':
                    if (org.limits.currentStorageGB >= org.limits.maxStorageGB) {
                        return res.status(403).json({
                            error: 'Storage limit exceeded',
                            message: `Maximum ${org.limits.maxStorageGB}GB storage allowed for ${org.plan} plan`
                        });
                    }
                    break;
            }

            next();
        } catch (error: any) {
            console.error('[Auth] Limit check error:', error);
            res.status(500).json({
                error: 'Failed to check limits',
                message: error.message
            });
        }
    };
};

/**
 * Require specific plan middleware
 */
export const requirePlan = (...allowedPlans: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.organization) {
            return res.status(401).json({ error: 'Organization context required' });
        }

        if (!allowedPlans.includes(req.organization.plan)) {
            return res.status(403).json({
                error: 'Plan not allowed',
                message: `This feature requires one of the following plans: ${allowedPlans.join(', ')}`,
                currentPlan: req.organization.plan
            });
        }

        next();
    };
};

