// Run: node scripts/run-timestamptz.js
// Executes migrate-to-timestamptz.sql against DATABASE_URL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: Set DATABASE_URL environment variable first.');
    process.exit(1);
  }

  const sqlFile = path.join(__dirname, 'migrate-to-timestamptz.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 5);

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.\n');

  let success = 0;
  let skipped = 0;

  for (const stmt of statements) {
    const short = stmt.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await client.query(stmt);
      console.log(`  OK: ${short}`);
      success++;
    } catch (err) {
      console.log(`FAIL: ${short}`);
      console.log(`      ${err.message}\n`);
    }
  }

  await client.end();
  console.log(`\nDone: ${success} applied, ${skipped} skipped out of ${statements.length} statements.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
