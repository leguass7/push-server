# push-server

Glossário do domínio deste microsserviço de Web Push.

> Documento vivo — termos são adicionados conforme o serviço evolui.

Estado da substituição do serviço em produção:
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Language

**push-server legado**:
A stack Swarm `push-server` que já roda na infra PW2C (serviço
`push-server_push-server`, imagem `node:20-alpine`, `command:` inline).
Guarda inscrições em `subscriptions.json` num volume Docker, sem Postgres.
Este repositório a substitui sem mudar o contrato HTTP (ADR-0004). O
cutover ainda não ocorreu — ver [`docs/ROADMAP.md`](docs/ROADMAP.md).
_Avoid_: tratar o código deste repo como se já estivesse no Swarm; apagar
o volume legado antes de importar as Subscriptions para o Postgres.

**Subscription**:
Uma inscrição de Web Push de **um dispositivo/navegador** — `endpoint`
(identifica o dispositivo no serviço de push do navegador: Chrome, Firefox
etc.) + chaves `p256dh`/`auth` (criptografia ponta a ponta do protocolo).
Chave primária é o próprio `endpoint`. Este serviço **não** sabe quem é a
pessoa por trás — quem associa endpoint↔pessoa é o caller (hoje, o bt-pro).
_Avoid_: tratar Subscription como "usuário"; inventar um `id` sintético para
ela (o `endpoint` já é a identidade natural do protocolo).

**Notification**:
Um pedido de envio — imediato ou agendado — de um título/corpo/dados para um
alvo. O alvo é **um endpoint específico** (`targetEndpoint` preenchido) ou
**broadcast** (`targetEndpoint = null`, todas as Subscriptions ativas no
momento do disparo). Tem um `status` (ver abaixo) e, se agendada,
`scheduledAt` no futuro.
_Avoid_: confundir com `Delivery` (resultado por dispositivo); assumir que
`targetEndpoint = null` significa "sem alvo" (significa "todos").

**Dispatch (disparo)**:
Ato de efetivamente chamar `web-push` para um conjunto de alvos resolvidos a
partir de uma Notification, no momento em que ela é processada (na hora, se
`scheduledAt` já passou, ou pelo scheduler). Produz um `Delivery` por alvo.

**Delivery**:
Resultado do disparo de uma Notification para **um** endpoint específico:
`SENT`, `FAILED` (erro do serviço de push, ex. 500) ou `EXPIRED` (404/410 —
a inscrição não existe mais no navegador). É a resposta a "foi ou não
enviado", por dispositivo. Sobrevive mesmo que a Subscription correspondente
seja removida depois (ver ADR-0002).
_Avoid_: tratar `EXPIRED` como falha para fins de retry (não é algo que
reenviar resolve — a inscrição já não existe).

**Broadcast**:
Disparo de uma Notification para **todas** as Subscriptions ativas no
momento do disparo (`targetEndpoint = null`). "No momento do disparo", não
"no momento da criação" — uma Notification agendada para o futuro inclui
qualquer dispositivo que se inscreveu depois de criada e antes de disparar.

**Scheduler (poller)**:
Processo interno que, a cada `POLL_INTERVAL_MS`, busca Notifications
`PENDING` com `scheduledAt` vencida e as processa (ADR-0003). Não é uma fila
externa (Redis/BullMQ) nesta v1 — é só uma consulta periódica na própria
tabela `Notification`.
_Avoid_: assumir latência sub-segundo — o pior caso é `POLL_INTERVAL_MS`.

**Claim (reivindicação otimista)**:
Passo em que o scheduler (ou a criação com envio imediato) marca uma
Notification como `PROCESSING` via `UPDATE ... WHERE status = 'PENDING'`
antes de processá-la — garante que duas execuções concorrentes não
despachem a mesma Notification duas vezes.

**Status da Notification**: `PENDING` (aguardando disparo ou retry) →
`PROCESSING` (sendo disparada agora) → `SENT` | `PARTIALLY_SENT` | `FAILED`
(terminal, conforme quantos alvos tiveram `Delivery` `SENT`) | `CANCELED`
(cancelada via `DELETE /notifications/:id`, só permitido enquanto `PENDING`).
_Avoid_: cancelar algo que já saiu de `PENDING` (a API recusa com 409).

**API token (opt-in)**:
Segredo compartilhado (`API_TOKEN`) que, quando definido, exige
`Authorization: Bearer <token>` em toda rota exceto `GET /health`. Vazio
(padrão) desliga a checagem — ver ADR-0004 para o porquê de não ser
obrigatório desde o dia 1 (compatibilidade com o bt-pro em produção).
