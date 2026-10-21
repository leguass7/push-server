import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Prisma 7 exige um driver adapter explícito (não lê mais `datasource.url`
 * do schema em runtime) — mesmo padrão do bt-pro (src/lib/db.ts).
 *
 * Instanciada como provider do Nest (escopo singleton por padrão — uma
 * única conexão por processo, equivalente ao singleton via `globalThis` da
 * versão Express; aqui o próprio container de DI garante isso).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não está definida");
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
