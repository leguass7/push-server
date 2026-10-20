import cors from "cors";
import express, { type Express } from "express";
import { pinoHttp } from "pino-http";

import type { Container } from "./container.js";
import type { Env } from "./env/env.js";
import { createHealthRouter } from "./features/health/health.routes.js";
import { createNotificationsRouter } from "./features/notifications/notifications.routes.js";
import { createSubscriptionsRouter } from "./features/subscriptions/subscriptions.routes.js";
import { createVapidRouter } from "./features/vapid/vapid.routes.js";
import type { Logger } from "./lib/logger.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";

/**
 * Monta só as rotas HTTP a partir de um container já construído — separado
 * de `index.ts` (que decide porta/scheduler/shutdown) para os testes de rota
 * (supertest) poderem montar o app em memória sem subir um listener.
 */
export function createApp(container: Container, env: Pick<Env, "API_TOKEN" | "VAPID_PUBLIC_KEY">, logger: Logger): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // /health fica fora da auth de propósito: healthcheck do Docker/Swarm não
  // envia Authorization, e um 401 ali derrubaria o container por engano.
  app.use(createHealthRouter(container.subscriptions));

  app.use(createAuthMiddleware(env.API_TOKEN));

  app.use(createVapidRouter(env.VAPID_PUBLIC_KEY));
  app.use(createSubscriptionsRouter(container.subscriptions));
  app.use(createNotificationsRouter(container.notifications));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
