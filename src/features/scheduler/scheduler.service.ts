import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { ENV, LOGGER } from '../../core/core.module';
import type { Env } from '../../env/env';
import type { Logger } from '../../lib/logger';
import { NotificationsService } from '../notifications/notifications.service';
import { createScheduler, type Scheduler } from './scheduler';

/**
 * Wrapper Nest em volta de `createScheduler` (função pura). Usa os hooks de
 * ciclo de vida da aplicação — `onApplicationBootstrap` dispara depois que
 * todos os módulos terminaram de inicializar (equivalente ao `server.listen(...)`
 * callback do `index.ts` antigo); `onModuleDestroy` dispara via
 * `app.enableShutdownHooks()` (main.ts) em SIGTERM/SIGINT, substituindo os
 * `process.on(...)` manuais de antes.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private scheduler?: Scheduler;

  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduler = createScheduler({
      notifications: this.notifications,
      logger: this.logger,
      intervalMs: this.env.POLL_INTERVAL_MS,
      batchSize: this.env.DISPATCH_BATCH_SIZE,
    });
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler?.stop();
  }
}
