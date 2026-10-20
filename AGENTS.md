# push-server — instruções para agentes

Microsserviço de Web Push (VAPID) com agendamento e rastreio de entrega.
Evolução versionada do push-server ad-hoc que já roda na infra PW2C — ver
`docs/adr/0001-stack-express-prisma-postgres.md`.

## Fonte de verdade

Leia **[`docs/GOLDEN_RULES.md`](docs/GOLDEN_RULES.md)** e
**[`CONTEXT.md`](CONTEXT.md)** antes de implementar. ADRs em
[`docs/adr/`](docs/adr/) — em especial o **ADR-0004**, que documenta o
contrato legado que este serviço precisa preservar para não quebrar o
bt-pro em produção.

Para cutover, deploy e estado da infra PW2C, leia
**[`docs/ROADMAP.md`](docs/ROADMAP.md)** — a stack Swarm em produção ainda
é o serviço ad-hoc; este repo ainda não a substituiu.

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| `src/index.ts` | Bootstrap: porta, scheduler, shutdown gracioso |
| `src/app.ts` | Monta as rotas Express a partir de um `Container` |
| `src/container.ts` | Composition root — único lugar que instancia os services |
| `src/env/` | Validação de ambiente (Zod) |
| `src/lib/` | Prisma client, logger (pino), webpush, async-handler — sem regra de negócio |
| `src/middleware/` | Auth (Bearer opt-in), error handler |
| `src/features/health/` | `GET /health` |
| `src/features/vapid/` | `GET /vapid-public-key` |
| `src/features/subscriptions/` | `POST`/`DELETE /subscribe` |
| `src/features/notifications/` | `POST /send` (legado), CRUD de `/notifications`, `dispatch.service.ts` (envio em si) |
| `src/features/scheduler/` | Poller que processa Notifications agendadas vencidas |
| `prisma/` | Schema + migrations |
| `docs/` | Golden Rules, Workflow, Roadmap (cutover PW2C), ADRs |
| `scripts/` | Utilitários de CLI (gerar VAPID, esperar Postgres) |

## Stack

- Node 20+, TypeScript strict, ESM puro (`module`/`moduleResolution: NodeNext`
  — imports relativos **precisam** da extensão `.js`, ver GOLDEN_RULES §7)
- Express 4 · Prisma 7 (driver adapter `@prisma/adapter-pg`) + PostgreSQL ·
  Zod · `web-push` · pino/pino-http
- Vitest + supertest · pnpm

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
| Cutover da stack Swarm PW2C | [`docs/ROADMAP.md`](docs/ROADMAP.md) | Pendente — Postgres `push_server` já provisionado; falta importar `subscriptions.json` e trocar a imagem |

## Regras de trabalho

- **Escopo mínimo** — mudanças focadas na tarefa; sem refactor oportunista.
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
- Imports relativos com extensão `.js`, sem alias `@/` (GOLDEN_RULES §7)
