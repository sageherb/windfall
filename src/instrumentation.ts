// instrumentation.ts
// [demo-mock] Boot msw/node so that:
//   1) SSR fetches in src/shared/api/server.ts (which build absolute
//      fake-host URLs like https://demo-disabled.local/api/v1/...) are
//      intercepted and answered from in-memory mocks.
//   2) /api/proxy/[...path]/route.ts's demo dispatch — which also calls
//      globalThis.fetch on the fake-host URL — is intercepted on the
//      same Node runtime by the same msw/node instance.
//
// Failures are NOT swallowed: a silent register() failure was previously
// hiding "msw/node never started" cases, leaving SSR to hit real DNS and
// throw inside Server Components.

export async function register() {
  const isEdge = typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";
  // msw/node only runs on Node, not on the Edge runtime that middleware uses.
  if (isEdge) return;

  const { IS_DEMO } = await import("@/mocks/demo-flag");
  if (!IS_DEMO) return;

  // turbopackIgnore: tells Turbopack not to follow this dynamic import
  // statically — it would otherwise try to bundle msw/node into the edge
  // runtime where @mswjs/interceptors can't resolve.
  const mod = await import(/* turbopackIgnore: true */ "./mocks/node");
  (mod as { server: { listen: (opts: { onUnhandledRequest: string }) => void } }).server.listen({
    onUnhandledRequest: "bypass",
  });
  // eslint-disable-next-line no-console
  console.log("[demo-mock-srv] msw/node server.listen OK");
}
