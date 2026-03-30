import axios from 'axios';

describe('GET /students', () => {
  it('should return a list of students for the given tenant', async () => {
    const url = 'http://localhost:3000/students';
    const headers = {
      'Content-Type': 'application/json',
      'x-tenant-id': '54c85b06-e47b-4958-ad49-fac351c00cef',
    };

    const response = await axios.get(url, { headers });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    if (response.data.length > 0) {
      expect(response.data[0]).toHaveProperty('id');
      expect(response.data[0]).toHaveProperty('first_name');
      expect(response.data[0]).toHaveProperty('tenant_id');
    }
  });
});
