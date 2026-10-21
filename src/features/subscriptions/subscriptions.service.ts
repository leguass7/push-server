import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../lib/prisma.service';
import type { SubscribeBody } from './subscriptions.schemas';

/**
 * Classe `@Injectable()` com deps explícitas no construtor — equivalente,
 * em Nest, ao antigo `create*Service(deps)` do Express (GOLDEN_RULES §6):
 * testável com um `PrismaService` fake simples, sem precisar de um
 * `TestingModule` nem de mock de framework.
 */
@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsert(subscription: SubscribeBody): Promise<void> {
    await this.prisma.subscription.upsert({
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
  }

  /** Idempotente: remover um endpoint que não existe não é erro. */
  async remove(endpoint: string): Promise<void> {
    await this.prisma.subscription.deleteMany({ where: { endpoint } });
  }

  async findByEndpoint(endpoint: string) {
    return this.prisma.subscription.findUnique({ where: { endpoint } });
  }

  async listAll() {
    return this.prisma.subscription.findMany();
  }

  async count(): Promise<number> {
    return this.prisma.subscription.count();
  }
}
