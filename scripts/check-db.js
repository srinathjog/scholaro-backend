const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
});

async function main() {
  await c.connect();

  // Check tenant_settings table
  const r1 = await c.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tenant_settings' ORDER BY ordinal_position"
  );
  console.log('=== tenant_settings columns ===');
  if (r1.rows.length === 0) {
    console.log('TABLE DOES NOT EXIST');
  } else {
    r1.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
  }

  // Check attendance unique constraints
  const r2 = await c.query(
    "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'attendance'::regclass AND contype = 'u'"
  );
  console.log('\n=== attendance unique constraints ===');
  r2.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
