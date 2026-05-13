require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'create-class-planners-table.sql'), 'utf8');
const c = new Client(process.env.DATABASE_URL);
c.connect()
  .then(() => c.query(sql))
  .then(() => { console.log('class_planners table created (or already exists).'); c.end(); })
  .catch(e => { console.error('Error:', e.message); c.end(); process.exit(1); });
