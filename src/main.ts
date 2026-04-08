
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantMiddleware, TenantFallbackInterceptor } from './tenant.middleware';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
  });
  app.use(new TenantMiddleware().use);
  app.useGlobalInterceptors(new TenantFallbackInterceptor());

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
