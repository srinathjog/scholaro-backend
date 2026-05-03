/**
 * Ghost-Hunter: Find (and optionally delete) Supabase Storage files that are
 * no longer referenced by any row in the activity_media database table.
 *
 * Usage:
 *   node scripts/cleanup-orphaned-media.js           # dry-run (list only)
 *   node scripts/cleanup-orphaned-media.js --delete  # delete orphaned files
 *
 * Required env vars (load from .env or export before running):
 *   SUPABASE_URL              e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service-role JWT (has storage admin access)
 *   DATABASE_URL              postgres connection string
 *                             OR DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const DRY_RUN = !process.argv.includes('--delete');
const BUCKET = 'activity-media';
const PAGE_LIMIT = 100; // Supabase list() max per request

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPgClient() {
  if (process.env.DATABASE_URL) {
    return new Client({ connectionString: process.env.DATABASE_URL });
  }
  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
  });
}

/**
 * List ALL file paths in a Supabase Storage bucket/folder, handling pagination.
 * Returns an array of full storage paths like "tenantId/1234567890_photo.jpg".
 */
async function listAllStorageFiles(supabase, folder = '') {
  const allFiles = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: PAGE_LIMIT, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`Storage list failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name;
      if (item.id === null) {
        // This is a "folder" — recurse into it
        const sub = await listAllStorageFiles(supabase, fullPath);
        allFiles.push(...sub);
      } else {
        // This is a file
        allFiles.push(fullPath);
      }
    }

    if (data.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  return allFiles;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const pg = buildPgClient();
  await pg.connect();

  try {
    console.log(`\n📦  Listing all files in Supabase bucket "${BUCKET}"…`);
    const storageFiles = await listAllStorageFiles(supabase);
    console.log(`   Found ${storageFiles.length} file(s) in storage.`);

    console.log('\n🗄️   Fetching all media_url values from activity_media table…');
    const { rows } = await pg.query('SELECT media_url FROM activity_media');
    const dbUrls = new Set(rows.map((r) => r.media_url));
    console.log(`   Found ${dbUrls.size} URL(s) in the database.`);

    // Build the public URL prefix so we can match storage paths → DB URLs
    const { data: { publicUrl: sampleUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl('__probe__');
    // sampleUrl = "https://xxxx.supabase.co/storage/v1/object/public/activity-media/__probe__"
    const urlPrefix = sampleUrl.replace('/__probe__', '/');

    console.log('\n🔍  Comparing storage vs database…');
    const orphans = storageFiles.filter((path) => {
      const publicUrl = urlPrefix + path;
      return !dbUrls.has(publicUrl);
    });

    if (orphans.length === 0) {
      console.log('\n✅  No orphaned files found. Storage is clean!');
      return;
    }

    console.log(`\n⚠️   Found ${orphans.length} orphaned file(s):\n`);
    for (const p of orphans) {
      console.log(`  • ${p}`);
    }

    if (DRY_RUN) {
      console.log(
        `\n💡  Dry-run mode — nothing deleted. Re-run with --delete to remove these files.`,
      );
      return;
    }

    // ── Delete mode ───────────────────────────────────────────────────────────
    console.log('\n🗑️   Deleting orphaned files…');
    const BATCH = 20; // Supabase remove() accepts an array of paths
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < orphans.length; i += BATCH) {
      const batch = orphans.slice(i, i + BATCH);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) {
        console.error(`   ❌  Batch ${i / BATCH + 1} failed: ${error.message}`);
        failed += batch.length;
      } else {
        deleted += batch.length;
        console.log(`   ✓  Deleted batch ${i / BATCH + 1} (${batch.length} file(s))`);
      }
    }

    console.log(`\n✅  Done — deleted ${deleted}, failed ${failed}.`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error('\n💥  Fatal error:', err.message);
  process.exit(1);
});
