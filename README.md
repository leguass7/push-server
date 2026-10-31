# push-server

Microsserviço de Web Push (VAPID) com **agendamento** e **rastreio de
entrega** — quem recebeu, quem falhou, quem ainda está pendente.

Evolução versionada do push-server ad-hoc que já roda na infra PW2C: mantém
o contrato HTTP legado (`/vapid-public-key`, `/subscribe`, `/send`) que o
[bt-pro](../bt-pro) consome hoje, e adiciona agendamento + histórico por
trás dele. Runtime HTTP: NestJS + Prisma/PostgreSQL — ver
[`docs/adr/0001-stack-express-prisma-postgres.md`](docs/adr/0001-stack-express-prisma-postgres.md)
e [`docs/adr/0005-migracao-nestjs.md`](docs/adr/0005-migracao-nestjs.md).

## Por que este serviço existe

O bt-pro roda na Vercel (Next.js serverless) — não há processo de longa
duração ali para rodar um scheduler de notificações, nem um lugar natural
para guardar "o que já foi enviado". Este serviço resolve isso como um
componente separado, de longa duração, na infra PW2C.

## Quickstart

```bash
pnpm install
cp .env.example .env
pnpm vapid:generate      # cola as chaves geradas no .env
pnpm docker:up            # Postgres de dev
pnpm db:migrate:dev
pnpm dev                   # http://localhost:3000
```

Verificação completa antes de qualquer entrega:

```bash
pnpm verify    # lint + typecheck + test + build
```

## API

### Contrato legado (compatível com o push-server atual — ADR-0004)

| Rota | Body | Resposta |
| --- | --- | --- |
| `GET /vapid-public-key` | — | `{ publicKey }` |
| `POST /subscribe` | `{ endpoint, keys: { p256dh, auth } }` | `201 { ok: true }` |
| `DELETE /subscribe` | `{ endpoint }` | `200 { ok: true }` (idempotente) |
| `POST /send` | `{ endpoint?, payload }` | `{ sent, failed }` |

### Agendamento e rastreio (novo)

| Rota | Body / Query | Resposta |
| --- | --- | --- |
| `POST /notifications` | `{ title, body, url?, data?, endpoint?, scheduledAt? }` | `201` Notification (dispara já se `scheduledAt` omitido/passado) |
| `GET /notifications` | `?status=&limit=&cursor=` | `{ items, nextCursor }` |
| `GET /notifications/:id` | — | Notification + `deliveries[]` (quem recebeu, quem falhou) |
| `DELETE /notifications/:id` | — | Cancela (só se `PENDING`); `409` se já processada |
| `GET /health` | — | `{ ok, subscriptions, version }` — sem auth, usado por healthcheck (`version` = `package.json`) |

`endpoint` omitido/`null` = broadcast (todas as inscrições ativas no
disparo). Ver [`CONTEXT.md`](CONTEXT.md) para os termos (`Delivery`,
`Dispatch`, `Broadcast`, `Scheduler`).

### Autenticação

Opt-in via `API_TOKEN` (`Authorization: Bearer <token>`) — vazio desliga a
checagem. Ver [`docs/adr/0004-compatibilidade-com-bt-pro.md`](docs/adr/0004-compatibilidade-com-bt-pro.md)
antes de ativar em produção.

## Documentação

- [`docs/GOLDEN_RULES.md`](docs/GOLDEN_RULES.md) — regras de arquitetura e código
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — comandos, testes, fluxo de
  implementação (commit → release → imagem) e deploy
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — estado da stack Swarm na infra PW2C
- `docs/pw2c-stack.yml` — stack Swarm local para o Portainer (gitignored)
- [`docs/adr/`](docs/adr/) — decisões de arquitetura
- [`CONTEXT.md`](CONTEXT.md) — glossário do domínio
- [`AGENTS.md`](AGENTS.md) — instruções para agentes de IA trabalhando neste repo
