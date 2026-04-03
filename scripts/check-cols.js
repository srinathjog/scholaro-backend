require('dotenv').config();
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect()
  .then(() => c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='teachers' ORDER BY ordinal_position"))
  .then(r => { console.log(r.rows); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
