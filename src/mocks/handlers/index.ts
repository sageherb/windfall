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

// [demo-mock] msw/node only sees server-side fetches that hit
// `${API_URL}/api/v1/...` (absolute URLs). Path-only handler patterns like
// `/api/v1/auctions/:id` do not match those absolute URLs, so SSR pages
// would throw and surface as "Server Components render" errors. We mirror
// every path-only handler at the absolute URL prefix so msw/node can match
// too. The browser worker still matches the original same-origin path-only
// pattern, so client fetches keep working.
const ABSOLUTE_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function withAbsoluteFallback(handlers: RequestHandler[]): RequestHandler[] {
  if (!ABSOLUTE_BASE) return handlers;
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
    return [
      h,
      (fn as (p: string, r: unknown) => RequestHandler)(`${ABSOLUTE_BASE}${path}`, resolver),
    ];
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

export const handlers = withAbsoluteFallback([
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
