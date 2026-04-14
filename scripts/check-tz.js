const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE data_type = 'timestamp without time zone' 
      AND table_schema = 'public' 
      AND column_name IN ('check_in_time','check_out_time','created_at','updated_at','last_reminder_sent')
    ORDER BY table_name
  `);
  console.log('Remaining timestamp (no tz) columns:', r.rows.length);
  r.rows.forEach(x => console.log(' ', x.table_name + '.' + x.column_name));
  if (r.rows.length === 0) console.log('  All clear! Every column is now timestamptz.');
  await c.end();
})();
