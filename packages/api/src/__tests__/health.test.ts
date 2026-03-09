import { describe, it, expect } from "vitest";
import { createCallerFactory } from "../trpc";
import { appRouter } from "../root";

const createCaller = createCallerFactory(appRouter);

describe("healthRouter", () => {
  it("retorna status ok", async () => {
    const caller = createCaller({ user: null, tenantId: null });
    const result = await caller.health.check();

    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.1.0");
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
