import dotenv from 'dotenv';
import path from 'path';
import https from 'https';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found');
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('API Error:', json.error);
            } else {
                const flashModels = json.models.filter((m: any) => m.name.includes('flash')).map((m: any) => m.name);
                console.log(`Found ${flashModels.length} flash models:`);
                console.log(flashModels.join(', '));

                const fs = require('fs');
                fs.writeFileSync('models_oneline.txt', `Found ${flashModels.length} flash models:\n` + flashModels.join(', '));
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw response:', data);
        }
    });
}).on('error', (e) => {
    console.error('Request error:', e);
});
