# ADR-0004 — Compatibilidade com o contrato atual do bt-pro

## Contexto

O bt-pro já integra com o push-server em produção (ADR-0022 do bt-pro),
isolado em `src/features/push/services/push-server-client.ts`. O contrato
hoje é:

| Rota | Contrato |
| --- | --- |
| `GET /vapid-public-key` | `{ publicKey }` |
| `POST /subscribe` | body = `PushSubscription.toJSON()` do browser (`endpoint`, `keys.p256dh`, `keys.auth`) → `201 { ok: true }` |
| `DELETE /subscribe` | body = `{ endpoint }` → `200 { ok: true }` sempre (idempotente — nunca 404) |
| `POST /send` | body = `{ endpoint?, payload }` → `{ sent, failed }` |

Nenhuma dessas chamadas envia header de autenticação. Este projeto **não**
pode simplesmente substituir o serviço em produção sem manter esse contrato
— senão quebra o opt-in de push do bt-pro no mesmo deploy.

## Decisão

1. **O contrato legado é preservado byte a byte** nas 4 rotas acima — ver
   `subscriptions.routes.ts` e o handler de `/send` em
   `notifications.routes.ts`. Por trás, `/send` agora cria uma `Notification`
   + `Delivery`s (ADR-0002) em vez de só despachar e esquecer, mas a resposta
   HTTP é idêntica.
2. **Autenticação por token compartilhado é opt-in**, não obrigatória desde
   o dia 1: `API_TOKEN` vazio (default) desliga a checagem inteira — mesmo
   padrão que `PUSH_SERVER_URL` ausente já usa no lado do bt-pro
   (`isPushConfigured()`). Isso permite deployar este serviço no lugar do
   atual **sem** precisar coordenar um deploy simultâneo do bt-pro.
3. **`GET /health` fica fora da auth mesmo quando `API_TOKEN` está setado**
   — é o endpoint que o healthcheck do Docker/Swarm bate, sem header nenhum;
   exigir auth ali derrubaria o container por engano a cada deploy.
4. **Plano de ativação da auth** (quando quiser fechar o endpoint de verdade):
   1. Definir `API_TOKEN` neste serviço.
   2. Atualizar `push-server-client.ts` no bt-pro para enviar
      `Authorization: Bearer ${process.env.PUSH_SERVER_TOKEN}` em toda
      chamada `fetch`.
   3. Deployar o bt-pro **antes** de reiniciar este serviço com o token
      setado (ou vice-versa só é seguro com `API_TOKEN` ainda vazio) — a
      ordem importa porque não há uma janela de "aceita os dois" aqui; se
      quiser essa janela, dá para o middleware aceitar uma lista de tokens
      válidos em vez de um único.
   Esse passo 2 é uma mudança no **repositório do bt-pro**, não deste
   projeto — fica registrado aqui só para não se perder.

## Consequências

- Os novos endpoints (`POST /notifications`, `GET /notifications`,
  `GET /notifications/:id`, `DELETE /notifications/:id`) **já nascem**
  atrás da auth (quando `API_TOKEN` está setado) — só o contrato legado
  tem esse cuidado extra de compatibilidade.
- Enquanto `API_TOKEN` estiver vazio, qualquer um com acesso à rede onde
  este serviço escuta pode ler/cancelar notificações agendadas de qualquer
  pessoa. Aceitável para a infra PW2C (rede privada via WireGuard — ver
  memória de infra), mas é o primeiro item a resolver antes de expor este
  serviço a uma rede menos confiável.
- `push-server.pw2c.s4sbr.com` (URL de produção atual, lido em
  `PUSH_SERVER_URL` no bt-pro) pode continuar sendo o mesmo domínio depois
  do deploy deste serviço — é o contrato, não a URL, que muda.

## Status

accepted
