// instrumentation-client.ts
// [demo-mock] Client bootstrap for demo mode.
//
// Architecture: in demo mode, /api/proxy/[...path]/route.ts is the SINGLE
// authoritative dispatcher. It internally calls globalThis.fetch on the
// fake-host URL, which msw/node (booted by instrumentation.ts) intercepts.
// That means we do NOT need a browser MSW service worker at all — and
// removing it kills the SW activation race that was producing intermittent
// 502/503s.
//
// Two things still need to happen on the client before React mounts:
//   1) Inject demo auth cookies so protected routes don't redirect to login.
//   2) Defensive window.fetch patch — any code path that builds a fake-host
//      URL directly (e.g. NEXT_PUBLIC_API_URL-based fetches outside the
//      blessed /api/proxy client) gets rewritten to the same-origin proxy.
//      Required as belt-and-suspenders; the SockJS WS code is not affected
//      because it uses XHR/WebSocket, not fetch.

import { IS_DEMO } from "@/mocks/demo-flag";

const FAKE_HOST = "https://demo-disabled.local";

if (IS_DEMO && typeof window !== "undefined") {
  document.cookie = "userId=1; path=/; SameSite=Lax";
  document.cookie = "accessToken=demo-access-token; path=/; SameSite=Lax";
  document.cookie = "refreshToken=demo-refresh-token; path=/; SameSite=Lax";

  const realFetch = window.fetch.bind(window);
  const rewriteUrl = (urlStr: string): string => {
    if (urlStr.startsWith(FAKE_HOST)) {
      return `/api/proxy${urlStr.slice(FAKE_HOST.length)}`;
    }
    return urlStr;
  };

  window.fetch = (input, init) => {
    if (typeof input === "string") {
      return realFetch(rewriteUrl(input), init);
    }
    if (input instanceof URL) {
      return realFetch(rewriteUrl(input.href), init);
    }
    // Request object — clone with rewritten URL when needed.
    const rewritten = rewriteUrl(input.url);
    if (rewritten === input.url) return realFetch(input, init);
    return realFetch(new Request(rewritten, input), init);
  };

  // eslint-disable-next-line no-console
  console.log("[demo-mock] client bootstrap OK (no service worker, fetch patched)");
}
