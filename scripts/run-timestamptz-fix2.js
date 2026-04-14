const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('Connected. Fixing remaining 6 tables...\n');
  const stmts = [
    "ALTER TABLE announcements ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE messages ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE parents ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE payments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE students ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE users ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE users ALTER COLUMN reset_password_expires TYPE timestamptz USING reset_password_expires AT TIME ZONE 'UTC'"
  ];
  let ok = 0;
  for (const s of stmts) {
    try { await c.query(s); console.log('  OK:', s.substring(0, 80)); ok++; }
    catch (e) { console.log('FAIL:', s.substring(0, 80), '-', e.message); }
  }
  await c.end();
  console.log('\nDone:', ok, 'applied out of', stmts.length);
})();
