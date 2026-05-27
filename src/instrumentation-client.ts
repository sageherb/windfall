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

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  // eslint-disable-next-line no-console
  console.log(
    "[demo-mock] msw/browser worker.start() OK. controller=",
    navigator.serviceWorker.controller ? "yes" : "no"
  );

  // If the service worker activated but is not yet controlling this page,
  // wait for the controllerchange event (or a short timeout) then reload
  // once so all subsequent fetches are intercepted.
  const RELOAD_FLAG = "__msw_demo_reloaded__";
  if (!navigator.serviceWorker.controller && !sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    // eslint-disable-next-line no-console
    console.log("[demo-mock] no controller after start — reloading once");
    window.location.reload();
  }

  const { startSseBoundaryScheduler } = await import("@/mocks/time/scheduler");
  startSseBoundaryScheduler();
  // eslint-disable-next-line no-console
  console.log("[demo-mock] SSE boundary scheduler started");
}
