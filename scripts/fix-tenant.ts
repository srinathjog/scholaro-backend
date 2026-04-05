const { Client } = require('pg');
const bcrypt = require('bcryptjs');

(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();

  // 1. Update tenant_code to uppercase
  await c.query(
    "UPDATE tenants SET tenant_code = 'BEGINNERSACADEMY' WHERE id = 'a59c36ef-33f1-477d-b29b-a3ec158b0f6c'"
  );
  console.log('tenant_code updated to BEGINNERSACADEMY');

  // 2. Hash password and update
  const hash = await bcrypt.hash('123456', 10);
  await c.query(
    "UPDATE users SET password_hash = $1 WHERE email = 'prakashoak@beginnersacademy.com' AND tenant_id = 'a59c36ef-33f1-477d-b29b-a3ec158b0f6c'",
    [hash]
  );
  console.log('password_hash updated (bcrypt hashed)');

  // 3. Verify
  const r = await c.query(
    "SELECT t.tenant_code, u.email FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE t.id = 'a59c36ef-33f1-477d-b29b-a3ec158b0f6c' AND u.email = 'prakashoak@beginnersacademy.com'"
  );
  console.log('Verified:', r.rows[0]);

  await c.end();
})();
