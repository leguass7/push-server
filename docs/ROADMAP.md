# Roadmap — cutover na infra PW2C

Este repositório substitui a stack Swarm `push-server` (serviço
`push-server_push-server`) na infra PW2C. O contrato HTTP legado permanece
(ADR-0004). O domínio `push-server.pw2c.s4sbr.com` pode permanecer.

## Estado em 20 de outubro de 2026

### Código deste repo

Inscrições, `/send` legado, `/notifications` e o scheduler da v1 estão
prontos. A imagem de produção é o `Dockerfile` deste repo (`node:22-alpine`,
`CMD node dist/index.js`). A stack Swarm **ainda não** usa essa imagem.

### Stack ainda em produção (legado)

- Host Swarm: `pw2c-compute01` (alias SSH `pw2c-compute01-root`).
- Serviço: `push-server_push-server`, imagem `node:20-alpine`.
- `package.json` e `server.js` nascem no `command:` da stack, sem
  Dockerfile próprio (ADR-0001).
- Env da stack: `PORT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`. Sem `DATABASE_URL`. Sem `API_TOKEN`.
- Persistência: volume `push-server_push-server-data` em `/app/data`
  (`subscriptions.json`).
- Porta publicada: 3095 → 3000.

### Postgres de produção

- Host: `pg01.cluster.cloud.grupopw2c.com.br:5432`.
- Banco: `push_server`, schema `public`.
- Criado em 20 de outubro de 2026. Migration `20261020195219_init` aplicada
  (`pnpm db:migrate`).
- Tabelas `Subscription`, `Notification` e `Delivery` existem e estão
  vazias.
- A senha do usuário tem `#` e `@`. Em `DATABASE_URL`, percent-encode
  (`#` → `%23`, `@` → `%40`). Sem isso o parser trata `postgres` como host
  (`ENOTFOUND`).

### `.env` local

`DATABASE_URL` aponta para esse Postgres, com a senha já encoded. As chaves
VAPID do `.env` são as da stack em produção. Não gere outras para o
cutover.

## Invariantes

1. Trocar `VAPID_PUBLIC_KEY` ou `VAPID_PRIVATE_KEY` invalida todas as
   inscrições nos navegadores. O cutover usa as chaves atuais da stack.
2. `API_TOKEN` permanece vazio no primeiro deploy da imagem nova
   (ADR-0004). Ativar depois, coordenado com o bt-pro.
3. Não atualize a stack para a imagem deste repo com `Subscription` vazia
   enquanto o volume legado ainda tem inscrições. Importe o JSON antes.
4. Rode `pnpm db:migrate` (`prisma migrate deploy`) antes de o serviço
   novo apontar para o Postgres. A migration `init` já está aplicada.
5. Push remoto e mudança da stack Swarm só com autorização explícita do
   usuário (`AGENTS.md`).

## Próximos passos

Ordem obrigatória:

1. Importe `subscriptions.json` do volume `push-server_push-server-data`
   para a tabela `Subscription`. Confira a contagem depois.
2. Construa e publique a imagem (`docker build` + registry da infra PW2C).
3. Atualize a stack Swarm: imagem nova, `DATABASE_URL` (senha encoded),
   VAPID iguais às atuais, `API_TOKEN` vazio. Porta e domínio iguais.
4. Confira `GET /health` e `GET /vapid-public-key` no domínio atual.
5. Depois do cutover estável: ative `API_TOKEN` no serviço e no
   `push-server-client.ts` do bt-pro, na ordem do ADR-0004.

Como executar o deploy: [`WORKFLOW.md`](WORKFLOW.md) (seção Deploy).

## Depois (não bloqueia o cutover)

- Teste de integração de `processOne` contra o Postgres de dev, com
  `web-push` mockado — ver [`WORKFLOW.md`](WORKFLOW.md).
- CI/CD da imagem. Hoje o deploy da stack é manual no Portainer.

## Fora deste cutover

- Rotacionar chaves VAPID.
- Exigir auth no contrato legado no primeiro deploy da imagem nova.
- Apagar o volume legado antes de confirmar que a tabela `Subscription`
  tem as inscrições importadas.

## Dependências

- Contrato legado: [`adr/0004-compatibilidade-com-bt-pro.md`](adr/0004-compatibilidade-com-bt-pro.md)
- Stack e persistência: [`adr/0001-stack-express-prisma-postgres.md`](adr/0001-stack-express-prisma-postgres.md)
- Schema: `prisma/schema.prisma`, migration `20261020195219_init`
- Env do runtime: `src/env/env.ts`
