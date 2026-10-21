import { Catch, Inject, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { LOGGER } from '../core/core.module';
import type { Logger } from '../lib/logger';
import { HttpError } from './http-error';

/**
 * Equivalente ao `middleware/error-handler.ts` da versão Express — mapeia o
 * mesmo conjunto de erros para o mesmo shape de resposta. Global (`APP_FILTER`
 * em `app.module.ts`), então cobre guards/pipes/controllers igualmente —
 * nenhum handler precisa de try/catch próprio (Nest já encaminha qualquer
 * rejeição de método `async` para aqui, diferente do Express 4).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ZodError) {
      response.status(400).json({ error: 'invalid_request', issues: exception.issues });
      return;
    }

    if (exception instanceof HttpError) {
      response.status(exception.status).json({ error: exception.message });
      return;
    }

    // Defesa extra: se alguma rota escapar do catch-all (NotFoundController),
    // o próprio Nest levanta isso (ex.: "Cannot GET /x") — mesmo shape do
    // 404 do catch-all, não a mensagem interna do framework.
    if (exception instanceof NotFoundException) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    this.logger.error({ err: exception, path: request.path }, 'unhandled_error');
    response.status(500).json({ error: 'internal_error' });
  }
}
