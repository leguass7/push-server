import { Inject, Injectable } from "@nestjs/common";
import type { WebPushError } from "web-push";

import { LOGGER, WEB_PUSH } from "../../core/core.module";
import { PrismaService } from "../../lib/prisma.service";
import type { Logger } from "../../lib/logger";
import type { WebPush } from "../../lib/webpush";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { DeliveryStatus } from "./notifications.types";

type TargetSubscription = { endpoint: string; p256dh: string; auth: string };

type DispatchResult = {
  sent: number;
  failed: number;
  deliveries: Array<{ endpoint: string; status: DeliveryStatus; statusCode?: number; error?: string }>;
};

function isWebPushError(error: unknown): error is WebPushError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

/**
 * Envia `payload` (já serializável em JSON) para uma lista de inscrições.
 * Isolado de Notification/Delivery (persistência) para poder ser testado só
 * com um webpush/prisma fake — quem grava o resultado é o chamador.
 */
@Injectable()
export class DispatchService {
  constructor(
    @Inject(WEB_PUSH) private readonly webpush: WebPush,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async dispatchToTargets(payload: Record<string, unknown>, targets: TargetSubscription[]): Promise<DispatchResult> {
    const deliveries: DispatchResult["deliveries"] = [];
    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await this.webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
        deliveries.push({ endpoint: target.endpoint, status: DeliveryStatus.SENT });
      } catch (error) {
        const statusCode = isWebPushError(error) ? error.statusCode : undefined;
        const message = error instanceof Error ? error.message : String(error);

        // 404/410 = a inscrição não existe mais no navegador (desinstalou,
        // trocou de dispositivo, etc.) — não é uma falha para reter, é sinal
        // para limpar a Subscription local. Não conta como `failed`: não é
        // nada que um retry resolveria.
        if (statusCode === 404 || statusCode === 410) {
          await this.subscriptions.remove(target.endpoint);
          deliveries.push({ endpoint: target.endpoint, status: DeliveryStatus.EXPIRED, statusCode });
          this.logger.info({ endpoint: target.endpoint, statusCode }, "subscription_expired_removed");
          continue;
        }

        failed += 1;
        deliveries.push({
          endpoint: target.endpoint,
          status: DeliveryStatus.FAILED,
          ...(statusCode !== undefined ? { statusCode } : {}),
          error: message,
        });
        this.logger.warn({ endpoint: target.endpoint, statusCode, error: message }, "push_send_failed");
      }
    }

    return { sent, failed, deliveries };
  }

  /** Resolve o alvo real a partir de `targetEndpoint` (uma inscrição) ou null (broadcast). */
  async resolveTargets(targetEndpoint: string | null): Promise<TargetSubscription[]> {
    if (targetEndpoint) {
      const subscription = await this.prisma.subscription.findUnique({ where: { endpoint: targetEndpoint } });
      return subscription ? [subscription] : [];
    }
    return this.subscriptions.listAll();
  }
}
