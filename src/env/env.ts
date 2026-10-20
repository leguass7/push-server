import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  VAPID_SUBJECT: z.string().min(1, "VAPID_SUBJECT é obrigatória (mailto: ou https://)"),
  VAPID_PUBLIC_KEY: z.string().min(1, "VAPID_PUBLIC_KEY é obrigatória"),
  VAPID_PRIVATE_KEY: z.string().min(1, "VAPID_PRIVATE_KEY é obrigatória"),
  /** Vazio = autenticação desligada. Ver docs/adr/0004-compatibilidade-com-bt-pro.md. */
  API_TOKEN: z.string().optional().default(""),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  DISPATCH_BATCH_SIZE: z.coerce.number().int().positive().default(20),
  MAX_SEND_ATTEMPTS: z.coerce.number().int().positive().default(3),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Lida uma única vez, no boot. Falha rápido (process.exit) em vez de deixar o
 * serviço subir com uma config inválida e falhar de forma obscura no primeiro
 * request — preferível em um microsserviço pequeno a um sistema de erro
 * "amigável" que ninguém vai ler em produção.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error("[env] configuração inválida:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
