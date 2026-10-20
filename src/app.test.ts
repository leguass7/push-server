import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { Container } from "./container.js";
import type { Logger } from "./lib/logger.js";

// pino-http precisa de um pino.Logger real (usa `.child()` internamente) —
// um objeto fake com só info/warn/error quebra em runtime, não em typecheck.
function fakeLogger(): Logger {
  return pino({ level: "silent" });
}

function fakeContainer(overrides: Partial<Container> = {}): Container {
  return {
    prisma: {} as Container["prisma"],
    subscriptions: { count: vi.fn().mockResolvedValue(2) } as unknown as Container["subscriptions"],
    dispatch: {} as Container["dispatch"],
    notifications: {} as Container["notifications"],
    ...overrides,
  };
}

describe("GET /health", () => {
  it("responde com a contagem de subscriptions, sem exigir auth", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, subscriptions: 2 });
  });
});

describe("auth (API_TOKEN configurado)", () => {
  it("rejeita sem Authorization", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).get("/vapid-public-key");

    expect(response.status).toBe(401);
  });

  it("aceita com Bearer correto", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "segredo", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).get("/vapid-public-key").set("Authorization", "Bearer segredo");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: "pub" });
  });
});

describe("auth desligada (API_TOKEN vazio)", () => {
  it("permite sem Authorization — contrato legado do bt-pro (ADR-0004)", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).get("/vapid-public-key");

    expect(response.status).toBe(200);
  });
});

describe("validação de request", () => {
  it("POST /subscribe sem keys válidas retorna 400", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).post("/subscribe").send({ endpoint: "https://push.example/a" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");
  });

  it("rota inexistente retorna 404", async () => {
    const app = createApp(fakeContainer(), { API_TOKEN: "", VAPID_PUBLIC_KEY: "pub" }, fakeLogger());

    const response = await request(app).get("/rota-que-nao-existe");

    expect(response.status).toBe(404);
  });
});
