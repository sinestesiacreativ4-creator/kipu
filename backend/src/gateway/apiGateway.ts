import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';

/**
 * API Gateway - Routes requests to appropriate microservices
 * This is a simple gateway implementation. For production, consider using:
 * - Kong
 * - AWS API Gateway
 * - NGINX
 * - Traefik
 */

const router = express.Router();

// Microservice URLs (can be environment variables)
const MICROSERVICES = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:10001',
    payments: process.env.PAYMENTS_SERVICE_URL || 'http://localhost:10002',
    recordings: process.env.RECORDINGS_SERVICE_URL || 'http://localhost:10003',
    voice: process.env.VOICE_SERVICE_URL || 'http://localhost:10004',
    storage: process.env.STORAGE_SERVICE_URL || 'http://localhost:10005'
};

/**
 * Proxy middleware to forward requests to microservices
 */
const proxyToService = (serviceName: keyof typeof MICROSERVICES) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const serviceUrl = MICROSERVICES[serviceName];
            const targetUrl = `${serviceUrl}${req.path}`;

            console.log(`[Gateway] Proxying ${req.method} ${req.path} to ${serviceName} service: ${targetUrl}`);

            // Forward request to microservice
            const response = await axios({
                method: req.method as any,
                url: targetUrl,
                data: req.body,
                params: req.query,
                headers: {
                    ...req.headers,
                    'x-forwarded-for': req.ip,
                    'x-organization-code': req.headers['x-organization-code'] || '',
                    'x-user-id': req.headers['x-user-id'] || ''
                },
                timeout: 30000
            });

            // Forward response
            res.status(response.status).json(response.data);
        } catch (error: any) {
            console.error(`[Gateway] Error proxying to ${serviceName}:`, error.message);
            
            if (error.response) {
                // Microservice returned an error
                res.status(error.response.status).json(error.response.data);
            } else if (error.code === 'ECONNREFUSED') {
                // Microservice is down
                res.status(503).json({
                    error: 'Service unavailable',
                    message: `${serviceName} service is currently unavailable`,
                    service: serviceName
                });
            } else {
                // Other error
                res.status(500).json({
                    error: 'Gateway error',
                    message: error.message || 'Failed to proxy request'
                });
            }
        }
    };
};

// Route definitions
router.use('/auth', proxyToService('auth'));
router.use('/payments', proxyToService('payments'));
router.use('/recordings', proxyToService('recordings'));
router.use('/voice', proxyToService('voice'));
router.use('/storage', proxyToService('storage'));

export default router;

