import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = Number(process.env.CORE_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
