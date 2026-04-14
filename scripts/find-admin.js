require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    "SELECT u.id, u.email, u.name FROM users u INNER JOIN user_roles ur ON ur.user_id = u.id INNER JOIN roles r ON r.id = ur.role_id WHERE ur.tenant_id = 'ba361bd2-8d04-4ff6-8984-b59131dc5f73' AND r.name = 'SCHOOL_ADMIN'"
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
