import axios from 'axios';
import crypto from 'crypto';
import prisma from './prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Service - Handles PayU payments and organization code generation
 * PayU Colombia: https://developers.payulatam.com/
 */
export class PaymentService {
    private static getPayUConfig() {
        const apiKey = process.env.PAYU_API_KEY || '';
        const apiLogin = process.env.PAYU_API_LOGIN || '';
        const merchantId = process.env.PAYU_MERCHANT_ID || '';
        const accountId = process.env.PAYU_ACCOUNT_ID || '';
        const isTest = process.env.PAYU_TEST_MODE === 'true' || !process.env.PAYU_API_KEY;
        
        const baseUrl = isTest 
            ? 'https://sandbox.api.payulatam.com' 
            : 'https://api.payulatam.com';

        return {
            apiKey,
            apiLogin,
            merchantId,
            accountId,
            baseUrl,
            isTest
        };
    }

    /**
     * Generate PayU signature for API requests
     */
    private static generateSignature(params: Record<string, string>): string {
        const config = this.getPayUConfig();
        const signatureString = Object.keys(params)
            .sort()
            .map(key => `${key}~${params[key]}`)
            .join('~');
        
        return crypto
            .createHash('md5')
            .update(`${config.apiKey}~${signatureString}`)
            .digest('hex');
    }

    /**
     * Create a checkout session for a subscription
     */
    static async createCheckoutSession(params: {
        organizationId: string;
        plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
        successUrl: string;
        cancelUrl: string;
    }) {
        const { organizationId, plan, successUrl, cancelUrl } = params;
        const config = this.getPayUConfig();

        if (!config.apiKey || !config.apiLogin || !config.merchantId) {
            throw new Error('PayU credentials not configured. Please set PAYU_API_KEY, PAYU_API_LOGIN, PAYU_MERCHANT_ID, and PAYU_ACCOUNT_ID');
        }

        // Get plan details
        const planDetails = this.getPlanDetails(plan);

        // Get organization
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { subscription: true }
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        // Generate reference code
        const referenceCode = `KIPU-${organizationId}-${Date.now()}`;

        // Create order in PayU
        const orderData = {
            language: 'es',
            command: 'SUBMIT_TRANSACTION',
            merchant: {
                apiKey: config.apiKey,
                apiLogin: config.apiLogin
            },
            transaction: {
                order: {
                    accountId: config.accountId,
                    referenceCode: referenceCode,
                    description: `Suscripción ${planDetails.name} - Kipu`,
                    signature: '', // Will be calculated
                    additionalValues: {
                        TX_VALUE: {
                            value: planDetails.price,
                            currency: 'COP'
                        }
                    },
                    buyer: {
                        merchantBuyerId: organizationId,
                        fullName: organization.name,
                        emailAddress: organization.billingEmail || 'noreply@kipu.com',
                        contactPhone: '',
                        dniNumber: ''
                    },
                    shippingAddress: {
                        street1: '',
                        city: '',
                        state: '',
                        country: 'CO',
                        postalCode: ''
                    }
                },
                payer: {
                    merchantPayerId: organizationId,
                    fullName: organization.name,
                    emailAddress: organization.billingEmail || 'noreply@kipu.com',
                    contactPhone: '',
                    dniNumber: ''
                },
                creditCard: {
                    processWithoutCvv2: false
                },
                extraParameters: {
                    INSTALLMENTS_NUMBER: 1
                },
                type: 'AUTHORIZATION_AND_CAPTURE',
                paymentMethod: '',
                paymentCountry: 'CO',
                deviceSessionId: uuidv4(),
                ipAddress: '127.0.0.1',
                cookie: uuidv4(),
                userAgent: 'Kipu-SaaS'
            },
            test: config.isTest
        };

        // Calculate signature
        const signatureParams = {
            merchantId: config.merchantId,
            referenceCode: referenceCode,
            amount: planDetails.price.toString(),
            currency: 'COP'
        };
        orderData.transaction.order.signature = this.generateSignature(signatureParams);

        try {
            // Create order in PayU
            const response = await axios.post(
                `${config.baseUrl}/payments-api/4.0/service.cgi`,
                orderData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.data.code !== 'SUCCESS') {
                throw new Error(`PayU error: ${response.data.error || 'Unknown error'}`);
            }

            // Get payment URL from response
            const paymentUrl = response.data.transactionResponse?.extraParameters?.BANK_REFERENCED_CODE 
                ? `${config.isTest ? 'https://sandbox.checkout.payulatam.com' : 'https://checkout.payulatam.com'}/ppp-web-gateway-payu/?ref_payco=${response.data.transactionResponse.transactionId}`
                : response.data.transactionResponse?.paymentURL;

            // Store transaction reference for webhook
            await prisma.payment.create({
                data: {
                    organizationId: organizationId,
                    stripePaymentIntentId: response.data.transactionResponse?.transactionId || referenceCode,
                    amount: planDetails.price,
                    currency: 'cop',
                    status: 'pending',
                    description: `Subscription payment for ${plan} plan`,
                    metadata: {
                        referenceCode: referenceCode,
                        transactionId: response.data.transactionResponse?.transactionId,
                        plan: plan
                    }
                }
            });

            return {
                sessionId: referenceCode,
                url: paymentUrl || successUrl
            };
        } catch (error: any) {
            console.error('[Payment] PayU error:', error.response?.data || error.message);
            throw new Error(`Failed to create checkout: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Handle successful payment webhook
     */
    static async handlePaymentSuccess(data: any) {
        const referenceCode = data.reference_sale || data.referenceCode;
        const transactionId = data.transaction_id || data.transactionId;
        const state = data.state_pol || data.state;
        const value = parseFloat(data.value || data.amount || '0');
        const currency = data.currency || 'COP';

        if (!referenceCode) {
            throw new Error('Reference code not found in payment data');
        }

        // Extract organizationId from referenceCode (format: KIPU-{orgId}-{timestamp})
        const orgIdMatch = referenceCode.match(/KIPU-([^-]+)-/);
        if (!orgIdMatch) {
            throw new Error('Invalid reference code format');
        }
        const organizationId = orgIdMatch[1];

        // Only process approved payments
        if (state !== '4' && state !== 'APPROVED') {
            console.log(`[Payment] Payment ${referenceCode} not approved. State: ${state}`);
            return { status: state, message: 'Payment not approved yet' };
        }

        // Check if payment already processed
        const existingPayment = await prisma.payment.findFirst({
            where: {
                organizationId: organizationId,
                status: 'succeeded',
                stripePaymentIntentId: transactionId
            }
        });

        if (existingPayment) {
            console.log(`[Payment] Payment already processed for organization ${organizationId}`);
            return {
                organizationId,
                code: existingPayment.organizationCode,
                paymentId: existingPayment.id
            };
        }

        // Get plan from metadata
        const pendingPayment = await prisma.payment.findFirst({
            where: {
                organizationId: organizationId,
                status: 'pending'
            },
            orderBy: { createdAt: 'desc' }
        });

        const plan = (pendingPayment?.metadata as any)?.plan || 'STARTER';

        // Create or update subscription
        const subscription = await prisma.subscription.upsert({
            where: { organizationId: organizationId },
            create: {
                id: uuidv4(),
                organizationId: organizationId,
                plan: plan,
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            update: {
                plan: plan,
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        // Update payment record
        const paymentRecord = await prisma.payment.update({
            where: { id: pendingPayment?.id || '' },
            data: {
                stripePaymentIntentId: transactionId,
                amount: value,
                currency: currency.toLowerCase(),
                status: 'succeeded',
                metadata: {
                    ...(pendingPayment?.metadata as any || {}),
                    transactionId: transactionId,
                    state: state
                }
            }
        });

        // Generate organization code
        const orgCode = await this.generateOrganizationCode(paymentRecord.id, organizationId);

        // Update organization
        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                code: orgCode.code,
                status: 'ACTIVE',
                plan: plan,
                subscriptionId: subscription.id
            }
        });

        // Link code to organization
        await prisma.organizationCode.update({
            where: { id: orgCode.id },
            data: {
                organizationId: organizationId,
                usedAt: new Date()
            }
        });

        return {
            organizationId,
            code: orgCode.code,
            paymentId: paymentRecord.id
        };
    }

    /**
     * Generate a unique organization code
     */
    static async generateOrganizationCode(paymentId: string, organizationId?: string): Promise<{ code: string; id: string }> {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const code = this.generateCode(10);
            
            try {
                const orgCode = await prisma.organizationCode.create({
                    data: {
                        code: code,
                        organizationId: organizationId || null,
                        paymentId: paymentId,
                        generatedAt: new Date(),
                        isActive: true
                    }
                });

                return { code: orgCode.code, id: orgCode.id };
            } catch (error: any) {
                if (error.code === 'P2002') {
                    attempts++;
                    continue;
                }
                throw error;
            }
        }

        throw new Error('Failed to generate unique organization code after multiple attempts');
    }

    /**
     * Generate a random alphanumeric code
     */
    private static generateCode(length: number = 10): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Get plan details
     */
    private static getPlanDetails(plan: string) {
        const plans: Record<string, { name: string; description: string; price: number; maxUsers: number; maxRecordings: number; maxStorageGB: number }> = {
            STARTER: {
                name: 'Starter',
                description: 'Perfecto para equipos pequeños',
                price: 99000,
                maxUsers: 5,
                maxRecordings: 100,
                maxStorageGB: 10
            },
            PROFESSIONAL: {
                name: 'Professional',
                description: 'Para empresas en crecimiento',
                price: 299000,
                maxUsers: 20,
                maxRecordings: 500,
                maxStorageGB: 50
            },
            ENTERPRISE: {
                name: 'Enterprise',
                description: 'Para grandes organizaciones',
                price: 799000,
                maxUsers: 100,
                maxRecordings: 2000,
                maxStorageGB: 200
            }
        };

        return plans[plan] || plans.STARTER;
    }

    /**
     * Validate organization code
     */
    static async validateOrganizationCode(code: string) {
        const orgCode = await prisma.organizationCode.findUnique({
            where: { code: code },
            include: {
                organization: {
                    include: {
                        subscription: true
                    }
                }
            }
        });

        if (!orgCode || !orgCode.isActive) {
            return null;
        }

        if (orgCode.expiresAt && orgCode.expiresAt < new Date()) {
            return null;
        }

        return orgCode.organization;
    }

    /**
     * Handle webhook events from PayU
     */
    static async handleWebhook(data: any) {
        console.log(`[Payment] PayU webhook received:`, JSON.stringify(data, null, 2));
        
        // PayU sends different webhook formats
        // Format 1: confirmation_pol
        if (data.confirmation_pol) {
            return await this.handlePaymentSuccess(data);
        }
        
        // Format 2: state_pol
        if (data.state_pol) {
            return await this.handlePaymentSuccess(data);
        }

        // Format 3: transactionResponse
        if (data.transactionResponse) {
            return await this.handlePaymentSuccess({
                reference_sale: data.transactionResponse.order?.referenceCode,
                transaction_id: data.transactionResponse.transactionId,
                state_pol: data.transactionResponse.state,
                value: data.transactionResponse.order?.additionalValues?.TX_VALUE?.value
            });
        }

        return { received: true, message: 'Webhook format not recognized' };
    }
}
