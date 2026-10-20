import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SubscribeBody } from "./subscriptions.schemas.js";

export function createSubscriptionsService(prisma: PrismaClient) {
  return {
    async upsert(subscription: SubscribeBody) {
      await prisma.subscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
    },

    /** Idempotente: remover um endpoint que não existe não é erro. */
    async remove(endpoint: string) {
      await prisma.subscription.deleteMany({ where: { endpoint } });
    },

    async findByEndpoint(endpoint: string) {
      return prisma.subscription.findUnique({ where: { endpoint } });
    },

    async listAll() {
      return prisma.subscription.findMany();
    },

    async count() {
      return prisma.subscription.count();
    },
  };
}

export type SubscriptionsService = ReturnType<typeof createSubscriptionsService>;
