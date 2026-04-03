// Simulate parent login and timeline fetch
const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const tenantId = 'a59c36ef-33f1-477d-b29b-a3ec158b0f6c';

  // 1. Login as parent
  console.log('=== STEP 1: Login as Vilas ===');
  const login = await request('POST', '/auth/login', {
    email: 'vilas.karmarkar@gmail.com',
    password: 'Welcome@Scholaro2026',
  }, { 'x-tenant-id': tenantId });
  console.log('Login status:', login.status);
  if (login.status !== 201) {
    console.log('Login failed:', login.body);
    return;
  }
  const token = login.body.access_token;
  console.log('Roles:', login.body.roles);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': tenantId,
  };

  // 2. Get children
  console.log('\n=== STEP 2: Get children ===');
  const children = await request('GET', '/parents/me/children', null, authHeaders);
  console.log('Children status:', children.status);
  console.log('Children:', JSON.stringify(children.body, null, 2));

  if (children.status !== 200 || !children.body.length) {
    console.log('No children found!');
    return;
  }

  const child = children.body[0];
  const enrollment = child.enrollments[0];
  console.log(`\nChild: ${child.first_name}, Class: ${enrollment.className}, ClassId: ${enrollment.class_id}`);

  // 3. Get activities feed for child's class
  console.log('\n=== STEP 3: Get activities feed ===');
  const feed = await request('GET', `/activities/feed?class_id=${enrollment.class_id}`, null, authHeaders);
  console.log('Feed status:', feed.status);
  if (Array.isArray(feed.body)) {
    console.log(`Feed count: ${feed.body.length}`);
    feed.body.forEach(a => console.log(`  - ${a.title} (${a.created_at})`));
  } else {
    console.log('Feed response:', JSON.stringify(feed.body));
  }

  // 4. Get daily logs
  console.log('\n=== STEP 4: Get daily logs ===');
  const today = new Date().toISOString().slice(0, 10);
  const logs = await request('GET', `/daily-logs/student/${enrollment.id}?date=${today}`, null, authHeaders);
  console.log('Logs status:', logs.status);
  console.log('Logs:', JSON.stringify(logs.body));

  // 5. Get attendance
  console.log('\n=== STEP 5: Get attendance ===');
  const att = await request('GET', `/parents/student/${child.id}/attendance?date=${today}`, null, authHeaders);
  console.log('Attendance status:', att.status);
  console.log('Attendance:', JSON.stringify(att.body));
}

main().catch(console.error);
