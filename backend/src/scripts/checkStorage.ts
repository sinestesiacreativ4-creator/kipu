import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStorage() {
    console.log('--- Checking Supabase Storage ---');

    // 1. List Buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
        console.error('❌ Error listing buckets:', bucketsError);
        return;
    }

    console.log('✅ Buckets found:', buckets.map(b => b.name));

    const recordingsBucket = buckets.find(b => b.name === 'recordings');
    if (!recordingsBucket) {
        console.error('❌ "recordings" bucket NOT found!');
        return;
    }

    console.log('✅ "recordings" bucket exists.');

    // 2. List files in bucket (root)
    const { data: files, error: filesError } = await supabase
        .storage
        .from('recordings')
        .list();

    if (filesError) {
        console.error('❌ Error listing files in "recordings":', filesError);
        return;
    }

    console.log(`✅ Found ${files.length} files/folders in root of "recordings":`);
    files.forEach(f => console.log(` - ${f.name} (${f.metadata?.mimetype})`));

    console.log('--- Check Complete ---');
}

checkStorage();
