const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
});

async function main() {
  await c.connect();
  
  const r = await c.query(`
    SELECT u.id, u.email, u.name, u.tenant_id, r.name as role_name
    FROM users u 
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'TEACHER' 
    LIMIT 3
  `);
  console.log('Teachers:', JSON.stringify(r.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
