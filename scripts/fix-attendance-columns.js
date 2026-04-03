const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');

async function run() {
  await c.connect();
  const queries = [
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP NULL`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMP NULL`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pickup_by_name VARCHAR(200) NULL`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pickup_by_photo_url TEXT NULL`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pickup_notes TEXT NULL`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS checkout_by UUID NULL`,
  ];
  for (const q of queries) {
    const r = await c.query(q);
    console.log('OK:', q.split('ADD COLUMN IF NOT EXISTS ')[1]);
  }
  // Verify
  const verify = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance' ORDER BY ordinal_position");
  console.log('\nAll columns now:', verify.rows.map(r => r.column_name));
  await c.end();
}
run().catch(e => { console.error(e.message); c.end(); });
