# Workflow de desenvolvimento — push-server

## Infraestrutura local (Docker)

```bash
pnpm docker:up        # Postgres de dev (porta 5433 — não colide com o do bt-pro, em 5432)
pnpm docker:down       # derruba o container
```

Copie o env e gere as chaves VAPID de dev:

```bash
cp .env.example .env
pnpm vapid:generate    # cola VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no .env
```

## Banco de dados

```bash
pnpm db:generate        # gera o Prisma Client (também roda no postinstall)
pnpm db:migrate:dev      # cria/aplica migration em dev (prisma migrate dev)
pnpm db:migrate          # aplica migrations pendentes (prisma migrate deploy — produção)
pnpm db:studio           # Prisma Studio
```

## Desenvolvimento

```bash
pnpm dev                 # tsx watch — reinicia a cada mudança
pnpm build                # tsc → dist/
pnpm start                 # node dist/index.js (produção)
```

## Qualidade

```bash
pnpm lint                 # ESLint (typed)
pnpm lint:fix
pnpm typecheck              # tsc --noEmit
pnpm test                    # Vitest
pnpm verify                   # lint + typecheck + test + build — rodar antes de considerar uma entrega pronta
```

## Testando o fluxo completo manualmente

```bash
curl -s localhost:3000/health
curl -s localhost:3000/vapid-public-key
curl -s -X POST localhost:3000/subscribe -H "Content-Type: application/json" \
  -d '{"endpoint":"https://push.example/x","keys":{"p256dh":"...","auth":"..."}}'
curl -s -X POST localhost:3000/notifications -H "Content-Type: application/json" \
  -d '{"title":"Oi","body":"Teste","scheduledAt":"2026-12-31T12:00:00Z"}'
curl -s "localhost:3000/notifications?limit=5"
```

## Deploy (infra PW2C)

O estado do cutover (o que já rodou, o que falta, invariantes) vive em
[`ROADMAP.md`](ROADMAP.md). Não troque a stack sem lê-lo.

Hoje (ADR-0001) o deploy continua na mesma infra Docker Swarm/Portainer do
push-server legado — só a imagem passa a ser construída a partir do
`Dockerfile` deste repo (build versionado) em vez do `command:` inline que a
stack `push-server` usa hoje. Passos, na ordem:

1. `docker build -t <registry>/push-server:<tag> .`
2. Publicar a imagem no registry que a infra PW2C usa.
3. Provisionar um Postgres (ou schema dedicado) acessível pela stack —
   `DATABASE_URL` aponta pra lá. **Feito** em 20 de outubro de 2026:
   banco `push_server` no cluster `pg01`, migration `init` aplicada.
   Se a senha tiver `#` ou `@`, percent-encode na URL (`#` → `%23`,
   `@` → `%40`).
4. `pnpm db:migrate` (ou um passo de deploy equivalente) **antes** de trocar
   o serviço para a imagem nova. **Feito** para `20261020195219_init`.
5. Importar `subscriptions.json` do volume `push-server_push-server-data`
   para a tabela `Subscription`. Sem isso o opt-in do bt-pro some no
   cutover. **Pendente** — ver [`ROADMAP.md`](ROADMAP.md).
6. Atualizar a stack no Portainer com a imagem nova, mantendo
   `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` idênticas às atuais (trocar a
   chave invalida todas as inscrições existentes no navegador dos usuários).
   `DATABASE_URL` entra aqui. **Pendente.**
7. `API_TOKEN` fica vazio no primeiro deploy (ADR-0004) — ativar depois,
   coordenado com uma mudança no bt-pro.

Este repo **não** automatiza esses passos (sem CI/CD configurado aqui) — é
trabalho manual via Portainer, como o serviço atual, até que valha a pena
automatizar. Push remoto e troca da stack só com autorização explícita.

## Testes — organização

| Suíte | Comando | Como |
| --- | --- | --- |
| Vitest | `pnpm test` | Services com fakes (sem Prisma real) + rotas via `supertest` com um `Container` fake — rápido, sem precisar do Postgres de dev no ar. |

Não há suíte e2e contra um Postgres real ainda — o fluxo foi validado
manualmente (ver seção acima) na criação deste projeto. Se o domínio crescer,
um teste de integração rodando `processOne` contra o Postgres de dev (com
`web-push` mockado) é o próximo passo natural, no mesmo espírito dos testes
`*.service.test.ts` com banco real do bt-pro.
