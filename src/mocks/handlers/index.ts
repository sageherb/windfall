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

// [demo-mock] The client codebase fetches `/api/proxy/api/v1/...` (browser
// same-origin) and server.ts fetches `${API_URL}/api/v1/...` (msw/node).
// MSW normalizes path-only string handlers through `new URL(path, baseUrl)`
// and then matches with path-to-regexp, which silently fails on some
// hosts/runtimes. RegExp handlers, by contrast, run `regex.exec(url.href)`
// directly — so we add RegExp variants that match the path regardless of
// host. Every path-only handler gets two RegExp siblings: one for the
// raw path, one with the `/api/proxy` prefix the browser uses.
const PROXY_PREFIX = "/api/proxy";

function pathToHostFreeRegex(pattern: string): RegExp {
  const body = pattern
    .split("/")
    .map((seg) => {
      if (!seg) return "";
      if (seg.startsWith(":")) {
        const optional = seg.endsWith("?");
        const name = (optional ? seg.slice(1, -1) : seg.slice(1)).replace(/\W/g, "");
        return optional ? `(?:(?<${name}>[^/?#]+))?` : `(?<${name}>[^/?#]+)`;
      }
      if (seg === "*") return "[^?#]*";
      return seg.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    })
    .join("\\/");
  // Match `body` anchored at a path boundary so a host or `/api/proxy` prefix
  // before it doesn't break matching, and stop at query/hash/end.
  return new RegExp(`${body}(?:\\?|#|$)`);
}

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
    const make = (p: string | RegExp) =>
      (fn as (path: string | RegExp, r: unknown) => RequestHandler)(p, resolver);
    return [
      h,
      make(pathToHostFreeRegex(path)),
      make(pathToHostFreeRegex(`${PROXY_PREFIX}${path}`)),
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
