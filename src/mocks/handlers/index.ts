import { http, HttpResponse } from "msw";

import { auctionHandlers } from "./auctions";
import { authHandlers } from "./auth";
import { chatHandlers } from "./chat";
import { imageHandlers } from "./images";
import { miscHandlers } from "./misc";
import { notificationHandlers } from "./notifications";
import { purchaseHandlers } from "./purchases";
import { reviewHandlers } from "./reviews";
import { userHandlers } from "./users";

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

export const handlers = [
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
];
