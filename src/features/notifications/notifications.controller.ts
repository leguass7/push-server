import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { HttpError } from '../../common/http-error';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createNotificationBodySchema,
  legacySendBodySchema,
  listNotificationsQuerySchema,
  type CreateNotificationBody,
  type LegacySendBody,
  type ListNotificationsQuery,
} from './notifications.schemas';
import { hasDeliveries, NotificationsService } from './notifications.service';

function extractLegacyText(payload: Record<string, unknown>, key: 'title' | 'body', fallback: string): string {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

@Controller()
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  /**
   * Contrato legado de `POST /send` (ADR-0004) — usado hoje pelo botão de
   * diagnóstico do Admin no bt-pro. `payload` é livre; vira `data` na
   * Notification, e `title`/`body` são extraídos dele com fallback, já que a
   * tabela exige os dois (para aparecerem em `GET /notifications`).
   */
  @Post('send')
  @HttpCode(200)
  async send(@Body(new ZodValidationPipe(legacySendBodySchema)) body: LegacySendBody) {
    const notification = await this.notifications.create({
      title: extractLegacyText(body.payload, 'title', 'Notificação'),
      body: extractLegacyText(body.payload, 'body', ''),
      data: body.payload,
      targetEndpoint: body.endpoint ?? null,
      scheduledAt: new Date(),
    });

    const deliveries = hasDeliveries(notification) ? notification.deliveries : [];
    const sent = deliveries.filter((d) => d.status === 'SENT').length;
    const failed = deliveries.length - sent;

    if (deliveries.length === 0 && notification.status === 'FAILED') {
      throw new HttpError(404, 'no_matching_subscriptions');
    }

    return { sent, failed };
  }

  @Post('notifications')
  @HttpCode(201)
  async createNotification(@Body(new ZodValidationPipe(createNotificationBodySchema)) body: CreateNotificationBody) {
    return this.notifications.create({
      title: body.title,
      body: body.body,
      ...(body.url !== undefined ? { url: body.url } : {}),
      ...(body.data !== undefined ? { data: body.data } : {}),
      targetEndpoint: body.endpoint ?? null,
      scheduledAt: body.scheduledAt ?? new Date(),
    });
  }

  @Get('notifications')
  async list(@Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery) {
    return this.notifications.list(query);
  }

  @Get('notifications/:id')
  async getById(@Param('id') id: string) {
    return this.notifications.getById(id);
  }

  @Delete('notifications/:id')
  async cancel(@Param('id') id: string) {
    return this.notifications.cancel(id);
  }
}
