import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  // [demo-mock] demo 빌드에서는 cookie 검사 없이 통과
  if (process.env.NEXT_PUBLIC_DEMO === "true") return NextResponse.next();

  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: [
    "/auctions/create",
    "/notifications/:path*",
    "/payments/:path*",
    "/user/:path*",
    "/users/:path*",
    "/dm",
    "/dm/:path*",
  ],
};
