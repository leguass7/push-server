import { z } from 'zod';

/** Mesmo shape que o browser devolve em `PushSubscription.toJSON()`. */
export const subscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

export const unsubscribeBodySchema = z.object({
  endpoint: z.string().min(1),
});

export type UnsubscribeBody = z.infer<typeof unsubscribeBodySchema>;
