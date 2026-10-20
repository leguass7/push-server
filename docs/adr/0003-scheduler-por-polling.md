# ADR-0003 — Scheduler por polling (não fila) nesta v1

## Contexto

Notificação push não é um domínio de alto volume/alta concorrência — é
agendamento de produto (lembretes, avisos), não processamento de eventos em
tempo real. Uma fila dedicada (BullMQ + Redis, pg-boss) resolveria retry,
backoff e concorrência de forma mais robusta, mas adiciona uma peça de infra
(Redis) ou uma dependência mais pesada, para um problema que hoje tem uma
única instância do serviço e um volume baixo.

## Decisão

1. **Poller simples**: `setInterval` (configurável via `POLL_INTERVAL_MS`,
   padrão 30s) busca `Notification` com `status=PENDING` e `scheduledAt` no
   passado, em lotes (`DISPATCH_BATCH_SIZE`, padrão 20), e processa uma a uma
   — sequencial, não paralelo, para não estourar o rate limit dos serviços de
   push dos navegadores.
2. **"Claim" otimista via `updateMany` com guarda de status** (`WHERE id = ?
   AND status = 'PENDING'`) antes de processar — mesmo com uma única
   instância hoje, evita processar a mesma Notification duas vezes se um
   tick demorado se sobrepuser ao próximo (`ticking` flag) ou se um dia a
   gente rodar 2 réplicas sem perceber.
3. **Envio imediato não espera o poller**: `POST /notifications` (e o
   `/send` legado) com `scheduledAt <= agora` chama `processOne` **inline**,
   na mesma request — sem isso, todo envio "agora" teria uma latência de até
   `POLL_INTERVAL_MS` por nada.
4. **Retry — só para falha total, linear, simples**: se **todos** os alvos
   de um disparo falharem (`sent === 0`, sem contar `EXPIRED` — ver
   ADR-0002), a Notification volta para `PENDING` com `scheduledAt = agora +
   attempts × 5min`, até `MAX_SEND_ATTEMPTS` (padrão 3); depois disso, vira
   `FAILED` definitivo.
5. **Falha parcial (`PARTIALLY_SENT`) não tem retry automático nesta v1.**
   Reenviar reprocessaria o alvo inteiro (um endpoint específico, ou todo o
   broadcast outra vez via `resolveTargets`), duplicando notificações que já
   chegaram com sucesso em alguns dispositivos. Resolver isso direito pede
   retry **por `Delivery`**, não por `Notification` — fora de escopo aqui.

## Alternativas consideradas

- **BullMQ + Redis**: retry/backoff/concorrência de verdade, dashboards
  prontos. Descartado por ora: mais uma peça de infra para operar, para um
  volume que não precisa disso ainda.
- **pg-boss**: fila sobre o próprio Postgres (sem Redis). Caminho de upgrade
  mais natural que BullMQ se o polling se mostrar insuficiente — mesma peça
  de infra, mais garantias.

## Consequências

- Latência mínima de entrega agendada = `POLL_INTERVAL_MS` (pior caso).
  Aceitável para lembretes de produto; **não** usar este serviço para algo
  que precise de latência sub-segundo.
- Rodar 2+ réplicas do processo é seguro quanto a duplicar envio (o `claim`
  cobre isso), mas não ganha paralelismo real — ambas competem pelo mesmo
  lote. Se o volume crescer a ponto de precisar de paralelismo de verdade,
  é o sinal para migrar para pg-boss/BullMQ (não para "rodar mais réplicas").
- Retry por `Delivery` (não só por `Notification`) é a dívida técnica mais
  provável de precisar ser paga primeiro, se o produto passar a depender de
  entrega confiável por dispositivo.

## Status

accepted
