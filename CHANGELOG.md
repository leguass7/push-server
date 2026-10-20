# Changelog

## 0.1.0

- Primeira versão: projeto TypeScript (Express + Prisma/PostgreSQL)
  para substituir o push-server ad-hoc da infra PW2C (cutover da stack
  ainda pendente — `docs/ROADMAP.md`).
- Contrato legado preservado (`/vapid-public-key`, `/subscribe`, `/send` —
  ADR-0004), para não quebrar a integração já em produção do bt-pro.
- Novo: agendamento (`POST /notifications` com `scheduledAt`) e rastreio de
  entrega por dispositivo (`Delivery` — ADR-0002), via scheduler por
  polling com retry simples (ADR-0003).
