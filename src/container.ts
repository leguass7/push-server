import { createDispatchService } from "./features/notifications/dispatch.service.js";
import { createNotificationsService } from "./features/notifications/notifications.service.js";
import { createSubscriptionsService } from "./features/subscriptions/subscriptions.service.js";
import type { Env } from "./env/env.js";
import type { Logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { configureWebPush } from "./lib/webpush.js";

/**
 * Composition root dos services — usado tanto por `app.ts` (rotas HTTP)
 * quanto por `index.ts` (scheduler), para as duas pontas operarem sobre o
 * mesmo Prisma Client sem duplicar a lógica de montagem.
 */
export function createContainer(env: Env, logger: Logger) {
  const webpush = configureWebPush(env);
  const subscriptions = createSubscriptionsService(prisma);
  const dispatch = createDispatchService({ webpush, prisma, subscriptions, logger });
  const notifications = createNotificationsService({
    prisma,
    dispatch,
    logger,
    maxAttempts: env.MAX_SEND_ATTEMPTS,
  });

  return { prisma, subscriptions, dispatch, notifications };
}

export type Container = ReturnType<typeof createContainer>;
