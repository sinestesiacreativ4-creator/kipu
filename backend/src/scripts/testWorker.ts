import dotenv from 'dotenv';
dotenv.config();

console.log('Testing worker import...');
console.log('Environment variables:');
console.log('- REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');

try {
    console.log('\nImporting worker...');
    require('./workers/audioWorker');
    console.log('Worker imported successfully!');

    // Keep process alive to see worker logs
    setTimeout(() => {
        console.log('\nWorker should be running now. Check for worker logs above.');
        process.exit(0);
    }, 5000);
} catch (error) {
    console.error('Error importing worker:', error);
    process.exit(1);
}
