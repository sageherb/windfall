// instrumentation.ts
// [demo-mock] Next.js calls register() for every runtime (Node + Edge).
// Node-only code (MSW handlers, fetch patch) lives in instrumentation-node.ts
// and is imported only when NEXT_RUNTIME === "nodejs" — Next's official
// split pattern. This prevents Turbopack from pulling Node-only modules
// (msw, dispatcher) into the Edge bundle where they can't resolve.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
