import { Inject, Injectable } from "@nestjs/common";

import { HttpError } from "../../common/http-error";
import { ENV, LOGGER } from "../../core/core.module";
import type { Env } from "../../env/env";
import type { Delivery, Notification, Prisma } from "../../generated/prisma/client";
import type { Logger } from "../../lib/logger";
import { PrismaService } from "../../lib/prisma.service";
import { DispatchService } from "./dispatch.service";
import type { ListNotificationsQuery } from "./notifications.schemas";
import { NotificationStatus } from "./notifications.types";

export type NotificationWithDeliveries = Notification & { deliveries: Delivery[] };

export function hasDeliveries(
  notification: Notification | NotificationWithDeliveries,
): notification is NotificationWithDeliveries {
  return Object.hasOwn(notification, "deliveries");
}

export type CreateNotificationInput = {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  targetEndpoint: string | null;
  scheduledAt: Date;
};

/** Backoff linear simples — ver docs/adr/0003-scheduler-por-polling.md §Retry. */
function nextRetryAt(attempts: number): Date {
  const delayMs = attempts * 5 * 60_000;
  return new Date(Date.now() + delayMs);
}

const withDeliveries = { deliveries: { orderBy: { createdAt: "asc" as const } } };

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification | NotificationWithDeliveries> {
    const created = await this.prisma.notification.create({
      data: {
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        data: input.data as Prisma.InputJsonValue | undefined,
        targetEndpoint: input.targetEndpoint,
        scheduledAt: input.scheduledAt,
      },
    });

    if (input.scheduledAt.getTime() <= Date.now()) {
      return this.processOne(created.id);
    }

    return created;
  }

  /** Usado pelo scheduler (poller) — mesma lógica de criação inline. */
  async processOne(notificationId: string): Promise<NotificationWithDeliveries> {
    const claim = await this.prisma.notification.updateMany({
      where: { id: notificationId, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.PROCESSING },
    });

    if (claim.count === 0) {
      return this.prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
        include: withDeliveries,
      });
    }

    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    const targets = await this.dispatch.resolveTargets(notification.targetEndpoint);

    if (targets.length === 0) {
      return this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          attempts: notification.attempts + 1,
          lastError: "no_subscriptions",
        },
        include: withDeliveries,
      });
    }

    const payload = {
      title: notification.title,
      body: notification.body,
      url: notification.url ?? undefined,
      data: notification.data ?? undefined,
    };

    const result = await this.dispatch.dispatchToTargets(payload, targets);

    await this.prisma.delivery.createMany({
      data: result.deliveries.map((delivery) => ({
        notificationId,
        endpoint: delivery.endpoint,
        status: delivery.status,
        statusCode: delivery.statusCode ?? null,
        error: delivery.error ?? null,
      })),
    });

    const attempts = notification.attempts + 1;

    if (result.sent === 0) {
      const willRetry = attempts < this.env.MAX_SEND_ATTEMPTS;
      this.logger.warn({ notificationId, attempts, willRetry }, "notification_failed");
      return this.prisma.notification.update({
        where: { id: notificationId },
        data: willRetry
          ? { status: NotificationStatus.PENDING, attempts, scheduledAt: nextRetryAt(attempts), lastError: "all_targets_failed" }
          : { status: NotificationStatus.FAILED, attempts, lastError: "all_targets_failed" },
        include: withDeliveries,
      });
    }

    // Parcial ou totalmente entregue: v1 não reenvia por endpoint (só o
    // endpoint/broadcast falho por completo tenta de novo, acima) — ver
    // limitação documentada em docs/adr/0003.
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: result.failed === 0 ? NotificationStatus.SENT : NotificationStatus.PARTIALLY_SENT,
        attempts,
        sentAt: new Date(),
        lastError: null,
      },
      include: withDeliveries,
    });
  }

  async getById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: { deliveries: { orderBy: { createdAt: "asc" } } },
    });
    if (!notification) {
      throw new HttpError(404, "notification_not_found");
    }
    return notification;
  }

  async list(query: ListNotificationsQuery) {
    const items = await this.prisma.notification.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { scheduledAt: "desc" },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    const nextCursor = items.length === query.limit ? items[items.length - 1]?.id : undefined;
    return { items, nextCursor };
  }

  async cancel(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new HttpError(404, "notification_not_found");
    }
    if (notification.status !== NotificationStatus.PENDING) {
      throw new HttpError(409, `cannot_cancel_status_${notification.status.toLowerCase()}`);
    }
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.CANCELED },
    });
  }

  async findDueBatch(limit: number) {
    return this.prisma.notification.findMany({
      where: { status: NotificationStatus.PENDING, scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
  }
}
