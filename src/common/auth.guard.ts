import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { ENV } from "../core/core.module";
import type { Env } from "../env/env";
import { HttpError } from "./http-error";

/**
 * Autenticação por token compartilhado (Bearer), opt-in via `API_TOKEN`.
 *
 * Por quê opt-in (e não obrigatório desde o dia 1): o contrato atual do
 * push-server em produção (ADR-0022 do bt-pro) não envia nenhum header de
 * auth. Exigir token sem antes atualizar `push-server-client.ts` no bt-pro
 * quebraria o subscribe/unsubscribe/send em produção. Ver
 * docs/adr/0004-compatibilidade-com-bt-pro.md para o plano de ativação.
 *
 * `/health` fica fora de propósito: healthcheck do Docker/Swarm não envia
 * Authorization, e um 401 ali derrubaria o container por engano.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.env.API_TOKEN || request.path === "/health") {
      return true;
    }

    const header = request.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || token !== this.env.API_TOKEN) {
      throw new HttpError(401, "unauthorized");
    }

    return true;
  }
}
