import axios from 'axios';

describe('POST /students', () => {
  it('should create a student for the given tenant', async () => {
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

    const response = await axios.post(url, data, { headers });
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data.first_name).toBe('Aarav');
    expect(response.data.tenant_id).toBe('54c85b06-e47b-4958-ad49-fac351c00cef');
  });
});
