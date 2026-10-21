import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AuthGuard } from './common/auth.guard';
import { NotFoundModule } from './common/not-found.module';
import { CoreModule } from './core/core.module';
import { HealthModule } from './features/health/health.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { SchedulerModule } from './features/scheduler/scheduler.module';
import { SubscriptionsModule } from './features/subscriptions/subscriptions.module';
import { VapidModule } from './features/vapid/vapid.module';

@Module({
  // `NotFoundModule` (catch-all 404) fica por último de propósito: o Nest
  // registra rotas na ordem em que os módulos entram no container de DI, e
  // isso inclui `imports` — colocá-lo antes faria o catch-all sombrear
  // `/health` e todas as outras rotas (confirmado empiricamente).
  imports: [
    CoreModule,
    HealthModule,
    VapidModule,
    SubscriptionsModule,
    NotificationsModule,
    SchedulerModule,
    NotFoundModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
