## Build: instala com devDeps, gera o Prisma Client, emite só o JS de produção.
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

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
## `COPY src` não traz `src/generated` (está no .dockerignore) — gera de novo
## em cima do schema e emite JS sem source maps nem testes.
RUN pnpm exec prisma generate \
 && pnpm exec tsc -p tsconfig.build.json \
 && pnpm prune --prod --ignore-scripts \
 && rm -rf \
      node_modules/prisma \
      node_modules/typescript \
      node_modules/.pnpm/prisma@* \
      node_modules/.pnpm/typescript@* \
      node_modules/.pnpm/@prisma+studio-core@* \
      node_modules/.pnpm/@prisma+dev@* \
      node_modules/.pnpm/@electric-sql+pglite@* \
      node_modules/.pnpm/react@* \
      node_modules/.pnpm/react-dom@* \
      node_modules/.pnpm/@types+react@* \
      node_modules/.pnpm/elkjs@*

## Runtime: só o que o `node dist/main.js` precisa. Usuário `node` da imagem.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
