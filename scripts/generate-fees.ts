const { Client } = require('pg');

(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();

  const tenantId = 'a59c36ef-33f1-477d-b29b-a3ec158b0f6c';

  // 1. Get fee structures for this tenant
  const structures = await c.query(
    `SELECT id, name, class_id, amount, due_date FROM fee_structures WHERE tenant_id = $1 ORDER BY due_date`,
    [tenantId]
  );
  console.log('Fee Structures:', structures.rows);

  if (structures.rows.length === 0) {
    console.log('No fee structures found.');
    await c.end();
    return;
  }

  // 2. For each structure, get active enrollments in its class
  let totalCreated = 0;
  for (const s of structures.rows) {
    const enrollments = await c.query(
      `SELECT id FROM enrollments WHERE tenant_id = $1 AND class_id = $2 AND status = 'active'`,
      [tenantId, s.class_id]
    );
    console.log(`Structure "${s.name}" (class ${s.class_id}): ${enrollments.rows.length} active enrollments`);

    if (enrollments.rows.length === 0) continue;

    // 3. Check which fees already exist (avoid duplicates)
    for (const e of enrollments.rows) {
      const existing = await c.query(
        `SELECT id FROM fees WHERE tenant_id = $1 AND enrollment_id = $2 AND fee_structure_id = $3`,
        [tenantId, e.id, s.id]
      );
      if (existing.rows.length > 0) {
        console.log(`  Skipped: enrollment ${e.id} already has fee for structure ${s.id}`);
        continue;
      }

      // 4. Create fee record
      await c.query(
        `INSERT INTO fees (tenant_id, enrollment_id, fee_structure_id, description, total_amount, discount_amount, final_amount, paid_amount, due_date, status)
         VALUES ($1, $2, $3, $4, $5, 0, $5, 0, $6, 'pending')`,
        [tenantId, e.id, s.id, s.name, s.amount, s.due_date]
      );
      totalCreated++;
      console.log(`  Created fee for enrollment ${e.id}`);
    }
  }

  console.log(`\nDone. Total fees created: ${totalCreated}`);

  // 5. Verify fees exist
  const allFees = await c.query(
    `SELECT f.id, f.description, f.final_amount, f.due_date, f.status, e.student_id
     FROM fees f
     JOIN enrollments e ON e.id = f.enrollment_id
     WHERE f.tenant_id = $1
     ORDER BY f.due_date`,
    [tenantId]
  );
  console.log('\nAll fees for this tenant:', allFees.rows);

  await c.end();
})();
