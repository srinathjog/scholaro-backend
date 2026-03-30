// Usage: node test-sections.js <TENANT_ID> <CLASS_ID>
// Example: node test-sections.js 54c85b06-e47b-4958-ad49-fac351c00cef 21367da1-3b1d-4122-84cb-3be3649c36d2

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function main() {
  const [,, TENANT_ID, CLASS_ID] = process.argv;
  if (!TENANT_ID || !CLASS_ID) {
    console.error('Usage: node test-sections.js <TENANT_ID> <CLASS_ID>');
    process.exit(1);
  }

  const headers = { 'x-tenant-id': TENANT_ID };

  // 1. Create a section
  const sectionPayload = {
    name: 'B',
    class_id: CLASS_ID,
  };

  try {
    const createRes = await axios.post(`${BASE_URL}/sections`, sectionPayload, { headers });
    console.log('Section created:', createRes.data);
  } catch (err) {
    console.error('Error creating section:', err.response?.data || err.message);
    process.exit(1);
  }

  // 2. Get all sections for the class
  try {
    const getRes = await axios.get(`${BASE_URL}/sections`, {
      headers,
      params: { classId: CLASS_ID },
    });
    console.log('Sections for class:', getRes.data);
  } catch (err) {
    console.error('Error fetching sections:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
