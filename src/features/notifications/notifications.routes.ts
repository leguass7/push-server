import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import {
  createNotificationBodySchema,
  legacySendBodySchema,
  listNotificationsQuerySchema,
} from "./notifications.schemas.js";
import { hasDeliveries, type NotificationsService } from "./notifications.service.js";

function extractLegacyText(payload: Record<string, unknown>, key: "title" | "body", fallback: string): string {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function createNotificationsRouter(notifications: NotificationsService): Router {
  const router = Router();

  /**
   * Contrato legado de `POST /send` (ADR-0004) — usado hoje pelo botão de
   * diagnóstico do Admin no bt-pro. `payload` é livre; vira `data` na
   * Notification, e `title`/`body` são extraídos dele com fallback, já que a
   * tabela exige os dois (para aparecerem em `GET /notifications`).
   */
  router.post(
    "/send",
    asyncHandler(async (req, res) => {
      const body = legacySendBodySchema.parse(req.body);
      const notification = await notifications.create({
        title: extractLegacyText(body.payload, "title", "Notificação"),
        body: extractLegacyText(body.payload, "body", ""),
        data: body.payload,
        targetEndpoint: body.endpoint ?? null,
        scheduledAt: new Date(),
      });

      const deliveries = hasDeliveries(notification) ? notification.deliveries : [];
      const sent = deliveries.filter((d) => d.status === "SENT").length;
      const failed = deliveries.length - sent;

      if (deliveries.length === 0 && notification.status === "FAILED") {
        res.status(404).json({ error: "no_matching_subscriptions" });
        return;
      }

      res.json({ sent, failed });
    }),
  );

  router.post(
    "/notifications",
    asyncHandler(async (req, res) => {
      const body = createNotificationBodySchema.parse(req.body);
      const notification = await notifications.create({
        title: body.title,
        body: body.body,
        ...(body.url !== undefined ? { url: body.url } : {}),
        ...(body.data !== undefined ? { data: body.data } : {}),
        targetEndpoint: body.endpoint ?? null,
        scheduledAt: body.scheduledAt ?? new Date(),
      });
      res.status(201).json(notification);
    }),
  );

  router.get(
    "/notifications",
    asyncHandler(async (req, res) => {
      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await notifications.list(query);
      res.json(result);
    }),
  );

  router.get(
    "/notifications/:id",
    asyncHandler(async (req, res) => {
      const notification = await notifications.getById(req.params.id as string);
      res.json(notification);
    }),
  );

  router.delete(
    "/notifications/:id",
    asyncHandler(async (req, res) => {
      const notification = await notifications.cancel(req.params.id as string);
      res.json(notification);
    }),
  );

  return router;
}
