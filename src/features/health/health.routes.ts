import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import type { SubscriptionsService } from "../subscriptions/subscriptions.service.js";

export function createHealthRouter(subscriptions: SubscriptionsService): Router {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const count = await subscriptions.count();
      res.json({ ok: true, subscriptions: count });
    }),
  );

  return router;
}
