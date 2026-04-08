const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
});

async function main() {
  await c.connect();

  // Check tenant_settings column defaults
  const r1 = await c.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'tenant_settings'
    ORDER BY ordinal_position
  `);
  console.log('=== tenant_settings columns ===');
  r1.rows.forEach(r => console.log(`  ${r.column_name}: nullable=${r.is_nullable}, default=${r.column_default}`));

  // Check if there are any rows
  const r2 = await c.query('SELECT COUNT(*) as cnt FROM tenant_settings');
  console.log('\ntenant_settings row count:', r2.rows[0].cnt);

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
