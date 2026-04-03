const { Client } = require('pg');
const c = new Client('postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');
c.connect()
  .then(() => c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance' ORDER BY ordinal_position"))
  .then(r => { console.log(r.rows); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
