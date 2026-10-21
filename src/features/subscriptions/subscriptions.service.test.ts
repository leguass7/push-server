import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../lib/prisma.service";
import { SubscriptionsService } from "./subscriptions.service";

function fakePrisma(overrides: Record<string, unknown> = {}) {
  return {
    subscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      ...overrides,
    },
  } as unknown as PrismaService;
}

describe("SubscriptionsService", () => {
  it("upsert grava endpoint + chaves, usando endpoint como chave de conflito", async () => {
    const prisma = fakePrisma();
    const service = new SubscriptionsService(prisma);

    await service.upsert({ endpoint: "https://push.example/a", keys: { p256dh: "p", auth: "a" } });

    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/a" },
      create: { endpoint: "https://push.example/a", p256dh: "p", auth: "a" },
      update: { p256dh: "p", auth: "a" },
    });
  });

  it("remove é idempotente (deleteMany, não delete)", async () => {
    const prisma = fakePrisma();
    const service = new SubscriptionsService(prisma);

    await expect(service.remove("endpoint-inexistente")).resolves.toBeUndefined();
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: "endpoint-inexistente" } });
  });
});
