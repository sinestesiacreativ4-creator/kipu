import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verify() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Error: GEMINI_API_KEY not found');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // List models
    /*
    // Note: The Node SDK doesn't have a direct listModels method on GoogleGenerativeAI instance easily accessible 
    // without using the ModelManager or similar which might not be exported directly in this version.
    // Let's try to just test a different model name 'gemini-1.5-flash-latest' or 'gemini-1.5-pro' to see if it's a specific model issue.
    */

    const modelsToTry = ['gemini-2.5-flash'];

    for (const modelName of modelsToTry) {
        console.log(`\nTesting model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = 'Hello';
            const result = await model.generateContent(prompt);
            const response = await result.response;
            console.log(`SUCCESS with ${modelName}:`, response.text());
            return; // Exit on first success
        } catch (error: any) {
            console.error(`FAILED with ${modelName}:`, error.message.split('\n')[0]);
        }
    }
    console.error('All models failed.');
    process.exit(1);
}

verify();
