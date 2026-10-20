import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import type { SubscriptionsService } from "./subscriptions.service.js";
import { subscribeBodySchema, unsubscribeBodySchema } from "./subscriptions.schemas.js";

export function createSubscriptionsRouter(subscriptions: SubscriptionsService): Router {
  const router = Router();

  router.post(
    "/subscribe",
    asyncHandler(async (req, res) => {
      const body = subscribeBodySchema.parse(req.body);
      await subscriptions.upsert(body);
      res.status(201).json({ ok: true });
    }),
  );

  // Idempotente por design (ver subscriptions.service.ts) — sempre 200, mesmo
  // se o endpoint já não existir. O caller (bt-pro) já trata 404/410 como
  // sucesso best-effort; manter 200 simplifica os dois lados.
  router.delete(
    "/subscribe",
    asyncHandler(async (req, res) => {
      const body = unsubscribeBodySchema.parse(req.body);
      await subscriptions.remove(body.endpoint);
      res.json({ ok: true });
    }),
  );

  return router;
}
