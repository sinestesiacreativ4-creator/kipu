/**
 * Microservices Configuration
 * Defines service boundaries and responsibilities
 */

export const MICROSERVICES = {
    /**
     * Auth Service
     * Responsibilities:
     * - User authentication (login, signup, JWT)
     * - Organization authentication
     * - User management
     * - Role-based access control
     */
    auth: {
        name: 'auth-service',
        port: 10001,
        routes: [
            '/api/auth/login',
            '/api/auth/signup',
            '/api/auth/me',
            '/api/auth/refresh',
            '/api/organizations/validate-code',
            '/api/organizations/create-from-code'
        ]
    },

    /**
     * Payments Service
     * Responsibilities:
     * - Stripe integration
     * - Subscription management
     * - Payment processing
     * - Organization code generation
     * - Billing webhooks
     */
    payments: {
        name: 'payments-service',
        port: 10002,
        routes: [
            '/api/payments/checkout',
            '/api/payments/webhook',
            '/api/payments/validate-code',
            '/api/payments/subscription/:organizationId'
        ]
    },

    /**
     * Recordings Service
     * Responsibilities:
     * - Recording CRUD operations
     * - Recording analysis
     * - Recording status management
     * - Recording queries and filters
     */
    recordings: {
        name: 'recordings-service',
        port: 10003,
        routes: [
            '/api/recordings',
            '/api/recordings/:id',
            '/api/recordings/:id/analysis',
            '/api/status/:recordingId'
        ]
    },

    /**
     * Voice Service
     * Responsibilities:
     * - Voice agent WebSocket connections
     * - Gemini Live API integration
     * - Real-time audio streaming
     * - Voice session management
     */
    voice: {
        name: 'voice-service',
        port: 10004,
        routes: [
            '/api/voice/init/:sessionId',
            '/api/voice/ws/:sessionId'
        ],
        websocket: true
    },

    /**
     * Storage Service
     * Responsibilities:
     * - File uploads (chunks)
     * - File storage (Redis, S3, Gemini)
     * - File retrieval
     * - Storage quota management
     */
    storage: {
        name: 'storage-service',
        port: 10005,
        routes: [
            '/api/chunks/:recordingId',
            '/api/finalize/:recordingId',
            '/api/upload',
            '/api/upload-chunk'
        ]
    },

    /**
     * Audio Processing Service (Worker)
     * Responsibilities:
     * - Audio chunking
     * - Audio analysis (Gemini)
     * - Background job processing
     * - Queue management
     */
    audioProcessing: {
        name: 'audio-processing-service',
        port: 10006,
        routes: [],
        worker: true
    }
};

/**
 * Service discovery helper
 */
export const getServiceUrl = (serviceName: keyof typeof MICROSERVICES): string => {
    const service = MICROSERVICES[serviceName];
    const envVar = `${service.name.toUpperCase().replace('-', '_')}_URL`;
    return process.env[envVar] || `http://localhost:${service.port}`;
};

