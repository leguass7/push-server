# ADR-0002 — Modelo de dados: Subscription / Notification / Delivery

## Contexto

O pedido original era duplo: (1) agendar envios, (2) saber o que foi ou não
enviado. O push-server atual não persiste nenhum histórico — `/send` manda e
esquece. Precisamos de um modelo que suporte os dois sem acoplar "quem
recebe" (Subscription) com "o que foi mandado e quando" (Notification) com
"o resultado por dispositivo" (Delivery), porque uma Notification pode ter 0
(ainda não processada), 1 (endpoint específico) ou N (broadcast) alvos.

## Decisão

1. **`Subscription`** — chave primária é o próprio `endpoint` (não um `id`
   sintético): é o identificador natural do protocolo Push API, e evita um
   índice único redundante. Este serviço continua **sem** conceito de
   "usuário" (ADR-0022 do bt-pro já decidiu isso do lado deles); quem associa
   endpoint↔pessoa é sempre o caller.
2. **`Notification`** — um registro por envio (imediato ou agendado).
   `targetEndpoint: String?` — `null` significa **broadcast** (todas as
   inscrições ativas *no momento do disparo*, não no momento da criação).
   `status` e `scheduledAt` têm índice composto porque é exatamente essa
   dupla que o scheduler consulta a cada tick.
3. **`Delivery`** — um registro por **alvo** dentro do disparo de uma
   Notification. É a resposta literal a "o que foi ou não enviado": uma
   Notification de broadcast para 5 inscrições gera até 5 Deliveries, cada
   uma com seu próprio `status`/`statusCode`/`error`.
4. **`Delivery.endpoint` é um valor solto, sem FK para `Subscription`.** Uma
   inscrição expirada (404/410) é removida de `Subscription` no mesmo
   disparo que gera o `Delivery` de status `EXPIRED` — se houvesse FK com
   `onDelete: Cascade`, o histórico de entrega desapareceria junto com a
   inscrição removida, destruindo exatamente o dado que esta feature existe
   para guardar.
5. **Status em string de código, não enum do Postgres** — mesma decisão (e
   mesmo motivo) do bt-pro, GOLDEN_RULES §6 lá: adicionar um status novo
   (ex.: um futuro `RATE_LIMITED`) é mudança de código, não migration. Os
   valores vivem em `notifications.types.ts`, validados em runtime pelos
   paths que os escrevem (nunca por constraint de banco).
6. **`data: Json?` livre** em vez de colunas tipadas — a Notification carrega
   o payload inteiro que o navegador vai receber (além de `title`/`body`),
   incluindo o shape arbitrário que o contrato legado de `/send` aceita
   (ADR-0004). Tipar isso em colunas fixas exigiria um esquema de payload
   que o produto ainda não definiu.

## Consequências

- Uma consulta "quantos dispositivos receberam a notificação X" é
  `Delivery.count({ where: { notificationId, status: 'SENT' } })` — não
  precisa de JOIN com `Subscription`.
- Expandir para notificação por **grupo** de endpoints (não só 1 ou todos)
  exigiria uma tabela de associação nova — fora de escopo aqui, mas o modelo
  não impede.
- `Notification.attempts`/`lastError` cobrem retry simples (ADR-0003); uma
  fila de verdade (BullMQ) reaproveitaria as mesmas tabelas, só mudando quem
  dispara `processOne`.

## Status

accepted
