// [demo-mock] Verify withDemoFallbacks actually matches the four URL shapes
// the app uses. Removed from CI by being inside src/mocks/.
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from ".";

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterAll(() => {
  server.close();
});

const ABS = process.env.NEXT_PUBLIC_API_URL ?? "https://demo-disabled.local";

describe("withDemoFallbacks", () => {
  it("registers some handlers", () => {
    expect(handlers.length).toBeGreaterThan(20);
  });

  it("matches path-only /api/v1/users/1 (msw/node fallback)", async () => {
    const res = await fetch("http://localhost/api/v1/users/1");
    expect(res.status).toBe(200);
  });

  it("matches /api/proxy/api/v1/users/1 (browser-shaped)", async () => {
    const res = await fetch("http://localhost/api/proxy/api/v1/users/1");
    expect(res.status).toBe(200);
  });

  it(`matches ${ABS}/api/v1/users/1 (server-shaped)`, async () => {
    const res = await fetch(`${ABS}/api/v1/users/1`);
    expect(res.status).toBe(200);
  });

  it(`matches ${ABS}/api/proxy/api/v1/users/1`, async () => {
    const res = await fetch(`${ABS}/api/proxy/api/v1/users/1`);
    expect(res.status).toBe(200);
  });
});
