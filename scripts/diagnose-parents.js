const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');

c.connect().then(async () => {
  // Check parent-student links for Sagar (PlayGroup student)
  const r1 = await c.query(`
    SELECT ps.parent_user_id, ps.student_id, u.name as parent_name, u.email as parent_email, s.first_name as student_name
    FROM parent_students ps
    JOIN users u ON u.id = ps.parent_user_id
    JOIN students s ON s.id = ps.student_id
    ORDER BY ps.created_at DESC
  `);
  console.log('=== PARENT-STUDENT LINKS ===');
  console.table(r1.rows);

  // Check JWT roles for the parent
  const r2 = await c.query(`
    SELECT ur.user_id, u.name, u.email, r.name as role_name
    FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'PARENT'
  `);
  console.log('=== USERS WITH PARENT ROLE ===');
  console.table(r2.rows);

  // Check tenant_id consistency
  const r3 = await c.query(`
    SELECT 'activities' as src, tenant_id, count(*) as cnt FROM activities GROUP BY tenant_id
    UNION ALL
    SELECT 'enrollments', tenant_id, count(*) FROM enrollments GROUP BY tenant_id
    UNION ALL
    SELECT 'parent_students', tenant_id, count(*) FROM parent_students GROUP BY tenant_id
  `);
  console.log('=== TENANT IDs ===');
  console.table(r3.rows);

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
