import { z } from 'zod';

import { NotificationStatus } from './notifications.types';

export const createNotificationBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  url: z.string().url().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** Omitido/null = broadcast para todas as inscrições ativas no momento do disparo. */
  endpoint: z.string().min(1).optional(),
  /** Omitido/passado = dispara assim que possível. */
  scheduledAt: z.coerce.date().optional(),
});

export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;

export const listNotificationsQuerySchema = z.object({
  status: z.enum(Object.values(NotificationStatus) as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/** Contrato legado de `POST /send` — mantido por compatibilidade com o bt-pro (ADR-0004). */
export const legacySendBodySchema = z.object({
  endpoint: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type LegacySendBody = z.infer<typeof legacySendBodySchema>;
