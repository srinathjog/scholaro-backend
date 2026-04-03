const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');

c.connect().then(async () => {
  // Art Class activity tenant
  const r1 = await c.query(`SELECT id, title, class_id, tenant_id, created_by FROM activities WHERE id = '38029c99-94bc-42a5-8479-d8400ab1a315'`);
  console.log('=== ART CLASS ACTIVITY ===');
  console.table(r1.rows);

  // Sagar's enrollment tenant
  const r2 = await c.query(`SELECT id, student_id, class_id, tenant_id FROM enrollments WHERE student_id = '39177145-109a-4927-9fae-0184c74fabc2'`);
  console.log('=== SAGAR ENROLLMENT ===');
  console.table(r2.rows);

  // PlayGroup class — which tenant?
  const r3 = await c.query(`SELECT id, name, tenant_id FROM classes WHERE name ILIKE '%play%'`);
  console.log('=== PLAYGROUP CLASSES ===');
  console.table(r3.rows);

  // Anitha's user tenant
  const r4 = await c.query(`SELECT id, name, email, tenant_id FROM users WHERE id = '8e7a7c6f-6285-4a86-ab4c-ae8300376525'`);
  console.log('=== ANITHA USER ===');
  console.table(r4.rows);

  // Sagar's parent tenant
  const r5 = await c.query(`SELECT id, name, email, tenant_id FROM users WHERE id = '39929852-5f31-4cbb-846e-4167795ea73a'`);
  console.log('=== SAGAR PARENT (VILAS) ===');
  console.table(r5.rows);

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
