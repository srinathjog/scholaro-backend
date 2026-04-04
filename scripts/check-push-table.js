const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');

async function run() {
  await c.connect();
  const r = await c.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions')");
  console.log('push_subscriptions exists:', r.rows[0].exists);

  if (r.rows[0].exists === false) {
    console.log('Creating push_subscriptions table...');
    await c.query(`
      CREATE TABLE push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(500) NOT NULL,
        auth VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_push_subs_user_tenant ON push_subscriptions (user_id, tenant_id);
      CREATE INDEX idx_push_subs_tenant ON push_subscriptions (tenant_id);
    `);
    console.log('Table created!');
  }

  await c.end();
}
run().catch(e => { console.error(e.message); c.end(); });
