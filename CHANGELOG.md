# Changelog

## 0.2.1

- Atualização de dependências e correção das vulnerabilidades reportadas
  pelo Dependabot (14 alertas, todas em devDependencies — vitest 2.x e sua
  cadeia transitiva: vite, esbuild, tinypool, @vitest/mocker).
- `vitest` 2 → 5, `zod` 3 → 4 (sem mudança de contrato observável — só o
  texto de `message` dos issues de validação mudou), `pino`/`pino-http`
  major bump, `class-validator`, `dotenv`, `@types/node`, `@types/supertest`.
- `vitest.config.ts` → `vitest.config.mts` (remove o warning do Vite sobre
  config ESM carregado como CommonJS).
- `prisma`/`typescript` **não** atualizados: `prisma@8` só existe como
  release candidate (`8.0.0-rc.23`); `typescript@7` ainda não é suportado
  pelo `typescript-eslint` (peer `typescript: ">=4.8.4 <6.1.0"`). Ambos
  ficam na versão estável mais recente compatível.

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
