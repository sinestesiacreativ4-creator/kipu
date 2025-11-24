import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { UploadController } from './controllers/uploadController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// 1. Obtener URL para subir directo a Supabase (Frontend -> Backend -> Supabase)
app.post('/api/upload-url', UploadController.getUploadUrl);

// 2. Notificar que la subida terminó y encolar procesamiento
app.post('/api/upload-complete', UploadController.notifyUploadComplete);

// 3. Health Check
app.get('/health', (req, res) => res.send('Audio Processing Service OK'));

app.listen(PORT, () => {
    console.log(`[Server] Backend running on port ${PORT}`);
    console.log(`[Server] Queue system ready`);
});
