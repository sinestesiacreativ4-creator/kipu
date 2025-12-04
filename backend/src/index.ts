import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Load env vars
dotenv.config();

// Import Routes & Services
import uploadRoutes from './controllers/uploadController';
import chunkRoutes from './controllers/chunkController';
import robustUploadRoutes from './controllers/robustUploadController';
import demoRoutes from './controllers/demoController';
import organizationRoutes from './controllers/organizationController';
import recordingRoutes from './controllers/recordingController';
import profileRoutes from './controllers/profileController';
import statusRoutes from './controllers/statusController';
import { errorHandler } from './middleware/errorHandler';
import { TempManager } from './services/tempManager';
import { initTempFolders } from './config/upload.config';

// Initialize App
const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. SYSTEM INITIALIZATION
// ==========================================
console.log('[System] Starting Kipu Backend v2.1 (Robust Pipeline + Binary Concat)...');

// Initialize Temp Folders
try {
    initTempFolders();
    console.log('[System] Temp folders initialized.');
} catch (err) {
    console.error('[System] Failed to init temp folders:', err);
}

// Start Auto-Cleanup
TempManager.startAutoCleanup();

// ==========================================
// 2. MIDDLEWARE (ORDER MATTERS!)
// ==========================================

// A. CORS - Strict Configuration
const allowedOrigins = [
    'https://kipu-alpha.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: true, // Reflect request origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-chunk-index', 'x-user-id', 'x-organization-id'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

// B. Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// C. Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ==========================================
// 3. ROUTES
// ==========================================

// A. Health Check (Critical for Render)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// B. API Routes
app.use('/api', uploadRoutes); // Legacy routes
app.use('/api', chunkRoutes);  // Chunk routes (upload-chunk, finalize-recording)
// ==========================================
// SIMPLE RECORDER ROUTES (Raw Binary)
// ==========================================
import { SimpleChunkController } from './controllers/simpleChunkController';

// Raw body parser for chunks ONLY
// Raw body parser for chunks ONLY
app.post('/api/chunks/:recordingId',
    express.raw({
        type: ['video/webm', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'application/octet-stream'],
        limit: '50mb'
    }),
    SimpleChunkController.uploadChunk
);

app.post('/api/finalize/:recordingId',
    express.json(),
    SimpleChunkController.finalize
);

// Standard API Routes
app.use('/api', demoRoutes);   // Demo data initialization (TEMPORARY)
app.use('/api', organizationRoutes); // Organization & Login routes
app.use('/api', recordingRoutes); // Recording queries and management
app.use('/api', profileRoutes); // Profile queries
app.use('/api', statusRoutes); // Status polling for recordings

// Voice API Routes
import voiceRoutes from './controllers/voiceController';
app.use('/api/voice', voiceRoutes);

app.use('/', robustUploadRoutes); // Legacy/Robust routes

// C. 404 Handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route not found: ${req.method} ${req.path}`
    });
});

// ==========================================
// 4. ERROR HANDLING
// ==========================================
app.use(errorHandler);

// ==========================================
// 5. SERVER START WITH WEBSOCKET SUPPORT
// ==========================================
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupVoiceWebSocket } from './controllers/voiceController';

const server = createServer(app);

// Setup WebSocket for voice chat
const wss = new WebSocketServer({ server, path: '/voice' });
setupVoiceWebSocket(wss);
console.log('✅ WebSocket server configured for /voice');

server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 WebSocket: ws://localhost:${PORT}/voice`);
    console.log(`👉 Allowed Origins: ${allowedOrigins.join(', ')}\n`);

    // Start audio worker for AI processing
    import('./workers/audioWorker').then(() => {
        console.log('✅ Audio processing worker initialized');
    }).catch((err) => {
        console.error('❌ Failed to start audio worker:', err);
    });
});

// Handle Uncaught Errors
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
    // Don't exit in production if possible, but log heavily
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
