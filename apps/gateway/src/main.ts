import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    }),
  );
  app.enableShutdownHooks();

  if (process.env.API_DOCS_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('二手非标商品 SaaS API')
      .setDescription('前端统一通过 Gateway 调用。所有业务接口均以 /api 为前缀。')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'x-tenant-id', in: 'header', description: '租户 ID' },
        'tenant-id',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(process.env.GATEWAY_PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
