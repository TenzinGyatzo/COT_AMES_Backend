import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

loadEnv({ path: '.env' });

function isProductionEnv(nodeEnv?: string): boolean {
  return (nodeEnv || '').toLowerCase() === 'production';
}

/** Fail-fast NFR-3 antes de bootstrap Nest (evita seed/Mongo con secretos inválidos). */
function assertProductionSecretsFromEnv() {
  if (!isProductionEnv(process.env.NODE_ENV)) return;

  const mongoUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET || '';
  const insecure =
    !jwtSecret ||
    jwtSecret === 'changeme' ||
    jwtSecret === 'cambiar-por-secreto-largo-en-local' ||
    jwtSecret.length < 16;

  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!mongoUri || insecure) {
    throw new Error(
      'Producción: MONGODB_URI y JWT_SECRET seguro son obligatorios (NFR-3).',
    );
  }
  if (corsOrigins.length === 0) {
    throw new Error('Producción: CORS_ORIGIN es obligatorio (NFR-3).');
  }
}

async function bootstrap() {
  assertProductionSecretsFromEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Logos de tenant (Story 2.2) — fuera del prefijo /api
  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads' });

  app.setGlobalPrefix('api');

  const corsOrigin = configService.get<string>('CORS_ORIGIN') || '';
  const origins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Cotizador API')
      .setDescription('API para el sistema de cotizaciones AMES')
      .setVersion('1.0')
      .addTag('cotizador')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  const nodeEnv = configService.get<string>('NODE_ENV');
  if (nodeEnv === 'development') {
    console.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
    if (swaggerEnabled) {
      console.log(
        `📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`,
      );
    }
  }
}
bootstrap();
