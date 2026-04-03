const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');

c.connect().then(async () => {
  const r1 = await c.query('SELECT id,title,class_id,created_by,created_at FROM activities ORDER BY created_at DESC LIMIT 5');
  console.log('=== RECENT ACTIVITIES ===');
  console.table(r1.rows);

  const r2 = await c.query(`SELECT e.student_id,s.first_name,e.class_id,cl.name as class_name FROM enrollments e JOIN students s ON s.id=e.student_id JOIN classes cl ON cl.id=e.class_id WHERE e.status='active' LIMIT 10`);
  console.log('=== ACTIVE ENROLLMENTS ===');
  console.table(r2.rows);

  const r3 = await c.query(`SELECT ta.teacher_id,ta.class_id,cl.name as class_name,u.name as teacher_name FROM teacher_assignments ta JOIN classes cl ON cl.id=ta.class_id JOIN users u ON u.id=ta.teacher_id LIMIT 10`);
  console.log('=== TEACHER ASSIGNMENTS ===');
  console.table(r3.rows);

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
