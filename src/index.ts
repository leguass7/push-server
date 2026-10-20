import "dotenv/config";

import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env/env.js";
import { createScheduler } from "./features/scheduler/scheduler.js";
import { createLogger } from "./lib/logger.js";

const env = loadEnv();
const logger = createLogger(env);
const container = createContainer(env, logger);

const app = createApp(container, env, logger);
const scheduler = createScheduler({
  notifications: container.notifications,
  logger,
  intervalMs: env.POLL_INTERVAL_MS,
  batchSize: env.DISPATCH_BATCH_SIZE,
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "push_server_listening");
  scheduler.start();
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting_down");
  scheduler.stop();
  server.close();
  await container.prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
