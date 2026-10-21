import { Module } from '@nestjs/common';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { HealthController } from './health.controller';

@Module({
  imports: [SubscriptionsModule],
  controllers: [HealthController],
})
export class HealthModule {}
