# Changelog

## 0.2.0

- Migração do runtime HTTP de Express para NestJS (controllers/modules/DI)
  — ADR-0005. Contrato HTTP, status codes e shapes de resposta idênticos;
  domínio (services/schemas/Prisma) inalterado.
- `src/index.ts`/`app.ts`/`container.ts`/`middleware/` (Express) substituídos
  por `src/main.ts`, `src/app.module.ts`, `src/core/core.module.ts`
  (composition root via DI) e `src/common/` (guard/filter/pipe).
- `pnpm dev`/`build`/`start` passam a apontar para `src/main.ts`/`dist/main.js`;
  `Dockerfile` atualizado (e corrigidos dois bugs pré-existentes de build —
  ver ADR-0005).
- Testes HTTP reescritos com `@nestjs/testing` + `supertest`.

## 0.1.0

- Primeira versão: projeto TypeScript (Express + Prisma/PostgreSQL)
  para substituir o push-server ad-hoc da infra PW2C (cutover da stack
  ainda pendente — `docs/ROADMAP.md`).
- Contrato legado preservado (`/vapid-public-key`, `/subscribe`, `/send` —
  ADR-0004), para não quebrar a integração já em produção do bt-pro.
- Novo: agendamento (`POST /notifications` com `scheduledAt`) e rastreio de
  entrega por dispositivo (`Delivery` — ADR-0002), via scheduler por
  polling com retry simples (ADR-0003).
