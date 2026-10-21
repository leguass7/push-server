import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const fallbackDatabaseUrl = 'postgresql://pushserver:pushserver_dev@localhost:5433/push_server?schema=public';

/** Prisma 7: usado pelo Migrate/Studio (CLI). O runtime do app usa o adapter em src/lib/prisma.ts. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
