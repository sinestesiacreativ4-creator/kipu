import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { UploadController } from './controllers/uploadController';
import { DataController } from './controllers/dataController';
import { RobustUploadController } from './controllers/robustUploadController'; // New Controller
import prisma from './services/prisma';
import { initTempFolders } from './config/upload.config';
import { startAutoCleanup } from './services/tempManager';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
// Start background worker in the same process
import './workers/audioWorker';

dotenv.config();

// Initialize infrastructure
initTempFolders();
startAutoCleanup(1); // Cleanup every hour

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Rejected request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Routes
// 0. Authentication
import { AuthController } from './controllers/authController';
app.post('/api/auth/signup', AuthController.signup);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.getCurrentUser);
app.post('/api/auth/logout', AuthController.logout);

// 1. Subida directa a Redis (Multipart)
app.post('/api/upload-redis', UploadController.uploadMiddleware, UploadController.uploadToRedis);

// 2. Consultar estado en Redis
app.get('/api/status/:recordingId', UploadController.getStatus);

// 3. Data CRUD
app.post('/api/organizations', DataController.createOrganization);
app.get('/api/organizations/:slug', DataController.getOrganizationBySlug);
app.get('/api/profiles/:orgId', DataController.getProfiles);
app.post('/api/profiles', DataController.createProfile);
app.delete('/api/profiles/:id', DataController.deleteProfile);
app.get('/api/recordings/:userId/:orgId', DataController.getRecordings);
app.delete('/api/recordings/:id', DataController.deleteRecording);

// 4. Streaming Chunk Upload (Legacy - keeping for compatibility if needed, or replace)
import chunkController from './controllers/chunkController';
app.use('/api', chunkController);

// ==========================================
// 5. NEW ROBUST CHUNK UPLOAD ENDPOINTS
// ==========================================
app.post('/upload/chunk', RobustUploadController.uploadMiddleware, RobustUploadController.uploadChunk);
app.post('/upload/merge', RobustUploadController.mergeChunks);


// 6. Health Check
app.get('/health', (req, res) => res.send('Audio Processing Service OK'));

// 7. Init Demo Data (Temporary)
app.get('/api/init-demo-data', async (req, res) => {
    try {
        const existing = await prisma.organization.findUnique({ where: { slug: 'demo' } });
        if (existing) return res.json({ message: 'Demo org already exists', id: existing.id });

        const testOrg = await prisma.organization.create({
            data: { name: 'Asesorías Étnicas Demo', slug: 'demo' }
        });
        res.json({ message: 'Demo org created!', org: testOrg });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler (MUST be last)
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`[Server] Backend running on port ${PORT}`);
    console.log(`[Server] Queue system ready (Worker started in background)`);
});
