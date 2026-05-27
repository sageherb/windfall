// instrumentation.ts
// [demo-mock] MSW server bootstrap for SSR fetch interception
export async function register() {
  // eslint-disable-next-line no-console
  console.log(
    "[demo-mock] instrumentation register() called. NEXT_PUBLIC_DEMO=",
    process.env.NEXT_PUBLIC_DEMO,
    "NEXT_RUNTIME=",
    process.env.NEXT_RUNTIME,
  );
  if (process.env.NEXT_PUBLIC_DEMO !== "true") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { server } = await import("@/mocks/node");
    server.listen({ onUnhandledRequest: "bypass" });
    // eslint-disable-next-line no-console
    console.log("[demo-mock] msw/node server.listen() OK");
  }
}
