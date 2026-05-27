// instrumentation.ts
// [demo-mock] MSW server bootstrap for SSR fetch interception
export async function register() {
  const isEdge = typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";
  // eslint-disable-next-line no-console
  console.log(
    "[demo-mock-srv] register entered. runtime=",
    process.env.NEXT_RUNTIME,
    "edge?",
    isEdge
  );
  try {
    const { IS_DEMO } = await import("@/mocks/demo-flag");
    if (!IS_DEMO) return;
    // msw/node requires node: modules — only load in actual Node.js runtime.
    if (isEdge) {
      // eslint-disable-next-line no-console
      console.log("[demo-mock-srv] edge runtime — skipping msw/node");
      return;
    }
    const { server } = await import("@/mocks/node");
    server.listen({ onUnhandledRequest: "bypass" });
    // eslint-disable-next-line no-console
    console.log("[demo-mock-srv] msw/node server.listen OK");
  } catch (e) {
    console.error("[demo-mock-srv] register failed:", e);
  }
}
