# push-server — instruções para agentes

Microsserviço de Web Push (VAPID) com agendamento e rastreio de entrega.
Evolução versionada do push-server ad-hoc que já roda na infra PW2C — ver
`docs/adr/0001-stack-express-prisma-postgres.md` e
`docs/adr/0005-migracao-nestjs.md` (runtime HTTP migrou de Express para
NestJS; domínio/contrato inalterados).

## Fonte de verdade

Leia **[`docs/GOLDEN_RULES.md`](docs/GOLDEN_RULES.md)** e
**[`CONTEXT.md`](CONTEXT.md)** antes de implementar. ADRs em
[`docs/adr/`](docs/adr/) — em especial o **ADR-0004**, que documenta o
contrato legado que este serviço precisa preservar para não quebrar o
bt-pro em produção.

Para implementar uma mudança até produção, siga o **Fluxo de
implementação** em [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — conventional
commits, PR de release, imagem `latest` + `X.Y.Z`, `GET /health.version`.

Para cutover, deploy e estado da infra PW2C, leia
**[`docs/ROADMAP.md`](docs/ROADMAP.md)** — a stack Swarm em produção ainda
é o serviço ad-hoc; este repo ainda não a substituiu.

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| `src/main.ts` | Bootstrap: `NestFactory.create`, CORS, pino-http, shutdown hooks, porta |
| `src/app.module.ts` | Módulo raiz — importa `CoreModule` + módulos de feature, registra guard/filter globais |
| `src/core/core.module.ts` | Composition root (`@Global()`) — único lugar que provê `ENV`/`LOGGER`/`WEB_PUSH`/`PrismaService` |
| `src/common/` | `AuthGuard` (Bearer opt-in), `AllExceptionsFilter`, `ZodValidationPipe`, `HttpError`, `NotFoundController`/`NotFoundModule` (404 catch-all) |
| `src/env/` | Validação de ambiente (Zod) — inalterado |
| `src/lib/` | `PrismaService`, logger (pino), webpush — sem regra de negócio |
| `src/features/health/` | `GET /health` |
| `src/features/vapid/` | `GET /vapid-public-key` |
| `src/features/subscriptions/` | `POST`/`DELETE /subscribe` |
| `src/features/notifications/` | `POST /send` (legado), CRUD de `/notifications`, `dispatch.service.ts` (envio em si) |
| `src/features/scheduler/` | `scheduler.ts` (poller, função pura) + `scheduler.service.ts` (hooks de ciclo de vida do Nest) |
| `prisma/` | Schema + migrations |
| `docs/` | Golden Rules, Workflow, Roadmap (cutover PW2C), stack Portainer, ADRs |
| `docs/pw2c-stack.yml` | Stack Swarm local (gitignored — o repo é público) |
| `.github/workflows/ci.yml` | verify em PR/`main`; release-please em `main`; imagem no GitHub Release |
| `scripts/` | Utilitários de CLI (gerar VAPID, esperar Postgres) |

## Stack

- Node 20+, TypeScript strict, CommonJS + decorators
  (`experimentalDecorators`/`emitDecoratorMetadata`, ver GOLDEN_RULES §7 e
  ADR-0005)
- NestJS 12 (`@nestjs/platform-express`, que embute Express 5) · Prisma 7
  (driver adapter `@prisma/adapter-pg`) + PostgreSQL · Zod (validação,
  via `ZodValidationPipe` — não o `ValidationPipe`/class-validator nativo
  do Nest) · `web-push` · pino/pino-http
- Vitest + supertest (`@nestjs/testing`) · pnpm

## Comandos

```bash
# Infra (Docker)
pnpm docker:up           # Postgres de dev (porta 5433)
pnpm docker:down

# Banco
pnpm db:generate
pnpm db:migrate:dev       # dev
pnpm db:migrate            # produção (migrate deploy)

# Desenvolvimento
pnpm dev
pnpm build
pnpm start

# Qualidade (rodar antes de encerrar qualquer entrega)
pnpm verify                # lint + typecheck + test + build
```

Workflow completo (incluindo deploy manual na infra PW2C):
[`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Domínio (ver CONTEXT.md para os termos)

| Feature | Pasta | Status |
| --- | --- | --- |
| Inscrições (Subscription) | `src/features/subscriptions/` | Done ✅ — contrato idêntico ao push-server legado |
| Envio legado (`/send`) | `src/features/notifications/` | Done ✅ — ADR-0004 |
| Agendamento + rastreio (`/notifications`) | `src/features/notifications/` + `scheduler/` | Done ✅ — v1, retry simples (ADR-0003) |
| Cutover da stack Swarm PW2C | [`docs/ROADMAP.md`](docs/ROADMAP.md) | Pendente — dump legado importado para `Subscription` (cópia em `backups/`, gitignored); stack nova já no ar como `push-server-v2` (YAML local gitignored) |

## Regras de trabalho

- **Escopo mínimo** — mudanças focadas na tarefa; sem refactor oportunista.
- **Fluxo até produção:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md)
  (Fluxo de implementação). Conventional commits (`feat:`, `fix:`).
  Não bump de versão nem changelog na entrega da feature — isso é o PR
  de release. Não esperar imagem nova em push de `chore`/`docs`.
- **Golden Rules (bloqueantes):** [`docs/GOLDEN_RULES.md`](docs/GOLDEN_RULES.md)
- **Nunca** alterar o shape de resposta das rotas legadas
  (`/vapid-public-key`, `/subscribe`, `/send`) sem atualizar o ADR-0004 **e**
  avisar que o bt-pro (`push-server-client.ts`, outro repositório) também
  precisa mudar.
- **Push remoto / deploy / troca da stack Swarm:** só quando o usuário
  autorizar explicitamente. Não antecipe o cutover. Ordem e invariantes:
  [`docs/ROADMAP.md`](docs/ROADMAP.md).
- **Não** rotacionar `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` no cutover —
  invalida as inscrições existentes.
- **Não** atualizar a stack com a imagem deste repo enquanto a tabela
  `Subscription` estiver vazia e o volume legado ainda tiver
  `subscriptions.json`.
- Senha de `DATABASE_URL` com `#` ou `@`: percent-encode na URL
  (`#` → `%23`, `@` → `%40`). Sem isso o parser trata `postgres` como host.
- **Verificação antes de encerrar:** `pnpm verify`.

## Decisões-chave (não reverter sem ADR)

- Contrato HTTP legado preservado; auth por token é opt-in (ADR-0004)
- `Subscription`/`Notification`/`Delivery` sem FK de `Delivery.endpoint` para
  `Subscription` — histórico de entrega sobrevive à expiração (ADR-0002)
- Status em TypeScript, banco com strings — nunca enum do Postgres (ADR-0002)
- Scheduler por polling, não fila; retry simples só para falha total
  (ADR-0003)
- Runtime HTTP é NestJS (controllers/modules/DI), não Express; imports
  relativos **sem** extensão (CommonJS), sem alias `@/`; toda injeção de
  dependência usa `@Inject(Token)` explícito, mesmo para classes — não
  depender de `emitDecoratorMetadata` (ver GOLDEN_RULES §7, ADR-0005)
