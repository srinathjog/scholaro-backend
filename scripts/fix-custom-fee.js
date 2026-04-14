require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const studentId = '379fb96e-1ceb-42a5-bc29-f496bbec2f97';

  // Find the enrollment for this student
  const enrollments = await c.query(
    "SELECT id, custom_fee_amount FROM enrollments WHERE student_id = $1 AND status = 'active'",
    [studentId]
  );
  console.log('Enrollments:', enrollments.rows);

  for (const enrollment of enrollments.rows) {
    if (!enrollment.custom_fee_amount) {
      console.log(`Enrollment ${enrollment.id} has no custom fee set, skipping.`);
      continue;
    }

    const customAmount = parseFloat(enrollment.custom_fee_amount);
    // Update pending/overdue fees for this enrollment
    const result = await c.query(
      "UPDATE fees SET total_amount = $1, final_amount = $1 - discount_amount WHERE enrollment_id = $2 AND status IN ('pending', 'overdue')",
      [customAmount, enrollment.id]
    );
    console.log(`Updated ${result.rowCount} pending fee(s) for enrollment ${enrollment.id} to ₹${customAmount}`);
  }

  // Show current fees for this student
  const fees = await c.query(
    "SELECT f.id, f.description, f.total_amount, f.final_amount, f.paid_amount, f.status FROM fees f INNER JOIN enrollments e ON e.id = f.enrollment_id WHERE e.student_id = $1 ORDER BY f.due_date",
    [studentId]
  );
  console.log('\nCurrent fees for student:');
  console.table(fees.rows);

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
