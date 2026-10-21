import { Body, Controller, Delete, HttpCode, Inject, Post } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';
import {
  subscribeBodySchema,
  unsubscribeBodySchema,
  type SubscribeBody,
  type UnsubscribeBody,
} from './subscriptions.schemas';

@Controller('subscribe')
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}

  @Post()
  @HttpCode(201)
  async subscribe(@Body(new ZodValidationPipe(subscribeBodySchema)) body: SubscribeBody) {
    await this.subscriptions.upsert(body);
    return { ok: true };
  }

  /**
   * Idempotente por design (ver subscriptions.service.ts) — sempre 200,
   * mesmo se o endpoint já não existir. O caller (bt-pro) já trata 404/410
   * como sucesso best-effort; manter 200 simplifica os dois lados.
   */
  @Delete()
  async unsubscribe(@Body(new ZodValidationPipe(unsubscribeBodySchema)) body: UnsubscribeBody) {
    await this.subscriptions.remove(body.endpoint);
    return { ok: true };
  }
}
