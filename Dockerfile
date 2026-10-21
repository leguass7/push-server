## Build
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

## `prisma/` + `prisma.config.ts` + `pnpm-workspace.yaml` precisam estar
## presentes antes do `pnpm install`: o `postinstall` roda `prisma generate`
## (precisa do schema) e o pnpm só libera build scripts de dependências
## nativas (`@prisma/engines`, `esbuild`, `prisma`) se a allowlist do
## workspace já estiver no disco.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

## Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

## `--ignore-scripts`: o `postinstall` (`prisma generate`) precisa da CLI
## `prisma`, que é devDependency — não existe em `--prod`. Não tem problema
## pular: o client já vem gerado do estágio de build, copiado abaixo.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
