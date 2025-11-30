import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}/api`;
const TEMP_DIR = path.join(__dirname, '../../temp_simulation');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function generateDummyAudio(durationSeconds: number, filename: string): Promise<string> {
    const outputPath = path.join(TEMP_DIR, filename);
    console.log(`Generating ${durationSeconds}s dummy audio file at ${outputPath}...`);

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input('anullsrc=r=44100:cl=stereo') // Silent audio source
            .inputFormat('lavfi')
            .duration(durationSeconds)
            .audioCodec('libmp3lame')
            .save(outputPath)
            .on('end', () => {
                console.log('Audio generation complete.');
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Error generating audio:', err);
                reject(err);
            });
    });
}

async function setupUser() {
    try {
        const email = `sim${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`Creating user ${email}...`);

        const signupRes = await axios.post(`${API_URL}/auth/signup`, {
            email,
            password,
            name: 'Simulation User'
        });

        const user = signupRes.data.user;
        console.log('User created:', user.id);

        console.log('Creating org...');
        const orgRes = await axios.post(`${API_URL}/organizations`, {
            name: 'Simulation Org',
            slug: `sim-org-${Date.now()}`,
            userId: user.id
        });

        const org = orgRes.data;
        console.log('Org created:', org.id);

        console.log('Creating profile...');
        const profileRes = await axios.post(`${API_URL}/profiles`, {
            name: 'Simulation Producer',
            role: 'producer',
            avatarColor: 'bg-blue-500',
            organizationId: org.id
        });

        const profile = profileRes.data.profile;
        console.log('Profile created:', profile.id);

        return { userId: profile.id, orgId: org.id };
    } catch (error: any) {
        console.error('Setup failed:', error.response?.data || error.message);
        throw error;
    }
}

async function simulate() {
    try {
        // 1. Setup User/Org/Profile
        const { userId, orgId } = await setupUser();

        // 2. Generate 10 seconds audio (10 seconds)
        const audioPath = await generateDummyAudio(10, 'short_simulation.mp3');

        // 3. Upload
        console.log('Uploading file...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(audioPath), {
            filename: 'short_simulation.mp3',
            contentType: 'audio/mpeg'
        });
        formData.append('recordingId', `sim-${Date.now()}`);
        formData.append('userId', userId);
        formData.append('organizationId', orgId);

        const uploadRes = await axios.post(`${API_URL}/upload-redis`, formData, {
            headers: {
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log('Upload response:', uploadRes.data);
        const { recordingId } = uploadRes.data;

        // 4. Poll Status
        console.log(`Polling status for recording ${recordingId}...`);

        let status = 'QUEUED';
        while (status !== 'COMPLETED' && status !== 'ERROR') {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await axios.get(`${API_URL}/status/${recordingId}`);
            const data = statusRes.data;

            if (data.status !== status || data.progress) {
                console.log(`Status: ${data.status}, Progress: ${data.progress}%`);
                status = data.status;
            }

            if (status === 'ERROR') {
                console.error('Processing failed:', data.error);
            }
        }

        console.log('Simulation completed successfully!');

    } catch (error: any) {
        console.error('Simulation failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

simulate();
