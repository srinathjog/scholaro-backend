require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Check if table exists
  const check = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_settings'"
  );
  console.log('tenant_settings exists:', check.rows.length > 0);

  if (check.rows.length === 0) {
    console.log('Creating tenant_settings table...');
    await c.query(`
      CREATE TABLE tenant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        logo_url VARCHAR(500),
        primary_color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
        secondary_color VARCHAR(20) NOT NULL DEFAULT '#10B981',
        school_motto VARCHAR(300),
        contact_phone VARCHAR(20) NOT NULL DEFAULT '',
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Table created successfully.');
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
