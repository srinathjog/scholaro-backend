require('dotenv').config();
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%teacher%'"))
  .then(r => { console.log(r.rows); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
