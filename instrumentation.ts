// instrumentation.ts
// [demo-mock] MSW server bootstrap for SSR fetch interception
export async function register() {
  // eslint-disable-next-line no-console
  console.log("[demo-mock] register() entered. NEXT_RUNTIME=", process.env.NEXT_RUNTIME);
  try {
    const { IS_DEMO } = await import("@/mocks/demo-flag");
    if (!IS_DEMO) {
      // eslint-disable-next-line no-console
      console.log("[demo-mock] IS_DEMO is false — skip");
      return;
    }
    if (process.env.NEXT_RUNTIME !== "nodejs") {
      // eslint-disable-next-line no-console
      console.log("[demo-mock] not nodejs runtime — skip");
      return;
    }
    const { server } = await import("@/mocks/node");
    server.listen({ onUnhandledRequest: "bypass" });
    // eslint-disable-next-line no-console
    console.log("[demo-mock] msw/node server.listen() OK");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[demo-mock] register() failed:", e);
  }
}
