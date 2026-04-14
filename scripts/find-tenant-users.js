require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Check users table columns
  const cols = await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
  );
  console.log('=== users table columns ===');
  console.log(cols.rows.map(r => r.column_name).join(', '));

  // All users linked to this tenant via user_roles
  const r = await c.query(
    "SELECT u.id, u.email, u.name, r.name as role FROM users u INNER JOIN user_roles ur ON ur.user_id = u.id INNER JOIN roles r ON r.id = ur.role_id WHERE ur.tenant_id = 'd3bae035-41c9-4d08-abc9-79520190f861' ORDER BY r.name, u.name"
  );
  console.log('\n=== All users for tenant d3bae035... ===');
  console.log(`Total: ${r.rows.length}`);
  console.table(r.rows);

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
