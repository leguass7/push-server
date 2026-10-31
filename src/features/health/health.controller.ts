import { Controller, Get, Inject } from '@nestjs/common';

import { readAppVersion } from '../../lib/app-version';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async check() {
    const count = await this.subscriptions.count();
    return { ok: true, subscriptions: count, version: readAppVersion() };
  }
}
