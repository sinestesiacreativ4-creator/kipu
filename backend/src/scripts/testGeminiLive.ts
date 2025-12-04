/**
 * Test script to verify Gemini Live API connection
 * Run: npx ts-node src/scripts/testGeminiLive.ts
 */

import { WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    process.exit(1);
}

console.log('🧪 Testing Gemini Live API connection...');
console.log('📋 API Key:', API_KEY.substring(0, 10) + '...');

const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

console.log('🔌 Connecting to:', wsUrl.replace(API_KEY, '***'));

const ws = new WebSocket(wsUrl);

let setupSent = false;

ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Send setup message
    const setupMessage = {
        setup: {
            model: 'models/gemini-2.0-flash',
            generation_config: {
                response_modalities: ['AUDIO'],
                speech_config: {
                    voice_config: {
                        prebuilt_voice_config: {
                            voice_name: 'Puck'
                        }
                    }
                }
            },
            system_instruction: {
                parts: [{
                    text: 'Eres un asistente de prueba. Responde brevemente en español.'
                }]
            }
        }
    };
    
    console.log('📤 Sending setup message...');
    ws.send(JSON.stringify(setupMessage));
    setupSent = true;
    
    // Set timeout to close if no response
    setTimeout(() => {
        if (!setupSent) {
            console.error('❌ Timeout waiting for setup response');
            ws.close();
            process.exit(1);
        }
    }, 10000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', JSON.stringify(message, null, 2));
        
        if (message.setupComplete) {
            console.log('✅ Setup complete!');
            console.log('🎉 Gemini Live API is working correctly');
            ws.close();
            process.exit(0);
        }
        
        if (message.error) {
            console.error('❌ Error from Gemini:', message.error);
            ws.close();
            process.exit(1);
        }
        
        if (message.serverContent?.modelTurn) {
            console.log('✅ Model turn received - API is responding');
        }
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
});

ws.on('error', (error: any) => {
    console.error('❌ WebSocket error:', error.message);
    console.error('💡 Possible causes:');
    console.error('   - API key is invalid');
    console.error('   - Model gemini-2.0-flash-exp is not available for your account');
    console.error('   - Network connectivity issue');
    process.exit(1);
});

ws.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : 'No reason';
    console.log(`🔌 Connection closed (code: ${code}, reason: ${reasonStr})`);
    
    if (code === 1006) {
        console.error('❌ Abnormal closure - model may not be available');
    } else if (code === 1008) {
        console.error('❌ Policy violation - check API key permissions');
    }
    
    if (!setupSent) {
        console.error('❌ Connection closed before setup could be sent');
        process.exit(1);
    }
});

// Timeout after 15 seconds
setTimeout(() => {
    console.error('❌ Test timeout - no response from Gemini');
    ws.close();
    process.exit(1);
}, 15000);

