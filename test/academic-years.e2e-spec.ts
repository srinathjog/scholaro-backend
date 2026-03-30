import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { TenantMiddleware } from '../src/tenant.middleware';

describe('AcademicYears (e2e)', () => {
  let app: INestApplication;
  const TENANT_ID = '54c85b06-e47b-4958-ad49-fac351c00cef';
  const HEADERS = { 'x-tenant-id': TENANT_ID };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(new TenantMiddleware().use);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /academic-years', async () => {
    const res = await request(app.getHttpServer())
      .post('/academic-years')
      .set(HEADERS)
      .send({
        year: '2025-2026',
        start_date: '2025-06-01',
        end_date: '2026-03-31',
        is_active: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.year).toBe('2025-2026');
  });

  it('GET /academic-years', async () => {
    const res = await request(app.getHttpServer())
      .get('/academic-years')
      .set(HEADERS);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((y: any) => y.year === '2025-2026')).toBe(true);
  });

  it('GET /academic-years/active', async () => {
    const res = await request(app.getHttpServer())
      .get('/academic-years/active')
      .set(HEADERS);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('year', '2025-2026');
    expect(res.body.is_active).toBe(true);
  });
});
