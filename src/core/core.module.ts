import { Global, Module } from '@nestjs/common';

import { loadEnv, type Env } from '../env/env';
import { createLogger, type Logger } from '../lib/logger';
import { PrismaService } from '../lib/prisma.service';
import { configureWebPush, type WebPush } from '../lib/webpush';

export const ENV = Symbol('ENV');
export const LOGGER = Symbol('LOGGER');
export const WEB_PUSH = Symbol('WEB_PUSH');

/**
 * Composition root — equivalente ao antigo `container.ts`: único lugar que
 * decide como env/logger/webpush/Prisma são construídos. `@Global()` porque
 * é infraestrutura transversal (GOLDEN_RULES §1) consumida por toda
 * feature via `@Inject(TOKEN)` — nunca reconstruída em outro lugar.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    { provide: ENV, useFactory: (): Env => loadEnv() },
    {
      provide: LOGGER,
      inject: [ENV],
      useFactory: (env: Env): Logger => createLogger(env),
    },
    {
      provide: WEB_PUSH,
      inject: [ENV],
      useFactory: (env: Env): WebPush => configureWebPush(env),
    },
  ],
  exports: [PrismaService, ENV, LOGGER, WEB_PUSH],
})
export class CoreModule {}
