import { Test } from "@nestjs/testing";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AuthGuard } from "./common/auth.guard";
import { NotFoundController } from "./common/not-found.controller";
import { ENV, LOGGER } from "./core/core.module";
import { HealthController } from "./features/health/health.controller";
import { SubscriptionsController } from "./features/subscriptions/subscriptions.controller";
import { SubscriptionsService } from "./features/subscriptions/subscriptions.service";
import { VapidController } from "./features/vapid/vapid.controller";

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function createTestApp(
  env: { API_TOKEN: string; VAPID_PUBLIC_KEY: string },
  subscriptionsCount = 2,
): Promise<INestApplication> {
  const fakeSubscriptions = { count: vi.fn().mockResolvedValue(subscriptionsCount), upsert: vi.fn(), remove: vi.fn() };

  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController, VapidController, SubscriptionsController, NotFoundController],
    providers: [
      { provide: ENV, useValue: env },
      { provide: LOGGER, useValue: fakeLogger() },
      { provide: SubscriptionsService, useValue: fakeSubscriptions },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe("GET /health", () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it("responde com a contagem de subscriptions, sem exigir auth", async () => {
    app = await createTestApp({ API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, subscriptions: 2 });
  });
});

describe("auth (API_TOKEN configurado)", () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it("rejeita sem Authorization", async () => {
    app = await createTestApp({ API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).get("/vapid-public-key");

    expect(response.status).toBe(401);
  });

  it("aceita com Bearer correto", async () => {
    app = await createTestApp({ API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).get("/vapid-public-key").set("Authorization", "Bearer segredo");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: "pub" });
  });
});

describe("auth desligada (API_TOKEN vazio)", () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it("permite sem Authorization — contrato legado do bt-pro (ADR-0004)", async () => {
    app = await createTestApp({ API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).get("/vapid-public-key");

    expect(response.status).toBe(200);
  });
});

describe("validação de request", () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it("POST /subscribe sem keys válidas retorna 400", async () => {
    app = await createTestApp({ API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).post("/subscribe").send({ endpoint: "https://push.example/a" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");
  });

  it("rota inexistente retorna 404", async () => {
    app = await createTestApp({ API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" });

    const response = await request(app.getHttpServer()).get("/rota-que-nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });
});
