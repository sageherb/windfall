import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { IS_DEMO } from "@/mocks/demo-flag";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // [demo-mock] demo 빌드: SSR 응답에 인증 쿠키 주입 + /users/me rewrite
  if (IS_DEMO) {
    const existingUserId = request.cookies.get("userId")?.value;
    const demoUserId = existingUserId ?? "1";

    if (pathname.startsWith("/users/me")) {
      const newPath = pathname.replace("/users/me", `/users/${demoUserId}`);
      const res = NextResponse.rewrite(new URL(newPath, request.url));
      if (!existingUserId) {
        res.cookies.set("userId", "1", { path: "/", sameSite: "lax" });
        res.cookies.set("accessToken", "demo-access-token", { path: "/", sameSite: "lax" });
        res.cookies.set("refreshToken", "demo-refresh-token", { path: "/", sameSite: "lax" });
      }
      return res;
    }
    const res = NextResponse.next();
    if (!existingUserId) {
      res.cookies.set("userId", "1", { path: "/", sameSite: "lax" });
      res.cookies.set("accessToken", "demo-access-token", { path: "/", sameSite: "lax" });
      res.cookies.set("refreshToken", "demo-refresh-token", { path: "/", sameSite: "lax" });
    }
    return res;
  }

  const hasAccessToken = request.cookies.has("accessToken");
  const hasRefreshToken = request.cookies.has("refreshToken");
  const userId = request.cookies.get("userId")?.value;

  if (!hasAccessToken && hasRefreshToken) {
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    refreshUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(refreshUrl);
  }

  if (!hasAccessToken && !hasRefreshToken) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/users/me") && userId) {
    const newPath = pathname.replace("/users/me", `/users/${userId}`);
    return NextResponse.rewrite(new URL(newPath, request.url));
  }

  return NextResponse.next();
}

// [demo-mock] matcher expanded so the demo branch can inject auth cookies on
// every navigation (including `/` and `/auctions`). The non-demo branch still
// only runs the cookie check on the listed routes via the early-return logic.
export const config = {
  matcher: ["/((?!_next/|favicon.ico|mockServiceWorker.js).*)"],
};
