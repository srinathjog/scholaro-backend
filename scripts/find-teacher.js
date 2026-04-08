const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
});

async function main() {
  await c.connect();
  
  // Find a teacher user to test with
  const r = await c.query(`
    SELECT u.id, u.email, u.name, u.roles, u.tenant_id 
    FROM users u 
    WHERE 'TEACHER' = ANY(u.roles) 
    LIMIT 3
  `);
  console.log('Teachers:', JSON.stringify(r.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
