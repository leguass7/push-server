import type { Logger } from '../../lib/logger';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * Poller simples: a cada `intervalMs`, busca Notifications PENDING com
 * `scheduledAt` vencida e processa uma a uma. Ver docs/adr/0003-scheduler-por-polling.md
 * para o porquê de polling em vez de uma fila (BullMQ/pg-boss) nesta v1.
 *
 * Função pura, sem decorators — deliberado: é a mesma lógica (e os mesmos
 * testes, se vierem) independente do framework HTTP por cima. `scheduler.service.ts`
 * é o único arquivo que conhece o ciclo de vida do Nest.
 */
export function createScheduler(deps: {
  notifications: NotificationsService;
  logger: Logger;
  intervalMs: number;
  batchSize: number;
}) {
  const { notifications, logger, intervalMs, batchSize } = deps;
  let timer: NodeJS.Timeout | undefined;
  let ticking = false;

  async function tick(): Promise<void> {
    if (ticking) return; // tick anterior ainda rodando (lote grande/lento) — não empilha.
    ticking = true;
    try {
      const due = await notifications.findDueBatch(batchSize);
      for (const notification of due) {
        try {
          await notifications.processOne(notification.id);
        } catch (error) {
          logger.error({ err: error, notificationId: notification.id }, 'scheduler_process_one_failed');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'scheduler_tick_failed');
    } finally {
      ticking = false;
    }
  }

  return {
    start() {
      logger.info({ intervalMs, batchSize }, 'scheduler_started');
      timer = setInterval(() => void tick(), intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      logger.info('scheduler_stopped');
    },
    /** Exposto para testes — roda um ciclo sem esperar o setInterval. */
    tick,
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;
