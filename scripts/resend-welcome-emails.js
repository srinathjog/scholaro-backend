/**
 * resend-welcome-emails.js
 * 
 * Resends welcome emails to all PARENT users for a given tenant.
 * Use this when bulk-import emails failed due to rate limiting.
 * 
 * Usage:
 *   node scripts/resend-welcome-emails.js <tenant-id>
 * 
 * Optional: only re-send to parents created in the last N days (default 7):
 *   DAYS=14 node scripts/resend-welcome-emails.js <tenant-id>
 */

require('dotenv').config();
const { Client } = require('pg');
const { Resend } = require('resend');

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error('Usage: node scripts/resend-welcome-emails.js <tenant-id>');
  process.exit(1);
}

const DAYS = parseInt(process.env.DAYS || '7', 10);
const TEMP_PASSWORD = 'Welcome@Scholaro2026';
const LOGIN_URL = process.env.FRONTEND_URL || 'https://scholaro.app';
const SEND_INTERVAL_MS = 600; // ~1.6/s — safely under Resend free-tier 2/s limit

const resend = new Resend(process.env.RESEND_API_KEY || process.env.MAIL_PASSWORD);
const FROM = process.env.MAIL_FROM || process.env.SMTP_FROM || 'Scholaro <noreply@scholaro.app>';

function buildHtml(email, studentName, schoolName, schoolCode) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Welcome to Scholaro</title></head>
<body style="margin:0;padding:0;background-color:#F0F2F5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F2F5;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4F46E5 100%);padding:40px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#A5B4FC;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Scholaro</p>
        <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:700;line-height:1.3;">Welcome, Parent!</h1>
        <p style="margin:12px 0 0;color:#C7D2FE;font-size:15px;line-height:1.5;">Your child's school, in your pocket</p>
      </td></tr>
      <tr><td style="padding:36px 32px 24px;">
        <p style="margin:0 0 16px;color:#1F2937;font-size:17px;line-height:1.6;">
          Your child <strong style="color:#312E81;">${studentName}</strong> is now registered at <strong style="color:#312E81;">${schoolName}</strong>.
        </p>
        <p style="margin:0 0 28px;color:#6B7280;font-size:15px;line-height:1.7;">
          No more WhatsApp groups! Log in to Scholaro to see daily photos, meals, attendance, and fees — all in one beautiful app.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:1px solid #C7D2FE;border-radius:12px;margin:0 0 28px;">
          <tr><td style="padding:24px;">
            <p style="margin:0 0 16px;color:#4338CA;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Your Login Details</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;color:#6B7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</td>
                <td style="padding:10px 0;color:#1F2937;font-size:15px;text-align:right;">${email}</td>
              </tr>
              <tr><td colspan="2" style="border-top:1px solid #C7D2FE;"></td></tr>
              <tr>
                <td style="padding:10px 0;color:#6B7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Password</td>
                <td style="padding:10px 0;color:#1F2937;font-size:15px;text-align:right;font-family:monospace;">${TEMP_PASSWORD}</td>
              </tr>
              ${schoolCode ? `<tr><td colspan="2" style="border-top:1px solid #C7D2FE;"></td></tr>
              <tr>
                <td style="padding:10px 0;color:#6B7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">School Code</td>
                <td style="padding:10px 0;color:#1F2937;font-size:15px;text-align:right;font-family:monospace;">${schoolCode}</td>
              </tr>` : ''}
            </table>
          </td></tr>
        </table>
        <p style="margin:0 0 28px;color:#6B7280;font-size:14px;line-height:1.6;">
          Please change your password after your first login.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${LOGIN_URL}" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
              Open Scholaro App →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#F9FAFB;padding:24px 32px;text-align:center;border-top:1px solid #E5E7EB;">
        <p style="margin:0;color:#9CA3AF;font-size:13px;">© 2026 Scholaro · Built for preschools</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // Fetch school name and code for this tenant
  const tenantRow = await db.query(
    `SELECT name, tenant_code FROM tenants WHERE id = $1`,
    [TENANT_ID],
  );
  if (!tenantRow.rows.length) {
    console.error(`Tenant ${TENANT_ID} not found`);
    await db.end();
    process.exit(1);
  }
  const schoolName = tenantRow.rows[0].name;
  const schoolCode = tenantRow.rows[0].tenant_code || '';
  console.log(`School: ${schoolName} (code: ${schoolCode})`);

  // Fetch all PARENT users for this tenant created in the last N days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);

  const result = await db.query(
    `SELECT DISTINCT u.id, u.email, u.name,
            COALESCE(
              (SELECT s.first_name || ' ' || s.last_name
               FROM parent_students ps
               JOIN students s ON s.id = ps.student_id
               WHERE ps.user_id = u.id AND ps.tenant_id = $1
               LIMIT 1),
              'your child'
            ) AS student_name
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.tenant_id = $1
       AND r.name = 'PARENT'
       AND u.created_at >= $2
     ORDER BY u.email`,
    [TENANT_ID, cutoff.toISOString()],
  );

  await db.end();

  const parents = result.rows;
  console.log(`\nFound ${parents.length} PARENT users created in the last ${DAYS} days\n`);

  if (!parents.length) {
    console.log('Nothing to send. Try: DAYS=30 node scripts/resend-welcome-emails.js <tenant-id>');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const parent of parents) {
    const subject = `${parent.student_name}'s school ${schoolName} is now on Scholaro! 🎉`;
    const html = buildHtml(parent.email, parent.student_name, schoolName, schoolCode);

    try {
      const { error } = await resend.emails.send({ from: FROM, to: parent.email, subject, html });
      if (error) throw new Error(error.message);
      console.log(`  ✓ Sent to ${parent.email} (${parent.student_name})`);
      sent++;
    } catch (err) {
      console.error(`  ✗ Failed for ${parent.email}: ${err.message}`);
      failed++;
    }

    // Rate-limit: wait between sends
    if (sent + failed < parents.length) {
      await delay(SEND_INTERVAL_MS);
    }
  }

  console.log(`\nDone — ${sent} sent, ${failed} failed`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
