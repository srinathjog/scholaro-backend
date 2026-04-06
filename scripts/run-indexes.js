const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'postgres',
  url: 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

ds.initialize().then(async () => {
  const queries = [
    'CREATE INDEX IF NOT EXISTS idx_attendance_enrollment_date ON attendance (enrollment_id, date)',
  ];
  for (const q of queries) {
    try {
      await ds.query(q);
      console.log('OK:', q);
    } catch (e) {
      console.log('SKIP:', e.message.slice(0, 80));
    }
  }
  await ds.destroy();
}).catch(e => console.error(e.message));
