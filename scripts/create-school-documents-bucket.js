// One-time script: create the school-documents Supabase bucket (public, no MIME restrictions)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const bucketName = 'school-documents';

  console.log(`Creating bucket "${bucketName}"...`);
  const { data, error } = await supabase.storage.createBucket(bucketName, {
    public: true,
    allowedMimeTypes: null,
  });

  if (error) {
    if (error.message.toLowerCase().includes('already exists')) {
      console.log('Bucket already exists — updating to ensure public + no MIME restrictions...');
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: null,
      });
      if (updateError) {
        console.error('Update error:', updateError.message);
      } else {
        console.log('Bucket updated: public=true, no MIME restrictions.');
      }
    } else {
      console.error('Create error:', error.message);
    }
  } else {
    console.log('Bucket created successfully:', data);
  }
}

main().catch(console.error);
