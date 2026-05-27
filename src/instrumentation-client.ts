// instrumentation-client.ts
// [demo-mock] MSW browser bootstrap + auth cookie injection + boundary scheduler.
// Uses top-level await so module evaluation blocks until the service worker is
// active. Without this, useUserBasic and other early fetches race with
// worker.start() and slip through to the dummy backend.

import { IS_DEMO } from "@/mocks/demo-flag";

if (IS_DEMO && typeof window !== "undefined") {
  document.cookie = "userId=1; path=/; SameSite=Lax";
  document.cookie = "accessToken=demo-access-token; path=/; SameSite=Lax";
  document.cookie = "refreshToken=demo-refresh-token; path=/; SameSite=Lax";

  const RELOAD_FLAG = "__msw_demo_reloaded__";
  const firstInstall = !navigator.serviceWorker.controller;

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  // eslint-disable-next-line no-console
  console.log("[demo-mock] msw/browser worker.start() OK");

  // Service worker doesn't claim already-loaded clients on first install,
  // so the first navigation slips through to the dummy backend. Trigger a
  // one-time reload so the worker controls this page.
  if (firstInstall && !sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  }

  const { startSseBoundaryScheduler } = await import("@/mocks/time/scheduler");
  startSseBoundaryScheduler();
  // eslint-disable-next-line no-console
  console.log("[demo-mock] SSE boundary scheduler started");
}
