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
pnpm dev                 # tsx watch src/main.ts — reinicia a cada mudança
pnpm build                # tsc → dist/
pnpm start                 # node dist/main.js (produção)
```

## Qualidade

```bash
pnpm lint                 # ESLint (typed)
pnpm lint:fix
pnpm typecheck              # tsc --noEmit
pnpm test                    # Vitest
pnpm verify                   # lint + typecheck + test + build — rodar antes de considerar uma entrega pronta
```

## Fluxo de implementação

Siga esta ordem em toda mudança que vai para `main`. Não pule passo.
O pipeline está em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### 1. Implemente numa branch

1. Parta de `main`.
2. Mantenha o escopo na tarefa. Não mude o shape das rotas legadas
   (`/vapid-public-key`, `/subscribe`, `/send`) sem atualizar o ADR-0004
   e avisar o bt-pro.
3. Rode `pnpm verify` antes do PR.

### 2. Commit (conventional commits)

O prefixo da mensagem decide o bump quando você rodar `pnpm release`.
Não edite `package.json` nem o [`CHANGELOG.md`](../CHANGELOG.md) na
entrega da feature.

| Prefixo | Próxima versão | Entra no changelog |
| --- | --- | --- |
| `feat:` | minor (`0.3.0` → `0.4.0`) | sim |
| `fix:` | patch (`0.3.0` → `0.3.1`) | sim |
| `feat!:` ou `BREAKING CHANGE:` | major (`0.3.0` → `1.0.0`) | sim |
| `chore:`, `docs:`, `test:`, `ci:` | nenhum bump | não |

Uma ideia por commit. Assunto no imperativo, em português.

```text
feat: inclui version no GET /health
fix: recusa subscribe sem keys
docs: descreve o fluxo de release
```

### 3. Pull request para `main`

O job `verify` tem de passar (`pnpm verify`). Sem isso não mescle.
Push em `main` **não** publica imagem.

### 4. Release local (changelog + tag + GitHub Release)

Em `main` limpa, autenticado no `gh`:

```bash
pnpm release:dry    # conferir bump e changelog, sem gravar
pnpm release        # pede confirmação, depois grava
```

O `release-it` (via [`scripts/release.mjs`](../scripts/release.mjs)):

1. Lê os conventional commits desde a última tag.
2. Sobe `package.json` e prepende o [`CHANGELOG.md`](../CHANGELOG.md).
3. Commit `chore: release X.Y.Z`, tag `vX.Y.Z`, push.
4. Cria o GitHub Release (`gh`).

Esse último passo já foi validado na `v0.3.0`: o evento `release`
dispara o job `deploy`.

### 5. Deploy da imagem (CI)

O job `deploy` só roda em GitHub Release publicado (ou
`workflow_dispatch`). Publica:

- `{REGISTRY}/push-server:latest`
- `{REGISTRY}/push-server:X.Y.Z` (sem o `v` da tag git)

Depois chama o webhook do Portainer. A stack Swarm usa `:latest`.
A YAML local `docs/pw2c-stack.yml` é gitignored (repo público).

`workflow_dispatch` republica `latest` e a versão atual do
`package.json`. Use só em emergência.

### 6. Confira a versão no ar

`GET /health` responde `{ ok, subscriptions, version }`. `version` é a
string de `package.json` da imagem que está rodando. Tem de coincidir
com a tag `X.Y.Z` recém-publicada.

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

A YAML da stack fica só na máquina, em `docs/pw2c-stack.yml` (gitignored).
Não versionar. Nome da stack no Portainer: `push-server` — o mesmo do
legado. Colar por cima substitui o `command:` inline pela imagem deste
repo. Porta 3095 e overlay próprios permanecem, para o domínio
`push-server.pw2c.s4sbr.com` continuar válido.

### Primeiro deploy (manual, uma vez)

1. O dump do volume legado já foi importado para `Subscription` (cópia
   local em `backups/legacy-subscriptions.json`, gitignored). Confira a
   contagem se o legado tiver recebido opt-in depois de 31 de outubro de
   2026.
2. Publique a primeira imagem: `pnpm release` em `main` (tags `latest`
   e `X.Y.Z`), ou `workflow_dispatch` em emergência.
3. No Portainer, edite a stack `push-server` e cole o conteúdo local
   de `docs/pw2c-stack.yml`. Preencha as env vars no editor:
   - `DATABASE_URL` — senha com `#`/`@` percent-encoded (`#` → `%23`,
     `@` → `%40`)
   - `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — iguais às
     da stack legado (trocar a chave invalida as inscrições)
   - `API_TOKEN` — vazio no primeiro deploy (ADR-0004)
4. Ative o webhook do serviço `push-server` no Portainer. Grave a URL no
   secret `PORTAINER_WEBHOOK_URL` deste repositório GitHub.
5. Grave os secrets do registry (`REGISTRY`, `REGISTRY_USERNAME`,
   `REGISTRY_PASSWORD`). O host e o usuário não ficam no YAML — o repo é
   público.

Postgres `push_server` e a migration `20261020195219_init` já estão
aplicados (20 de outubro de 2026).

### CI/CD (depois do primeiro deploy)

O fluxo contínuo (commit em `main` → `pnpm release` → imagem `latest` +
`X.Y.Z` → webhook) está na seção **Fluxo de implementação** acima. Não
publique imagem em todo push de `main`.

Secrets do repositório GitHub:

| Secret | Uso |
| --- | --- |
| `REGISTRY` | Host do registry (sem `https://`) |
| `REGISTRY_USERNAME` | Usuário do registry |
| `REGISTRY_PASSWORD` | Senha do registry |
| `PORTAINER_WEBHOOK_URL` | Redeploy da stack. Sem ele o job publica a imagem e não atualiza o Swarm |

Não coloque senha, `DATABASE_URL` nem chave VAPID privada no YAML da stack
nem no workflow. Push remoto e troca da stack só com autorização explícita.

## Testes — organização

| Suíte | Comando | Como |
| --- | --- | --- |
| Vitest | `pnpm test` | Services instanciados direto (`new XService(fakes...)`, sem `TestingModule`) + rotas via `supertest` sobre um `app.getHttpServer()` do `@nestjs/testing` com providers fake — rápido, sem precisar do Postgres de dev no ar. |

Não há suíte e2e contra um Postgres real ainda — o fluxo foi validado
manualmente (ver seção acima) na criação deste projeto. Se o domínio crescer,
um teste de integração rodando `processOne` contra o Postgres de dev (com
`web-push` mockado) é o próximo passo natural, no mesmo espírito dos testes
`*.service.test.ts` com banco real do bt-pro.
