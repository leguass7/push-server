import pino from "pino";

import type { Env } from "../env/env";

export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">) {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
