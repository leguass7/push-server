import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 não encaminha rejeições de handlers `async` para o error
 * middleware (isso só chega no Express 5) — sem isto, um `schema.parse()`
 * que lança dentro de um handler async vira uma Promise rejeitada que
 * ninguém trata, e o request trava sem resposta. Envolver cada handler aqui
 * é o que garante que `createErrorHandler` (error-handler.ts) realmente
 * recebe o erro.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
