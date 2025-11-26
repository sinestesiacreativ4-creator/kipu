import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { UploadController } from './controllers/uploadController';
import { DataController } from './controllers/dataController';
import prisma from './services/prisma';
// Import worker to start it in the same process
import './workers/audioWorker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
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

// 4. Health Check
app.get('/health', (req, res) => res.send('Audio Processing Service OK'));

// 5. Init Demo Data (Temporary)
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

app.listen(PORT, () => {
    console.log(`[Server] Backend running on port ${PORT}`);
    console.log(`[Server] Queue system ready (Worker started in background)`);
});
