import { describe, expect, it, vi } from "vitest";

import { loadEnv } from "./env.js";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
  VAPID_SUBJECT: "mailto:admin@example.com",
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
};

describe("loadEnv", () => {
  it("aplica defaults quando opcionais são omitidos", () => {
    const env = loadEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.API_TOKEN).toBe("");
    expect(env.POLL_INTERVAL_MS).toBe(30_000);
    expect(env.MAX_SEND_ATTEMPTS).toBe(3);
  });

  it("faz coerce de PORT/POLL_INTERVAL_MS vindos de string (process.env é sempre string)", () => {
    const env = loadEnv({ ...validEnv, PORT: "4000", POLL_INTERVAL_MS: "5000" });

    expect(env.PORT).toBe(4000);
    expect(env.POLL_INTERVAL_MS).toBe(5000);
  });

  it("encerra o processo quando falta uma variável obrigatória", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({ DATABASE_URL: "" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
