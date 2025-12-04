import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';
import prisma from '../services/prisma';

const router = Router();

/**
 * Create checkout preference
 * POST /api/payments/checkout
 */
router.post('/checkout', async (req: Request, res: Response) => {
    try {
        const { organizationId, plan, successUrl, cancelUrl } = req.body;

        if (!organizationId || !plan || !successUrl || !cancelUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const session = await PaymentService.createCheckoutSession({
            organizationId,
            plan,
            successUrl,
            cancelUrl
        });

        res.json({
            success: true,
            sessionId: session.sessionId,
            url: session.url
        });
    } catch (error: any) {
        console.error('[Payment] Checkout error:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});

/**
 * PayU webhook handler
 * POST /api/payments/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        // PayU sends webhooks as form data or JSON
        const data = req.body;

        console.log(`[Payment] PayU webhook received:`, JSON.stringify(data, null, 2));

        // Process webhook
        const result = await PaymentService.handleWebhook(data);

        // Always return 200 to acknowledge receipt
        res.status(200).json({ received: true, result });
    } catch (error: any) {
        console.error('[Payment] Webhook processing error:', error);
        // Still return 200 to prevent PayU from retrying
        res.status(200).json({ received: true, error: error.message });
    }
});

/**
 * Validate organization code
 * POST /api/payments/validate-code
 */
router.post('/validate-code', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const organization = await PaymentService.validateOrganizationCode(code);

        if (!organization) {
            return res.status(404).json({ error: 'Invalid or expired code' });
        }

        res.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                code: organization.code,
                plan: organization.plan,
                status: organization.status
            }
        });
    } catch (error: any) {
        console.error('[Payment] Validate code error:', error);
        res.status(500).json({ error: error.message || 'Failed to validate code' });
    }
});

/**
 * Get organization subscription details
 * GET /api/payments/subscription/:organizationId
 */
router.get('/subscription/:organizationId', async (req: Request, res: Response) => {
    try {
        const { organizationId } = req.params;

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: true,
                organizationCode: true
            }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                code: organization.code,
                plan: organization.plan,
                status: organization.status,
                subscription: organization.subscription,
                limits: {
                    maxUsers: organization.maxUsers,
                    maxRecordings: organization.maxRecordings,
                    maxStorageGB: organization.maxStorageGB,
                    currentStorageGB: organization.currentStorageGB
                }
            }
        });
    } catch (error: any) {
        console.error('[Payment] Get subscription error:', error);
        res.status(500).json({ error: error.message || 'Failed to get subscription' });
    }
});

export default router;
