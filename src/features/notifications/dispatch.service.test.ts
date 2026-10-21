import { describe, expect, it, vi } from 'vitest';

import type { Logger } from '../../lib/logger';
import type { PrismaService } from '../../lib/prisma.service';
import type { WebPush } from '../../lib/webpush';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DispatchService } from './dispatch.service';

function fakeLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;
}

describe('dispatchToTargets', () => {
  const targets = [
    { endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' },
    { endpoint: 'https://push.example/b', p256dh: 'p2', auth: 'a2' },
  ];

  it('conta sucesso e falha separadamente, uma por target', async () => {
    const sendNotification = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    const webpush = { sendNotification } as unknown as WebPush;
    const remove = vi.fn();
    const subscriptions = { remove } as unknown as SubscriptionsService;

    const dispatch = new DispatchService(webpush, {} as PrismaService, subscriptions, fakeLogger());

    const result = await dispatch.dispatchToTargets({ title: 't', body: 'b' }, targets);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.deliveries).toEqual([
      { endpoint: targets[0]?.endpoint, status: 'SENT' },
      { endpoint: targets[1]?.endpoint, status: 'FAILED', statusCode: 500, error: 'boom' },
    ]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('remove a Subscription quando o navegador responde 410 (inscrição expirada)', async () => {
    const sendNotification = vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const webpush = { sendNotification } as unknown as WebPush;
    const remove = vi.fn();
    const subscriptions = { remove } as unknown as SubscriptionsService;

    const dispatch = new DispatchService(webpush, {} as PrismaService, subscriptions, fakeLogger());

    const result = await dispatch.dispatchToTargets({ title: 't', body: 'b' }, [targets[0]!]);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.deliveries).toEqual([{ endpoint: targets[0]?.endpoint, status: 'EXPIRED', statusCode: 410 }]);
    expect(remove).toHaveBeenCalledWith(targets[0]?.endpoint);
  });
});

describe('resolveTargets', () => {
  it('retorna só a subscription do endpoint quando targetEndpoint é informado', async () => {
    const findUnique = vi.fn().mockResolvedValue({ endpoint: 'x', p256dh: 'p', auth: 'a' });
    const prisma = { subscription: { findUnique } } as unknown as PrismaService;
    const subscriptions = {} as unknown as SubscriptionsService;

    const dispatch = new DispatchService({} as WebPush, prisma, subscriptions, fakeLogger());

    const result = await dispatch.resolveTargets('x');

    expect(findUnique).toHaveBeenCalledWith({ where: { endpoint: 'x' } });
    expect(result).toEqual([{ endpoint: 'x', p256dh: 'p', auth: 'a' }]);
  });

  it('retorna todas as subscriptions (broadcast) quando targetEndpoint é null', async () => {
    const listAll = vi.fn().mockResolvedValue([{ endpoint: 'x', p256dh: 'p', auth: 'a' }]);
    const subscriptions = { listAll } as unknown as SubscriptionsService;

    const dispatch = new DispatchService({} as WebPush, {} as PrismaService, subscriptions, fakeLogger());

    const result = await dispatch.resolveTargets(null);

    expect(listAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
