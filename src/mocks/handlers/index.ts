import { http, HttpResponse, type RequestHandler } from "msw";

import { auctionHandlers } from "./auctions";
import { authHandlers } from "./auth";
import { chatHandlers } from "./chat";
import { imageHandlers } from "./images";
import { miscHandlers } from "./misc";
import { notificationHandlers } from "./notifications";
import { purchaseHandlers } from "./purchases";
import { reviewHandlers } from "./reviews";
import { userHandlers } from "./users";

// [demo-mock] The client codebase fetches `/api/proxy/api/v1/...` (browser,
// same-origin) and server.ts fetches `${API_URL}/api/v1/...` (msw/node).
// Handlers are authored as path-only `/api/v1/...` for readability, so we
// auto-expand every path-only handler under the two prefixes the app
// actually uses, sharing the same resolver. SockJS / catch-all handlers
// stay untouched because their paths aren't `/api/v1`-shaped.
const ABSOLUTE_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const PROXY_PREFIX = "/api/proxy";

function withDemoFallbacks(handlers: RequestHandler[]): RequestHandler[] {
  return handlers.flatMap((h) => {
    const { info } = h as unknown as { info?: { method?: string; path?: unknown } };
    const { resolver } = h as unknown as { resolver?: unknown };
    const path = info?.path;
    const method = typeof info?.method === "string" ? info.method.toLowerCase() : null;
    if (!method || typeof path !== "string" || !path.startsWith("/") || !resolver) {
      return [h];
    }
    const fn = (http as unknown as Record<string, unknown>)[method];
    if (typeof fn !== "function") return [h];
    const make = (p: string) => (fn as (path: string, r: unknown) => RequestHandler)(p, resolver);
    const variants: RequestHandler[] = [h, make(`${PROXY_PREFIX}${path}`)];
    if (ABSOLUTE_BASE) {
      variants.push(make(`${ABSOLUTE_BASE}${path}`));
      variants.push(make(`${ABSOLUTE_BASE}${PROXY_PREFIX}${path}`));
    }
    return variants;
  });
}

// SockJS pre-flight info request before WebSocket upgrade.
// Returns "websocket disabled" so SockJS falls back / disconnects quietly
// instead of attempting `passthrough` against the unreachable dummy API URL.
const sockjsInfoStub = http.get("*/ws-stomp*/info*", () =>
  HttpResponse.json({
    websocket: false,
    origins: ["*:*"],
    cookie_needed: false,
    entropy: 0,
  })
);

// SockJS transport polling URLs (e.g. /702/<session>/xhr_streaming, /jsonp).
// Refuse them quickly so the client gives up rather than retrying through
// passthrough against the unreachable dummy API URL.
const sockjsTransportStub = http.all(
  "*/ws-stomp*/*",
  () => new HttpResponse(null, { status: 404 })
);

// Catch-all for any /api/proxy/* request we forgot to mock.
// Without it MSW would `passthrough` to the dummy NEXT_PUBLIC_API_URL and
// surface "Failed to fetch" noise in the console.
const catchAllProxy = http.all("/api/v1/*", ({ request }) => {
  const u = new URL(request.url);

  console.warn("[demo-mock] unhandled", request.method, u.pathname, u.search);
  return HttpResponse.json(
    { code: 404, status: "NOT_FOUND", message: `demo: unhandled ${u.pathname}`, data: null },
    { status: 404 }
  );
});

export const handlers = withDemoFallbacks([
  ...authHandlers,
  ...userHandlers,
  ...auctionHandlers,
  ...notificationHandlers,
  ...chatHandlers,
  ...imageHandlers,
  ...purchaseHandlers,
  ...reviewHandlers,
  ...miscHandlers,
  sockjsInfoStub,
  sockjsTransportStub,
  catchAllProxy,
]);
