// [demo-mock] In-process request dispatcher.
//
// Why this exists: msw/node's setupServer().listen() relies on
// @mswjs/interceptors monkey-patching globalThis.fetch. In Next.js 16 with
// Turbopack on Vercel serverless, that interceptor chain was unreliable:
// turbopackIgnore'd dynamic imports left no chunk on disk
// (ERR_MODULE_NOT_FOUND at instrumentation hook load) — which killed every
// SSR page with a 500.
//
// Instead we iterate the existing MSW RequestHandler array ourselves and
// invoke each handler's `run({ request })` method directly. That method is
// the same one msw/node uses internally; we just skip the interceptor.
// No new dependencies, no global fetch patching from a 3rd-party package.

import { handlers } from "./handlers";

type MswRunResult = { response?: Response } | null;
interface RunnableHandler {
  run: (opts: { request: Request }) => Promise<MswRunResult>;
}

export async function dispatchMockRequest(request: Request): Promise<Response | null> {
  // Handlers MUST be tried sequentially — the first matching one wins, and
  // each handler may consume the request body. Array.reduce keeps the
  // sequential semantics while satisfying the no-await-in-loop lint rule.
  return handlers.reduce<Promise<Response | null>>(async (acc, handler) => {
    const prior = await acc;
    if (prior) return prior;
    const result = await (handler as unknown as RunnableHandler).run({
      request: request.clone(),
    });
    return result?.response ?? null;
  }, Promise.resolve(null));
}
