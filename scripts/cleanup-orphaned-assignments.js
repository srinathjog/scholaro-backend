// One-time cleanup: delete teacher_assignments that reference deleted classes
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Find orphaned assignments (class no longer exists)
    const { rows: orphans } = await client.query(`
      SELECT ta.id, ta.teacher_id, ta.class_id, ta.tenant_id
      FROM teacher_assignments ta
      LEFT JOIN classes c ON c.id = ta.class_id
      WHERE c.id IS NULL
    `);

    if (orphans.length === 0) {
      console.log('No orphaned teacher assignments found.');
      return;
    }

    console.log(`Found ${orphans.length} orphaned assignment(s):`);
    orphans.forEach((r) =>
      console.log(`  id=${r.id}  class_id=${r.class_id}  tenant=${r.tenant_id}`),
    );

    const ids = orphans.map((r) => r.id);
    const { rowCount } = await client.query(
      `DELETE FROM teacher_assignments WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    console.log(`Deleted ${rowCount} orphaned assignment(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
