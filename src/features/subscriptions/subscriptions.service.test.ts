import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../lib/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

// Retorna o objeto solto (não tipado como `PrismaService`) — o cast fica só
// no ponto de chamada (`new SubscriptionsService(...)`), para que
// `prisma.subscription.upsert` continue tipado como o mock (`vi.fn()`), não
// como o método da classe real. Com o cast no retorno da função,
// `@typescript-eslint/unbound-method` reclama de toda referência solta ao
// método abaixo, mesmo sendo um mock.
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
  };
}

describe('SubscriptionsService', () => {
  it('upsert grava endpoint + chaves, usando endpoint como chave de conflito', async () => {
    const prisma = fakePrisma();
    const service = new SubscriptionsService(prisma as unknown as PrismaService);

    await service.upsert({ endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } });

    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/a' },
      create: { endpoint: 'https://push.example/a', p256dh: 'p', auth: 'a' },
      update: { p256dh: 'p', auth: 'a' },
    });
  });

  it('remove é idempotente (deleteMany, não delete)', async () => {
    const prisma = fakePrisma();
    const service = new SubscriptionsService(prisma as unknown as PrismaService);

    await expect(service.remove('endpoint-inexistente')).resolves.toBeUndefined();
    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: 'endpoint-inexistente' } });
  });
});
