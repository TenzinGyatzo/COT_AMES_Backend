import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService);

  // Configuración de prefijo global
  app.setGlobalPrefix('api');

  // Configuración de CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000', // opcional
      'http://localhost:3001', // si aún lo usas
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Configuración de validación global
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

  // Configuración de Swagger
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Cotizador API')
      .setDescription('API para el sistema de cotizaciones')
      .setVersion('1.0')
      .addTag('cotizador')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Puerto dinámico
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(
      `📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`,
    );
  }
}
bootstrap();
