# backups/

Dump local das inscrições do push-server legado (volume Swarm
`push-server_push-server-data` em `compute03`).

`legacy-subscriptions.json` está no `.gitignore` — o repositório é público
e o arquivo contém endpoints/chaves de dispositivo. Fica só nesta máquina
para não perder o opt-in no cutover.

Formato: mapa `endpoint → { endpoint, keys.p256dh, keys.auth }`, o mesmo
shape de `PushSubscription.toJSON()` que `POST /subscribe` já aceita.
