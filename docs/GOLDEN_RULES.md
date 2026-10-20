# Golden Rules — push-server

> Fonte de verdade das regras de arquitetura, desenvolvimento e código deste
> serviço. Mesmo espírito e mesmo formato do `docs/GOLDEN_RULES.md` do
> bt-pro, **adaptado** para a stack daqui: microsserviço Node/Express (sem
> React/Next), TypeScript strict, Prisma + PostgreSQL, `web-push`.

## Stack (contexto)

- Node 20+ · Express 4 · TypeScript (strict) · Prisma + PostgreSQL (driver
  adapter `@prisma/adapter-pg`, Prisma 7) · Zod · `web-push` · pino · Vitest
  + supertest · pnpm · imports relativos (sem alias `@/`, ver §7).

---

## 1. Feature-sliced, igual ao bt-pro

- Cada domínio HTTP vive em `src/features/<nome>/`, com rotas, service e
  schemas **co-localizados**: `<nome>.routes.ts`, `<nome>.service.ts`,
  `<nome>.schemas.ts`, `<nome>.types.ts`.
- `src/lib/` é só infraestrutura transversal sem regra de negócio (Prisma
  client, logger, webpush, async-handler). Se um helper começa a carregar
  regra de domínio, ele pertence a uma feature, não a `lib/`.
- `src/container.ts` é o **único** lugar que monta services com suas
  dependências reais (Prisma, webpush configurado). `app.ts` e `index.ts`
  recebem um `Container` já pronto — nenhum outro arquivo instancia
  `PrismaClient` ou chama `configureWebPush` de novo.
- Estrutura de referência:

  ```
  src/
  ├── index.ts          # bootstrap: porta, scheduler, shutdown
  ├── app.ts            # monta rotas a partir de um Container
  ├── container.ts       # composition root dos services
  ├── env/               # validação de ambiente (Zod)
  ├── lib/                # prisma, logger, webpush, async-handler — sem regra de negócio
  ├── middleware/         # auth, error-handler
  └── features/
      ├── health/
      ├── vapid/
      ├── subscriptions/
      ├── notifications/   # + dispatch.service.ts (envio em si)
      └── scheduler/
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

- Todo body/query de rota passa por um schema Zod antes de chegar ao
  service — nunca confiar em `req.body`/`req.query` cru, nem dentro do
  service (o service recebe tipos já validados do schema).
- Handler assíncrono de rota **sempre** passa por `asyncHandler`
  (`src/lib/async-handler.ts`) — Express 4 não encaminha rejeições de
  `async` para o error middleware por conta própria; esquecer o wrapper
  faz o erro (incluindo `ZodError`) travar o request em silêncio em vez de
  responder 400/500. Ver `src/middleware/error-handler.ts`.

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

## 6. Serviços puros de efeito colateral explícito

- Um `create*Service(deps)` recebe suas dependências por parâmetro
  (`prisma`, `webpush`, `logger`, outros services) e retorna um objeto de
  funções — nunca importa um singleton global de outro módulo além de
  `src/lib/prisma.ts` (a única instância de verdade, compartilhada via
  `container.ts`). Isso é o que torna os services testáveis com fakes
  simples (ver `*.test.ts` ao lado de cada service) sem precisar de um
  framework de mock.

---

## 7. Imports relativos, não alias (decisão deste projeto, diferente do bt-pro)

- `tsconfig.json` usa `module`/`moduleResolution: NodeNext` (ESM puro,
  `"type": "module"` no `package.json`) — todo import relativo **precisa**
  da extensão `.js` (`from "./env.js"`), mesmo apontando para um arquivo
  `.ts`. É a regra do Node ESM, não uma escolha de estilo.
- Por isso este projeto **não** usa alias `@/*` como o bt-pro: path aliases
  exigem uma camada de resolução extra (loader/`tsconfig-paths`) que some
  do runtime em produção se não for replicada com cuidado — para um serviço
  deste tamanho, import relativo direto é mais simples e não quebra ao
  trocar de executor (`tsx` em dev, `node dist/` em produção).

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

1. Ao subir `pnpm dev`/`node dist/index.js` para verificação, **encerrar o
   processo** ao terminar — não deixar `node`/`tsx` órfão.
2. **Liberar a porta** (padrão **3000**) antes de concluir a tarefa.
3. `pnpm docker:up`/`docker:down` são o par certo para o Postgres de dev —
   não subir um Postgres descartável sem derrubar no final.
4. O `pnpm dev` do usuário no terminal dele **não** é do agente derrubar —
   só processos/portas que o próprio agente abriu.

---

## Revisão (cíclico)

Ao implementar/revisar: **estrutura/composition root (§1) → DRY (§2) →
validação + asyncHandler (§3) → status em código (§4) → tipagem (§5) →
services com deps explícitas (§6) → imports relativos com `.js` (§7) → logs
(§8) → scheduler/retry documentado no ADR (§9) → portas/processos locais
(§10)**. Bloqueantes reprovam; o resto é alerta.
