
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantMiddleware } from './tenant.middleware';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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

  // Legacy: serve any old locally-uploaded files (new uploads go to Supabase Storage)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
