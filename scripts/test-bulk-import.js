require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const TENANT_ID = '6c00009a-563a-462b-9af5-3e75ec1866d2';

async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: 'admin2@example.com', password: '123456' });
    const opts = {
      hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function uploadCSV(token) {
  const csvPath = path.join(__dirname, '..', '..', 'students-bulk.csv');
  const fileContent = fs.readFileSync(csvPath);
  const boundary = '----FormBoundary' + Date.now();

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="tenant_id"\r\n\r\n`;
  body += `${TENANT_ID}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="students-bulk.csv"\r\n`;
  body += `Content-Type: text/csv\r\n\r\n`;

  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path: '/bulk-import/students', method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      }
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', d);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(fullBody); req.end();
  });
}

(async () => {
  const token = await getToken();
  console.log('Got token, uploading CSV...');
  await uploadCSV(token);
})().catch(console.error);
