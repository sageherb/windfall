// instrumentation-client.ts
// [demo-mock] MSW browser bootstrap + auth cookie injection + boundary scheduler.
// Next.js runs this file's top-level code on the client; no exported function is invoked.

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log(
    "[demo-mock] instrumentation-client top-level run. NEXT_PUBLIC_DEMO=",
    process.env.NEXT_PUBLIC_DEMO,
  );
  if (process.env.NEXT_PUBLIC_DEMO !== "true") return;
  if (typeof window === "undefined") return;

  document.cookie = "userId=1; path=/; SameSite=Lax";
  document.cookie = "accessToken=demo-access-token; path=/; SameSite=Lax";
  document.cookie = "refreshToken=demo-refresh-token; path=/; SameSite=Lax";

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
  // eslint-disable-next-line no-console
  console.log("[demo-mock] msw/browser worker.start() OK");

  const { startSseBoundaryScheduler } = await import("@/mocks/time/scheduler");
  startSseBoundaryScheduler();
  // eslint-disable-next-line no-console
  console.log("[demo-mock] SSE boundary scheduler started");
}

void bootstrap();
