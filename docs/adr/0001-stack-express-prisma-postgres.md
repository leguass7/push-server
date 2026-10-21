# ADR-0001 — Microsserviço dedicado (Express + TypeScript + Prisma + PostgreSQL)

> **Superseded parcialmente pelo [ADR-0005](0005-migracao-nestjs.md)**: o
> runtime HTTP migrou de Express para NestJS. As decisões #3
> (Prisma+PostgreSQL), #4 (`web-push`) e #5 (deploy na infra PW2C) deste
> ADR continuam válidas; a decisão #2 (Express) foi substituída — ver
> ADR-0005.

## Contexto

O bt-pro (Next.js na Vercel) precisa agendar envios de Web Push e controlar o
que foi ou não entregue. O ambiente da Vercel é serverless — não há processo
de longa duração para rodar um scheduler, e o deploy "fica no ar" só em
resposta a requests. Esse controle não pode viver no bt-pro.

Já existe, na infra PW2C (fora deste repositório), um `push-server` ad-hoc:
uma stack Docker Swarm com imagem `node:20-alpine` pura, onde `package.json` e
`server.js` são gerados inline no `command:` do `docker-compose.yml` — sem
Dockerfile próprio, sem versionamento, sem testes. Ele já resolve
subscribe/unsubscribe/send (protocolo VAPID), mas guarda as inscrições num
arquivo `subscriptions.json` e não tem conceito de agendamento nem de
histórico de envio.

## Decisão

1. **Projeto TypeScript próprio** (`push-server/`), versionado, com
   build/lint/test, para **evoluir** esse serviço — não é uma reescrita do
   zero: o contrato HTTP atual (`/vapid-public-key`, `/subscribe`, `/send`) é
   preservado (ADR-0004).
2. **Express** (não Fastify/Nest): a superfície HTTP é pequena (menos de 10
   rotas); não há razão para o peso de um framework maior.
3. **Prisma + PostgreSQL**: mesma dupla do bt-pro — reaproveita o
   conhecimento operacional já existente (migrations, backup) em vez de
   introduzir Mongo/Redis/SQLite para um domínio que é fundamentalmente
   relacional (uma Notification tem N Deliveries).
4. **`web-push`** para o protocolo VAPID — mesma lib que o push-server atual
   já usa; não há motivo para trocar.
5. **Deploy continua na infra PW2C** (Docker Swarm via Portaino), como o
   serviço atual — só troca o "como" (imagem construída e versionada via
   `Dockerfile` deste repo) pelo "onde" (mesma stack/rede).

## Consequências

- Precisa de um Postgres próprio na infra PW2C (ou um schema dedicado num
  Postgres já existente) — decisão de provisionamento fica para o deploy,
  fora do código.
- `docker-compose.yml` deste repo é **só para dev local** (um Postgres
  descartável) — não é o manifesto de produção (esse continua sendo
  configurado direto no Portainer, como a stack atual).
- Qualquer integração futura (ex.: um painel de admin para ver notificações)
  consome a mesma API HTTP — não precisa acesso direto ao Postgres.

## Status

accepted
