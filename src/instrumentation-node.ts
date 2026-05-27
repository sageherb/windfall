// instrumentation-node.ts
// [demo-mock] Node-runtime-only side of the instrumentation hook.
// Patches globalThis.fetch so any request to the fake demo backend
// (https://demo-disabled.local/...) OR any /api/v1/* URL is answered
// from in-memory MSW handlers via the in-process dispatcher.
//
// This replaces msw/node's setupServer().listen() — that path required
// @mswjs/interceptors, whose Turbopack dynamic-import chunking was
// unreliable on Vercel serverless cold starts and produced
// ERR_MODULE_NOT_FOUND for every SSR page.

import { IS_DEMO } from "@/mocks/demo-flag";
import { dispatchMockRequest } from "@/mocks/dispatcher";

if (IS_DEMO) {
  const realFetch = globalThis.fetch.bind(globalThis);

  const isMockTarget = (url: string): boolean =>
    url.includes("demo-disabled.local") || /\/api\/v1\//.test(url);

  const toUrl = (input: RequestInfo | URL): string => {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return input.url;
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = toUrl(input);
    if (!isMockTarget(url)) {
      return realFetch(input, init);
    }

    const request = input instanceof Request ? input.clone() : new Request(input, init);
    const response = await dispatchMockRequest(request);
    if (response) return response;

    return new Response(
      JSON.stringify({
        code: 404,
        status: "NOT_FOUND",
        message: `demo: unhandled ${new URL(url).pathname}`,
        data: null,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  // eslint-disable-next-line no-console
  console.log("[demo-mock-srv] globalThis.fetch patched (in-process dispatch)");
}
