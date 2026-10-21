import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { pinoHttp } from 'pino-http';

import { AppModule } from './app.module';
import { ENV, LOGGER } from './core/core.module';
import type { Env } from './env/env';
import type { Logger } from './lib/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const env = app.get<Env>(ENV);
  const logger = app.get<Logger>(LOGGER);

  // Mesmo comportamento do `cors()` sem opções usado na versão Express.
  app.enableCors();
  app.use(pinoHttp({ logger }));

  // Substitui os `process.on("SIGTERM"/"SIGINT", ...)` manuais do antigo
  // `index.ts`: dispara `onModuleDestroy` em todos os providers (scheduler,
  // Prisma) e fecha o listener HTTP.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.info({ port: env.PORT }, 'push_server_listening');
}

void bootstrap();
