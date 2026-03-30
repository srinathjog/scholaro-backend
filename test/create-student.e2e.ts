import axios from 'axios';

async function testCreateStudent() {
  const url = 'http://localhost:3000/students';
  const data = {
    first_name: 'Aarav',
    last_name: 'Sharma',
    gender: 'male',
    date_of_birth: '2018-05-10',
    admission_date: '2024-03-29',
    status: 'active',
  };
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': '54c85b06-e47b-4958-ad49-fac351c00cef',
  };

  try {
    const response = await axios.post(url, data, { headers });
    console.log('Student created:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testCreateStudent();
