// instrumentation-client.ts
// [demo-mock] MSW browser bootstrap + auth cookie injection + boundary scheduler.
// Uses top-level await so module evaluation blocks until the service worker is
// active. Without this, useUserBasic and other early fetches race with
// worker.start() and slip through to the dummy backend.

import { IS_DEMO } from "@/mocks/demo-flag";

if (IS_DEMO && typeof window !== "undefined") {
  // Synchronously gate all window.fetch calls behind a workerReady promise.
  // Next.js 16's instrumentation-client only guarantees that its sync prefix
  // runs before the app bundle; the top-level await below does NOT block
  // React Query mounts, so without this patch the very first useQuery fires
  // a request before MSW can intercept it.
  const realFetch = window.fetch.bind(window);
  let releaseWorkerReady: () => void = () => {};
  const workerReady = new Promise<void>((resolve) => {
    releaseWorkerReady = resolve;
  });
  window.fetch = (...args: Parameters<typeof fetch>) => workerReady.then(() => realFetch(...args));

  document.cookie = "userId=1; path=/; SameSite=Lax";
  document.cookie = "accessToken=demo-access-token; path=/; SameSite=Lax";
  document.cookie = "refreshToken=demo-refresh-token; path=/; SameSite=Lax";

  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });

  // The SW can be "active" but not yet "controller" of the current page.
  // Without a controller, fetches bypass MSW and hit the real network —
  // which in demo mode rewrites to a fake backend and 502s.
  const RELOAD_FLAG = "__msw_demo_reloaded__";

  if (!navigator.serviceWorker.controller) {
    // Wait briefly for the SW to claim this page.
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true,
      });
      setTimeout(resolve, 1500);
    });
  }

  if (!navigator.serviceWorker.controller) {
    if (!sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      // eslint-disable-next-line no-console
      console.log("[demo-mock] no controller after start — reloading once");
      window.location.reload();
      // Stop module evaluation so React never mounts before reload, which
      // otherwise lets React Query fire real fetches through the unmocked
      // network and 502 on the rewritten backend.
      await new Promise(() => {});
    }
  } else {
    // Successful controller — clear the flag so future deploys (with a new
    // SW that may need one reload again) can repeat the dance.
    sessionStorage.removeItem(RELOAD_FLAG);
  }

  // Release any fetches queued during init now that MSW is intercepting.
  releaseWorkerReady();

  // eslint-disable-next-line no-console
  console.log(
    "[demo-mock] msw/browser worker.start() OK. controller=",
    navigator.serviceWorker.controller ? "yes" : "no"
  );

  const { startSseBoundaryScheduler } = await import("@/mocks/time/scheduler");
  startSseBoundaryScheduler();
  // eslint-disable-next-line no-console
  console.log("[demo-mock] SSE boundary scheduler started");
}
