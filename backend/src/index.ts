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
import { errorHandler } from './middleware/errorHandler';
import { TempManager } from './services/tempManager';
import { initTempFolders } from './config/upload.config';

// Initialize App
const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. SYSTEM INITIALIZATION
// ==========================================
console.log('[System] Starting Kipu Backend...');

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
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    credentials: true,
    optionsSuccessStatus: 200
}));

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
app.use('/api', demoRoutes);   // Demo data initialization (TEMPORARY)
app.use('/api', organizationRoutes); // Organization & Login routes
app.use('/', robustUploadRoutes); // New robust routes (/upload/chunk)

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
// 5. SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 Allowed Origins: ${allowedOrigins.join(', ')}\n`);
});

// Handle Uncaught Errors
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
    // Don't exit in production if possible, but log heavily
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
