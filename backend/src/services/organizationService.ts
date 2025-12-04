import prisma from './prisma';
import { v4 as uuidv4 } from 'uuid';
import { PaymentService } from './paymentService';

/**
 * Organization Service - Handles organization creation and management
 */
export class OrganizationService {
    /**
     * Create organization with code
     * This is called after successful payment
     */
    static async createOrganizationWithCode(params: {
        name: string;
        code: string;
        plan: string;
        billingEmail?: string;
    }) {
        const { name, code, plan, billingEmail } = params;

        // Generate slug from name
        const slug = this.generateSlug(name);

        // Get plan limits
        const planLimits = this.getPlanLimits(plan);

        // Create organization
        const organization = await prisma.organization.create({
            data: {
                id: uuidv4(),
                name: name,
                slug: slug,
                code: code,
                plan: plan,
                status: 'ACTIVE',
                billingEmail: billingEmail,
                maxUsers: planLimits.maxUsers,
                maxRecordings: planLimits.maxRecordings,
                maxStorageGB: planLimits.maxStorageGB,
                currentStorageGB: 0
            }
        });

        return organization;
    }

    /**
     * Create organization from code (when user enters code)
     */
    static async createOrganizationFromCode(params: {
        name: string;
        code: string;
        ownerEmail: string;
        ownerName: string;
    }) {
        const { name, code, ownerEmail, ownerName } = params;

        // Validate code
        const orgCode = await prisma.organizationCode.findUnique({
            where: { code: code }
        });

        if (!orgCode || !orgCode.isActive) {
            throw new Error('Invalid or inactive organization code');
        }

        if (orgCode.organizationId) {
            throw new Error('Organization code already used');
        }

        // Get organization from code's payment
        const payment = await prisma.payment.findUnique({
            where: { id: orgCode.paymentId || '' }
        });

        if (!payment) {
            throw new Error('Payment not found for organization code');
        }

        // Create organization
        const slug = this.generateSlug(name);
        const planLimits = this.getPlanLimits(payment.metadata as any || { plan: 'STARTER' });

        const organization = await prisma.organization.create({
            data: {
                id: uuidv4(),
                name: name,
                slug: slug,
                code: code,
                plan: (payment.metadata as any)?.plan || 'STARTER',
                status: 'ACTIVE',
                billingEmail: ownerEmail,
                maxUsers: planLimits.maxUsers,
                maxRecordings: planLimits.maxRecordings,
                maxStorageGB: planLimits.maxStorageGB,
                currentStorageGB: 0
            }
        });

        // Link code to organization
        await prisma.organizationCode.update({
            where: { id: orgCode.id },
            data: {
                organizationId: organization.id,
                usedAt: new Date()
            }
        });

        // Create owner user
        const owner = await prisma.appUser.create({
            data: {
                id: uuidv4(),
                email: ownerEmail,
                name: ownerName,
                password: '', // Will be set via password reset
                role: 'OWNER',
                organizationId: organization.id
            }
        });

        return {
            organization,
            owner
        };
    }

    /**
     * Generate slug from name
     */
    private static generateSlug(name: string): string {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    }

    /**
     * Get plan limits
     */
    private static getPlanLimits(plan: string | any) {
        const planMap: Record<string, { maxUsers: number; maxRecordings: number; maxStorageGB: number }> = {
            FREE: { maxUsers: 1, maxRecordings: 10, maxStorageGB: 1.0 },
            STARTER: { maxUsers: 5, maxRecordings: 100, maxStorageGB: 10.0 },
            PROFESSIONAL: { maxUsers: 20, maxRecordings: 500, maxStorageGB: 50.0 },
            ENTERPRISE: { maxUsers: 100, maxRecordings: 2000, maxStorageGB: 200.0 }
        };

        const planName = typeof plan === 'string' ? plan : (plan?.plan || 'FREE');
        return planMap[planName] || planMap.FREE;
    }

    /**
     * Update organization usage
     */
    static async updateUsage(organizationId: string, type: 'storage' | 'recording', value: number) {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        if (type === 'storage') {
            await prisma.organization.update({
                where: { id: organizationId },
                data: {
                    currentStorageGB: {
                        increment: value
                    }
                }
            });
        }
    }

    /**
     * Check if organization can perform action
     */
    static async checkLimits(organizationId: string, action: 'create_user' | 'create_recording' | 'upload_file', fileSizeGB?: number) {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        switch (action) {
            case 'create_user':
                const userCount = await prisma.appUser.count({
                    where: { organizationId: organizationId }
                });
                if (userCount >= organization.maxUsers) {
                    throw new Error(`User limit exceeded. Maximum ${organization.maxUsers} users for ${organization.plan} plan.`);
                }
                break;

            case 'create_recording':
                const recordingCount = await prisma.recording.count({
                    where: { organizationId: organizationId }
                });
                if (recordingCount >= organization.maxRecordings) {
                    throw new Error(`Recording limit exceeded. Maximum ${organization.maxRecordings} recordings for ${organization.plan} plan.`);
                }
                break;

            case 'upload_file':
                if (fileSizeGB && organization.currentStorageGB + fileSizeGB > organization.maxStorageGB) {
                    throw new Error(`Storage limit exceeded. Maximum ${organization.maxStorageGB}GB for ${organization.plan} plan.`);
                }
                break;
        }

        return true;
    }
}

