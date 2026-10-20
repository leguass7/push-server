import type { NextFunction, Request, Response } from "express";

/**
 * Autenticação por token compartilhado (Bearer), opt-in via `API_TOKEN`.
 *
 * Por quê opt-in (e não obrigatório desde o dia 1): o contrato atual do
 * push-server em produção (ADR-0022 do bt-pro) não envia nenhum header de
 * auth. Exigir token sem antes atualizar `push-server-client.ts` no bt-pro
 * quebraria o subscribe/unsubscribe/send em produção. Ver
 * docs/adr/0004-compatibilidade-com-bt-pro.md para o plano de ativação.
 */
export function createAuthMiddleware(apiToken: string) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!apiToken) {
      next();
      return;
    }

    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || token !== apiToken) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    next();
  };
}
