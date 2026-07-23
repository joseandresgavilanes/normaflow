import { expect, test } from "@playwright/test";
import { logger } from "@/lib/logger";

function capture(fn: () => void): string[] {
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  const shim = process.stdout as unknown as { write: (chunk: unknown) => boolean };
  shim.write = (chunk: unknown) => { lines.push(String(chunk)); return true; };
  try { fn(); } finally { shim.write = orig as unknown as (chunk: unknown) => boolean; }
  return lines.map((l) => l.trim()).filter(Boolean);
}

test.describe("observabilidad · logger estructurado", () => {
  test("emite JSON con campos base", () => {
    const [line] = capture(() => logger.info("test.event", { count: 3 }));
    const rec = JSON.parse(line);
    expect(rec).toMatchObject({ level: "info", service: "normaflow", event: "test.event", count: 3 });
    expect(typeof rec.ts).toBe("string");
    expect(typeof rec.env).toBe("string");
  });

  test("redacta secretos de forma recursiva", () => {
    const [line] = capture(() => logger.info("secret.event", { password: "hunter2", nested: { token: "abc", ok: 1 }, apiKey: "x", plain: "visible" }));
    const rec = JSON.parse(line);
    expect(rec.password).toBe("[redacted]");
    expect(rec.apiKey).toBe("[redacted]");
    expect(rec.nested.token).toBe("[redacted]");
    expect(rec.nested.ok).toBe(1);
    expect(rec.plain).toBe("visible");
  });

  test("child logger fusiona contexto persistente", () => {
    const child = logger.child({ requestId: "req-1", organizationId: "org-1" });
    const [line] = capture(() => child.info("scoped.event"));
    const rec = JSON.parse(line);
    expect(rec).toMatchObject({ requestId: "req-1", organizationId: "org-1", event: "scoped.event" });
  });
});
