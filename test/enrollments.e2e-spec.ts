import axios from 'axios';

describe('Enrollments API', () => {
  const tenantId = '54c85b06-e47b-4958-ad49-fac351c00cef';
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };
  // Replace these UUIDs with real ones from your DB for a real test
  const enrollmentData = {
    student_id: '03061fab-8b92-4fb0-8346-d68f57bf1f9c',
    class_id: '667450f0-5138-4438-97fd-f67e1fd4c0ef',
    section_id: 'e94badad-6de3-4fd5-946a-553695d66573',
    academic_year_id: '93146365-5222-4e72-af8c-250dabf7baf1',
    roll_number: '12',
  };

  let createdEnrollmentId: string;

  it('should create an enrollment', async () => {
    try {
      const response = await axios.post('http://localhost:3000/enrollments', enrollmentData, { headers });
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.student_id).toBe(enrollmentData.student_id);
      createdEnrollmentId = response.data.id;
    } catch (error) {
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
      } else {
        console.error('Error:', error.message);
      }
      throw error;
    }
  });

  it('should get all enrollments for the tenant', async () => {
    const response = await axios.get('http://localhost:3000/enrollments', { headers });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    if (response.data.length > 0) {
      expect(response.data[0]).toHaveProperty('id');
      expect(response.data[0]).toHaveProperty('student_id');
      expect(response.data[0]).toHaveProperty('class_id');
      expect(response.data[0]).toHaveProperty('section_id');
      expect(response.data[0]).toHaveProperty('academic_year_id');
    }
  });
});
