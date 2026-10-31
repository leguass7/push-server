# Roadmap — cutover na infra PW2C

Este repositório substituiu a stack Swarm `push-server` (serviço
`push-server_push-server`) na infra PW2C. O contrato HTTP legado permanece
(ADR-0004). O domínio `push-server.pw2c.s4sbr.com` permanece.

## Estado em 31 de outubro de 2026

### Produção (este repo)

- Stack Portainer: `push-server-v2` (id 200, endpoint 1).
- Serviço: `push-server-v2_push-server`.
- Imagem: `registry.cloud.grupopw2c.com.br/push-server:latest` (v0.3.1).
- Porta publicada: 3096 → 3000 (ingress). O NPM usa o nome do serviço na
  overlay `infra-shared_shared_net`, porta **3000** do container.
- YAML local: `docs/pw2c-stack.yml` (gitignored). Espelha a stack no
  Portainer.
- `GET /health` no domínio: `{ ok, subscriptions, version }`.
- Dump legado importado em `Subscription` (1 inscrição). Cópia local em
  `backups/legacy-subscriptions.json` (gitignored).

### CI/CD comprovado

`pnpm release` local cria changelog, tag `vX.Y.Z` e GitHub Release. O job
`deploy` da Action dispara em `release` published:

1. Push `latest` e `X.Y.Z` no registry PW2C.
2. POST no webhook do serviço `push-server-v2_push-server`.

Prova: run
[41230360913](https://github.com/leguass7/push-server/actions/runs/41230360913)
(`v0.3.1`, 31 de outubro de 2026) — job `deploy` success, webhook
acionado, domínio responde `version: "0.3.1"`.

### Legado removido

A stack Portainer `push-server` (id 190, `node:20-alpine`, porta 3095) foi
apagada em 31 de outubro de 2026. O volume `push-server_push-server-data`
permanece no `compute03`. Não apague esse volume até confirmar que não
precisa de rollback.

### Postgres de produção

- Host: `pg01.cluster.cloud.grupopw2c.com.br:5432`.
- Banco: `push_server`, schema `public`.
- Migration `20261020195219_init` aplicada (20 de outubro de 2026).
- A senha do usuário tem `#` e `@`. Em `DATABASE_URL`, percent-encode
  (`#` → `%23`, `@` → `%40`). Sem isso o parser trata `postgres` como host
  (`ENOTFOUND`).

### `.env` local

`DATABASE_URL` aponta para esse Postgres, com a senha já encoded. As chaves
VAPID do `.env` são as da produção. Não gere outras.

## Invariantes

1. Trocar `VAPID_PUBLIC_KEY` ou `VAPID_PRIVATE_KEY` invalida todas as
   inscrições nos navegadores.
2. `API_TOKEN` permanece vazio até ativação coordenada com o bt-pro
   (ADR-0004).
3. O NPM resolve o serviço só na overlay compartilhada
   `infra-shared_shared_net`. Host: `push-server-v2_push-server` (ou alias
   `push-server`), porta 3000.
4. Push remoto e mudança da stack Swarm só com autorização explícita do
   usuário (`AGENTS.md`).

## Depois do cutover (não bloqueia produção)

- Ative `API_TOKEN` neste serviço e no `push-server-client.ts` do bt-pro,
  na ordem do ADR-0004.
- Teste de integração de `processOne` contra o Postgres de dev, com
  `web-push` mockado — ver [`WORKFLOW.md`](WORKFLOW.md).
- Apague o volume legado `push-server_push-server-data` só depois de um
  período estável.

## Fora deste cutover

- Rotacionar chaves VAPID.
- Exigir auth no contrato legado sem coordenar o bt-pro.

## Dependências

- Contrato legado: [`adr/0004-compatibilidade-com-bt-pro.md`](adr/0004-compatibilidade-com-bt-pro.md)
- Stack e persistência: [`adr/0001-stack-express-prisma-postgres.md`](adr/0001-stack-express-prisma-postgres.md)
- Stack Portainer: `docs/pw2c-stack.yml` (local, gitignored)
- Schema: `prisma/schema.prisma`, migration `20261020195219_init`
- Env do runtime: `src/env/env.ts`
- Fluxo de release: [`WORKFLOW.md`](WORKFLOW.md)
