
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TenantMiddleware, TenantFallbackInterceptor } from './tenant.middleware';
import { RlsInterceptor } from './rls.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { json, urlencoded } from 'express';
import { DataSource } from 'typeorm';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));
  app.disable('x-powered-by');

  // Prevent browsers/CDNs from caching API responses
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Increase payload limits for large file uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://scholaro.app',
      /\.vercel\.app$/,
      /\.up\.railway\.app$/,
      /\.netlify\.app$/,
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });
  app.use(new TenantMiddleware().use);
  app.useGlobalInterceptors(
    new TenantFallbackInterceptor(),
    new RlsInterceptor(app.get(DataSource)),
  );

  // Legacy: serve any old locally-uploaded files (new uploads go to Supabase Storage)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Serve public assets (PWA logos, etc.)
  app.useStaticAssets(join(process.cwd(), 'public', 'assets'), {
    prefix: '/assets/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
