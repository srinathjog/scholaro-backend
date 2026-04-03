require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query("SELECT * FROM academic_years WHERE tenant_id = '6c00009a-563a-462b-9af5-3e75ec1866d2'");
  console.log('Academic years:', JSON.stringify(r.rows, null, 2));

  if (r.rows.length === 0 || !r.rows.find(y => y.year === '2025-2026')) {
    console.log('Creating academic year 2025-2026...');
    await c.query(
      "INSERT INTO academic_years (id, tenant_id, year, start_date, end_date, is_active) VALUES (gen_random_uuid(), '6c00009a-563a-462b-9af5-3e75ec1866d2', '2025-2026', '2025-06-01', '2026-03-31', true)"
    );
    console.log('Created.');
  }
  await c.end();
}
main().catch(console.error);
