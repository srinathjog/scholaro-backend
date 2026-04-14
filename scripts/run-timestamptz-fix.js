// Run remaining timestamptz migrations (one-time fix)
const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');
  const stmts = [
    "ALTER TABLE attendance ALTER COLUMN check_in_time TYPE timestamptz USING check_in_time AT TIME ZONE 'UTC'",
    "ALTER TABLE classes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE sections ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE daily_logs ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE fee_structures ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE fees ALTER COLUMN last_reminder_sent TYPE timestamptz USING last_reminder_sent AT TIME ZONE 'UTC'",
    "ALTER TABLE academic_years ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE parent_students ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE enrollments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE teachers ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE teacher_assignments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'",
    "ALTER TABLE tenant_settings ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'",
    "ALTER TABLE tenants ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'"
  ];
  let ok = 0;
  for (const s of stmts) {
    try { await client.query(s); console.log('  OK:', s.substring(0, 75)); ok++; }
    catch (e) { console.log('SKIP:', s.substring(0, 75), '-', e.message); }
  }
  await client.end();
  console.log('\nDone:', ok, 'applied out of', stmts.length);
}
main().catch(e => { console.error(e); process.exit(1); });
