const axios = require('axios');

async function test() {
  try {
    // Login as a teacher (bulk imported with Welcome@Scholaro2026)
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      email: 'saritajog1959@gmail.com',
      password: 'Welcome@Scholaro2026',
      school_code: undefined,
    }, {
      headers: { 'x-tenant-id': '1d091250-6f76-4302-a039-51105589f0c8' },
    });
    const token = loginRes.data.access_token;
    console.log('Login OK, roles:', loginRes.data.roles);

    // Test settings/branding
    try {
      const r = await axios.get('http://localhost:3000/settings/branding', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('BRANDING OK');
    } catch (e) {
      console.log('BRANDING ERROR:', e.response?.status, e.response?.data);
    }

    // Test attendance/bulk-present
    try {
      const r = await axios.post('http://localhost:3000/attendance/bulk-present', {
        enrollment_ids: ['7f12d0ff-1472-4f67-a845-3e915eb73db4'],
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('BULK-PRESENT OK');
    } catch (e) {
      console.log('BULK-PRESENT ERROR:', e.response?.status, e.response?.data);
    }
  } catch (e) {
    console.log('LOGIN ERROR:', e.response?.status, e.response?.data || e.message);
  }
}

test();
