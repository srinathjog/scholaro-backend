// Usage: node test-auth.js <TENANT_ID>
// Example: node test-auth.js 54c85b06-e47b-4958-ad49-fac351c00cef

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const REGISTER_PAYLOAD = {
  name: 'admin2@example.com',
  email: 'admin2@example.com',
  password: '123456',
};
const LOGIN_PAYLOAD = {
  email: 'admin2@example.com',
  password: '123456',
};

async function main() {
  const [,, TENANT_ID] = process.argv;
  if (!TENANT_ID) {
    console.error('Usage: node test-auth.js <TENANT_ID>');
    process.exit(1);
  }
  const headers = { 'x-tenant-id': TENANT_ID };

  // Register
  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, REGISTER_PAYLOAD, { headers });
    console.log('Register response:', regRes.data);
  } catch (err) {
    if (err.response && err.response.status === 409) {
      console.log('User already registered, continuing to login...');
    } else {
      console.error('Register error:', err.response?.data || err.message);
      process.exit(1);
    }
  }

  // Login
  let token;
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, LOGIN_PAYLOAD, { headers });
    console.log('Login response:', loginRes.data);
    token = loginRes.data?.access_token;
    if (!token) {
      console.error('No access_token in login response');
      process.exit(1);
    }
  } catch (err) {
    console.error('Login error:', err.response?.data || err.message);
    process.exit(1);
  }

  // Fetch enrollments
  try {
    const enrollHeaders = { ...headers, Authorization: `Bearer ${token}` };
    const enrollRes = await axios.get(`${BASE_URL}/enrollments`, { headers: enrollHeaders });
    const enrollments = enrollRes.data;
    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      console.error('No enrollments found for this tenant. Please create one first.');
      process.exit(1);
    }
    const enrollmentId = enrollments[0].id || enrollments[0]._id;
    console.log('---');
    console.log('JWT token:', token);
    console.log('Sample enrollment_id:', enrollmentId);
    console.log('---');
  } catch (err) {
    console.error('Error fetching enrollments:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
