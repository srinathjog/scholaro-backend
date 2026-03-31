// Usage: node mark-attendance.js <tenant_id> <teacher_email> <teacher_password> <enrollment_id> <date> <status>
// Example: node mark-attendance.js 54c85b06-e47b-4958-ad49-fac351c00cef teacher1@test.com 123456 97f72ba3-fa4b-446b-bccf-9b9d5a4f569a 2026-03-30 present

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function main() {
  const [,, TENANT_ID, TEACHER_EMAIL, TEACHER_PASSWORD, ENROLLMENT_ID, DATE, STATUS] = process.argv;
  if (!TENANT_ID || !TEACHER_EMAIL || !TEACHER_PASSWORD || !ENROLLMENT_ID || !DATE || !STATUS) {
    console.error('Usage: node mark-attendance.js <tenant_id> <teacher_email> <teacher_password> <enrollment_id> <date> <status>');
    process.exit(1);
  }
  const headers = { 'x-tenant-id': TENANT_ID };

  // Login as teacher
  let token;
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEACHER_EMAIL,
      password: TEACHER_PASSWORD,
    }, { headers });
    token = loginRes.data?.access_token;
    if (!token) {
      console.error('No access_token in login response');
      process.exit(1);
    }
    console.log('Login successful.');
  } catch (err) {
    console.error('Login error:', err.response?.data || err.message);
    process.exit(1);
  }

  // Mark attendance
  try {
    const attendanceHeaders = { ...headers, Authorization: `Bearer ${token}` };
    const payload = {
      enrollment_id: ENROLLMENT_ID,
      date: DATE,
      status: STATUS,
    };
    const res = await axios.post(`${BASE_URL}/attendance`, payload, { headers: attendanceHeaders });
    console.log('Attendance marked:', res.data);
  } catch (err) {
    console.error('Attendance error:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
