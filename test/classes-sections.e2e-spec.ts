import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TENANT_ID = '54c85b06-e47b-4958-ad49-fac351c00cef'; // Change to your tenant UUID if needed
const HEADERS = { 'x-tenant-id': TENANT_ID };

async function testClassesAndSections() {
  try {
    // 1. Create a class
    const classRes = await axios.post(
      `${BASE_URL}/classes`,
      {
        name: 'Nursery',
        description: 'Nursery class',
      },
      { headers: HEADERS }
    );
    console.log('Created Class:', classRes.data);
    const classId = classRes.data.id;

    // 2. Create a section for the class
    const sectionRes = await axios.post(
      `${BASE_URL}/sections`,
      {
        class_id: classId,
        name: 'A',
      },
      { headers: HEADERS }
    );
    console.log('Created Section:', sectionRes.data);

    // 3. Get all classes
    const allClassesRes = await axios.get(`${BASE_URL}/classes`, { headers: HEADERS });
    console.log('All Classes:', allClassesRes.data);

    // 4. Get all sections for the class
    const allSectionsRes = await axios.get(`${BASE_URL}/sections`, {
      headers: HEADERS,
      params: { classId },
    });
    console.log('Sections for Class:', allSectionsRes.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error:', error.response?.data || error.message);
    } else {
      console.error('Unexpected Error:', error);
    }
  }
}

testClassesAndSections();
