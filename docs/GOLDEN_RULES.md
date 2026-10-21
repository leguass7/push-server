# Golden Rules — push-server

> Fonte de verdade das regras de arquitetura, desenvolvimento e código deste
> serviço. Mesmo espírito e mesmo formato do `docs/GOLDEN_RULES.md` do
> bt-pro, **adaptado** para a stack daqui: microsserviço Node/NestJS,
> TypeScript strict, Prisma + PostgreSQL, `web-push`. Ver ADR-0005 (migração
> de Express para NestJS).

## Stack (contexto)

- Node 20+ · NestJS 12 (`@nestjs/platform-express`, Express 5 por baixo) ·
  TypeScript (strict, CommonJS + decorators) · Prisma + PostgreSQL (driver
  adapter `@prisma/adapter-pg`, Prisma 7) · Zod · `web-push` · pino ·
  Vitest + supertest (`@nestjs/testing`) · pnpm · imports relativos (sem
  alias `@/`, ver §7).

---

## 1. Feature-sliced, igual ao bt-pro

- Cada domínio HTTP vive em `src/features/<nome>/`, com controller, service e
  schemas **co-localizados**: `<nome>.controller.ts`, `<nome>.service.ts`,
  `<nome>.schemas.ts`, `<nome>.types.ts`, `<nome>.module.ts`.
- `src/lib/` é só infraestrutura transversal sem regra de negócio
  (`PrismaService`, logger, webpush). Se um helper começa a carregar regra
  de domínio, ele pertence a uma feature, não a `lib/`.
- `src/common/` é infraestrutura HTTP transversal do Nest (não é "regra de
  negócio" nem é "uma feature"): `AuthGuard`, `AllExceptionsFilter`,
  `ZodValidationPipe`, `HttpError`, `NotFoundController`/`NotFoundModule`.
- `src/core/core.module.ts` é o **único** lugar que monta os providers
  transversais com suas dependências reais (`ENV`, `LOGGER`, `WEB_PUSH`,
  `PrismaService`) — `@Global()`, importado uma vez em `app.module.ts`.
  Nenhum outro arquivo instancia `PrismaClient`/chama `configureWebPush` de
  novo; toda feature injeta esses tokens via `@Inject(...)`.
- Estrutura de referência:

  ```text
  src/
  ├── main.ts             # bootstrap: NestFactory, CORS, shutdown hooks, porta
  ├── app.module.ts        # módulo raiz — importa CoreModule + features, guard/filter globais
  ├── core/
  │   └── core.module.ts    # composition root dos providers transversais
  ├── common/                # AuthGuard, AllExceptionsFilter, ZodValidationPipe, HttpError, 404 catch-all
  ├── env/                    # validação de ambiente (Zod)
  ├── lib/                     # PrismaService, logger, webpush — sem regra de negócio
  └── features/
      ├── health/
      ├── vapid/
      ├── subscriptions/
      ├── notifications/        # + dispatch.service.ts (envio em si)
      └── scheduler/             # scheduler.ts (poller puro) + scheduler.service.ts (hooks Nest)
  ```

---

## 2. DRY (BLOQUEANTE)

- Antes de criar uma função/schema/constante, procurar em `src/features/**`
  e `src/lib/**` se já existe algo equivalente.
- **BLOQUEANTE** duplicar: a lógica de "resolver alvos" (`dispatch.service.ts`
  `resolveTargets`), a lógica de "enviar e registrar resultado por endpoint"
  (`dispatchToTargets`), schemas Zod, status de Notification/Delivery.
- `/send` (legado) e `POST /notifications` (novo) **compartilham** o mesmo
  `notifications.service.ts::create` — não duplicar o caminho de
  criar+processar uma Notification para o endpoint legado.

---

## 3. Validação — Zod é a fonte de verdade (BLOQUEANTE)

- Todo body/query de rota passa por `@Body(new ZodValidationPipe(schema))`/
  `@Query(new ZodValidationPipe(schema))` (`src/common/zod-validation.pipe.ts`)
  antes de chegar ao service — nunca confiar em `req.body`/`req.query` cru,
  nem dentro do service (o service recebe tipos já validados do schema).
  **Não** usar o `ValidationPipe`/`class-validator` nativo do Nest — Zod é a
  única fonte de verdade de validação neste projeto.
- Erros não precisam de `try/catch` por rota: o Nest encaminha toda
  rejeição de pipe/guard/controller `async` para `AllExceptionsFilter`
  (`src/common/all-exceptions.filter.ts`, registrado global via
  `APP_FILTER`), que mapeia `ZodError`/`HttpError`/exceção genérica para
  `400`/status específico/`500` — diferente do Express 4 antigo, que
  exigia um `asyncHandler` manual para isso.

---

## 4. Status em código, nunca enum do Postgres (BLOQUEANTE)

- Mesma decisão do bt-pro (lá, GOLDEN_RULES §6) e pelo mesmo motivo:
  `NotificationStatus`/`DeliveryStatus` vivem em
  `src/features/notifications/notifications.types.ts` como objeto
  `as const` + union type — **nunca** `enum` nativo do Prisma/Postgres.
  Adicionar um status novo é só código; não deve exigir migration.
- No banco, as colunas correspondentes são `String`.

---

## 5. Tipagem (BLOQUEANTE)

- TypeScript strict, sem `any`. Onde um dado externo (payload do caller,
  resposta do `web-push`) realmente não tem tipo garantido, tipar como
  `unknown` e validar/narrow explicitamente — não `as any` para calar o
  compilador.
- Tipos nomeados (`type`/`interface`) para qualquer shape exportado; nada de
  objeto inline complexo em assinatura pública.
- Identidade por `id`/`endpoint` (chave primária), nunca por `title`/label.

---

## 6. Serviços com dependências explícitas no construtor (BLOQUEANTE)

- Todo `@Injectable()` recebe suas dependências via construtor, **cada
  parâmetro com `@Inject(Token)` explícito** — mesmo para dependências que
  são classes (ex.: `@Inject(PrismaService) private readonly prisma: PrismaService`),
  nunca confiando em inferência de tipo via `emitDecoratorMetadata`. Por quê:
  `tsx`/esbuild (usado em `pnpm dev` e pelo Vitest) **não** emite
  `design:paramtypes` — um construtor sem `@Inject()` explícito resolve no
  `tsc` build mas quebra em dev/teste com "Nest can't resolve dependencies".
- Nenhum service importa um singleton global de outro módulo além dos
  tokens de `src/core/core.module.ts` (`ENV`, `LOGGER`, `WEB_PUSH`,
  `PrismaService`). Isso é o que torna os services testáveis com fakes
  simples via `new XService(fake1, fake2, ...)` (ver `*.test.ts` ao lado de
  cada service) sem precisar de um `TestingModule` do Nest.

---

## 7. Imports relativos, não alias (decisão deste projeto, diferente do bt-pro)

- `tsconfig.json` usa `module: "commonjs"`/`moduleResolution: "node"` (sem
  `"type": "module"` no `package.json`) — padrão NestJS, com
  `experimentalDecorators`/`emitDecoratorMetadata` ligados para os
  decorators (`@Module`, `@Injectable`, `@Controller`, etc.) funcionarem.
  Imports relativos **sem** extensão (`from "./env"`). **Revogado** o
  regime anterior (Node ESM puro com `.js` obrigatório) de quando o serviço
  rodava Express direto via `tsx`/`node dist/` — ver ADR-0005.
- Por isso este projeto **não** usa alias `@/*` como o bt-pro: para um
  serviço deste tamanho, import relativo direto é mais simples e não exige
  mapear o alias em mais de um lugar (`tsconfig.json`, bundler, editor).

---

## 8. Logs e observabilidade

- `pino` estruturado, nunca `console.log` fora de scripts de CLI
  (`scripts/*.mjs`). Nível via `LOG_LEVEL`.
- Todo caminho de erro tratado (`dispatch.service.ts`, scheduler) loga com
  contexto (`endpoint`, `notificationId`, `statusCode`) — nunca um
  `catch` vazio ou só `console.error`.
- `pino-http` loga cada request; não duplicar logging manual de
  entrada/saída de rota.

---

## 9. Scheduler e retry — limites explícitos (ver ADR-0003)

- Qualquer mudança na lógica de retry/backoff do `scheduler.ts` ou de
  `notifications.service.ts::processOne` **exige** atualizar o ADR-0003 na
  mesma entrega — é a fonte de verdade do que é intencional vs. esquecido.
- Nenhuma rotina de disparo roda em paralelo descontrolado (`Promise.all`
  solto sobre N alvos) sem um motivo documentado — o padrão é sequencial
  (ver `dispatchToTargets`), para não estourar rate limit dos push services
  dos navegadores.

---

## 10. Servidores locais e portas (BLOQUEANTE para agentes)

Mesma regra do bt-pro (lá, GOLDEN_RULES §13), aplicada aqui:

1. Ao subir `pnpm dev`/`node dist/main.js` para verificação, **encerrar o
   processo** ao terminar — não deixar `node`/`tsx` órfão.
2. **Liberar a porta** (padrão **3000**) antes de concluir a tarefa.
3. `pnpm docker:up`/`docker:down` são o par certo para o Postgres de dev —
   não subir um Postgres descartável sem derrubar no final.
4. O `pnpm dev` do usuário no terminal dele **não** é do agente derrubar —
   só processos/portas que o próprio agente abriu.

---

## Revisão (cíclico)

Ao implementar/revisar: **estrutura/composition root (§1) → DRY (§2) →
validação Zod + exception filter (§3) → status em código (§4) → tipagem
(§5) → services com `@Inject` explícito (§6) → imports relativos sem
extensão (§7) → logs (§8) → scheduler/retry documentado no ADR (§9) →
portas/processos locais (§10)**. Bloqueantes reprovam; o resto é alerta.
