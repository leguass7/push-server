# ADR-0005 — Migração do runtime HTTP de Express para NestJS

## Contexto

O ADR-0001 escolheu Express por ser suficiente para uma superfície HTTP
pequena. Por decisão explícita do usuário, o serviço foi reescrito sobre
NestJS, mantendo **byte a byte** o contrato HTTP das rotas (ver ADR-0004) e
todo o domínio (services, schemas, Prisma) — só a camada de transporte HTTP
e o bootstrap do processo mudaram.

Este serviço continua self-hosted (Node, Docker/Swarm), não serverless — o
scheduler por polling (ADR-0003) continua precisando de um processo de
longa duração, mesmo motivo do ADR-0001.

## Decisão

1. **Controllers/Modules substituem Router/`*.routes.ts`**: cada rota do
   contrato vive em `src/features/<nome>/<nome>.controller.ts`
   (`@Controller()` + `@Get`/`@Post`/`@Delete`), agrupada num
   `<nome>.module.ts`. Schemas e services continuam co-localizados,
   praticamente inalterados.
2. **DI do Nest substitui `container.ts`**: `src/core/core.module.ts`
   (`@Global()`) provê os tokens transversais (`ENV`, `LOGGER`, `WEB_PUSH`,
   `PrismaService`) uma única vez; toda feature injeta via
   `@Inject(Token)`. Os antigos `create*Service(deps)` (factory function +
   objeto literal) viraram classes `@Injectable()` com as mesmas
   dependências explícitas no construtor — é o idioma equivalente em Nest
   (GOLDEN_RULES §6), não uma regressão da regra.
3. **`@Inject()` explícito em *todo* parâmetro, mesmo para classes** —
   decisão não-óbvia: o Nest resolve dependências de dois jeitos, por
   token explícito (`@Inject(X)`) ou por **inferência do tipo do parâmetro**
   via `emitDecoratorMetadata` (o compilador grava `design:paramtypes` no
   decorator). O segundo caminho **não funciona sob `tsx`/esbuild**
   (usado em `pnpm dev` e pelo Vitest) — esbuild não emite essa metadata,
   só o `tsc` real emite. Um construtor sem `@Inject()` explícito passaria
   no `tsc build` mas quebraria em dev/teste com "Nest can't resolve
   dependencies of X". Resolvido evitando depender da inferência: todo
   parâmetro de todo `@Injectable()`/Guard/Filter leva `@Inject(Token)`
   explícito neste projeto.
4. **Validação continua 100% Zod**, não o `ValidationPipe`/`class-validator`
   nativo do Nest — `ZodValidationPipe` (`src/common/zod-validation.pipe.ts`)
   é um `PipeTransform` fino que só chama `schema.parse(value)`,
   instanciado por valor (`new ZodValidationPipe(schema)`) em cada rota, não
   via DI (cada uso leva um schema diferente).
5. **Erros**: `AllExceptionsFilter` (`src/common/all-exceptions.filter.ts`,
   registrado global via `APP_FILTER`) substitui o
   `middleware/error-handler.ts` do Express — mesmo mapeamento
   (`ZodError` → 400, `HttpError` → status próprio, genérico → 500). Como
   bônus, não precisa mais de um `asyncHandler` manual: o Nest já encaminha
   toda rejeição de pipe/guard/controller para o filtro global.
6. **Auth**: `AuthGuard` (`src/common/auth.guard.ts`), registrado global via
   `APP_GUARD`, substitui `middleware/auth.ts` — mesmo contrato (Bearer
   opt-in via `API_TOKEN`, `/health` sempre livre).
7. **404 genérico**: `NotFoundController` (`@All("/{*splat}")`) devolve
   `{error:"not_found"}` em JSON, no lugar da página HTML padrão do Nest —
   mas precisa estar no **último** módulo importado por `app.module.ts`
   (`NotFoundModule`). Detalhe não-óbvio, confirmado empiricamente: o Nest
   registra rotas na ordem em que os módulos entram no container de DI
   (incluindo `imports`), então um catch-all registrado antes de uma rota
   específica **sombreia** essa rota (confirmado: `/health` virava 404 até
   mover o catch-all para o fim de `imports`). Além disso, `@nestjs/platform-express`
   12 embute **Express 5** (não Express 4): a sintaxe de wildcard mudou —
   `*splat` sozinho não casa com a raiz `/`; é preciso `/{*splat}` (grupo
   opcional). `AllExceptionsFilter` também trata `NotFoundException` nativa
   do Nest como defesa extra, caso alguma rota escape do catch-all.
8. **Scheduler**: `scheduler.ts` (função pura, igual ao Express) continua
   framework-agnóstico; `scheduler.service.ts` é o único arquivo que
   conhece o Nest — usa `OnApplicationBootstrap`/`OnModuleDestroy` para
   iniciar/parar o poller, substituindo o `server.listen()` callback e os
   `process.on("SIGTERM"/"SIGINT", ...)` manuais do antigo `index.ts`.
   `main.ts` chama `app.enableShutdownHooks()` para ligar esse ciclo de
   vida aos sinais do processo.
9. **CORS/Express**: `app.enableCors()` sem opções usa o mesmo pacote
   `cors` por baixo (dependência do `@nestjs/platform-express`) — mesmo
   comportamento do antigo `app.use(cors())`, incluindo o preflight
   `OPTIONS` automático.
10. **`"type": "module"` removido**; `tsconfig.json` usa
    `module: "commonjs"`/`moduleResolution: "bundler"` + `experimentalDecorators`/
    `emitDecoratorMetadata` — padrão NestJS. Imports relativos **sem**
    extensão `.js`. `moduleResolution: "node"` (`node10`) ficou deprecado
    no TypeScript 6. `"bundler"` mantém o mesmo emit CommonJS.
11. **Testes HTTP**: os testes de contrato (antes com `supertest` sobre um
    `Express app` construído manualmente) agora usam `@nestjs/testing`
    (`Test.createTestingModule(...).compile()`) + `supertest` sobre
    `app.getHttpServer()` — mesma cobertura, idioma Nest.

## Consequências

- `pnpm dev`/`pnpm build`/`pnpm start` continuam com os mesmos nomes, só o
  arquivo de entrada muda: `tsx watch src/main.ts` / `tsc -p tsconfig.json`
  / `node dist/main.js` (antes `src/index.ts`/`dist/index.js`).
- `Dockerfile` atualizado: `CMD ["node", "dist/main.js"]`. Também corrigidos
  dois bugs pré-existentes (nunca testados — o build da imagem era
  "Pendente" no ROADMAP): a ordem de `COPY` fazia o `postinstall` (`prisma
  generate`) falhar por faltar o schema, e o estágio de runtime
  (`pnpm install --prod`) tentava rodar `prisma generate` sem a CLI
  (devDependency) instalada — corrigido com `COPY prisma`/`pnpm-workspace.yaml`
  antes do install e `--ignore-scripts` no estágio de runtime (o Prisma
  Client já vem gerado do estágio de build).
- O contrato HTTP (rotas, status codes, shape do body) é idêntico — validado
  manualmente ponta a ponta contra Postgres local em todas as rotas,
  incluindo auth opt-in, 404 genérico (incluindo a raiz `/`), CORS
  preflight, e o scheduler processando uma Notification agendada de
  verdade — tanto via `pnpm dev`/`pnpm start` quanto dentro da imagem
  Docker.
- GOLDEN_RULES.md (§1, §3, §6, §7) e AGENTS.md foram atualizados para
  refletir controllers/modules/DI do Nest no lugar de Router/`container.ts`/
  `asyncHandler`. As demais Golden Rules (DRY, status em código, tipagem,
  logs, scheduler/retry, portas locais) continuam valendo sem mudança — o
  domínio não mudou, só o transporte HTTP.
- A tentativa anterior de migrar para Next.js (route handlers) foi
  descartada por instrução explícita do usuário — preservada só como
  referência histórica na branch `archive/tentativa-nextjs`, nunca
  mesclada em `main`.

## Status

accepted
