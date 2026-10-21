import { Module } from "@nestjs/common";

import { NotFoundController } from "./not-found.controller";

/**
 * Módulo próprio (não controller direto do `AppModule`) — Nest registra as
 * rotas na ordem em que os módulos entram no container: um módulo raiz
 * entra antes dos módulos que ele importa, então um controller declarado
 * direto no `AppModule` registraria ANTES das features (confirmado
 * empiricamente: o catch-all sombreava `/health` e todo o resto). Import
 * module + `imports` por último em `app.module.ts` é o que garante a
 * prioridade certa.
 */
@Module({
  controllers: [NotFoundController],
})
export class NotFoundModule {}
