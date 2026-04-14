// Run: node scripts/run-rls.js
// Executes enable-rls.sql against the DATABASE_URL from your .env or environment
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: Set DATABASE_URL environment variable first.');
    process.exit(1);
  }

  const sqlFile = path.join(__dirname, 'enable-rls.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Split into individual statements (skip empty/comment-only blocks)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 5);

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.\n');

  let success = 0;
  let skipped = 0;

  for (const stmt of statements) {
    const short = stmt.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await client.query(stmt);
      console.log(`  OK: ${short}...`);
      success++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`SKIP: ${short}... (already exists)`);
        skipped++;
      } else {
        console.error(`FAIL: ${short}...`);
        console.error(`      ${err.message}\n`);
      }
    }
  }

  console.log(`\nDone. ${success} applied, ${skipped} skipped.`);
  await client.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
