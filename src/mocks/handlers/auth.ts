// src/mocks/handlers/auth.ts
import { http, HttpResponse } from "msw";

import { getStore } from "../store";

import type { ApiResponse } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

export const authHandlers = [
  // GET /api/v1/auth/basic — current user info
  http.get("/api/v1/auth/basic", () => {
    const s = getStore();
    return HttpResponse.json(
      ok({
        userEmail: s.currentUser.userEmail,
        username: s.currentUser.username,
        userProfileUrl: s.currentUser.userProfileUrl,
      })
    );
  }),

  // GET /api/v1/auth/validate-tokens — always success
  http.get("/api/v1/auth/validate-tokens", () => HttpResponse.json(ok({ valid: true }))),

  // GET /api/v1/auth?provider=... — OAuth init (returns a mock redirect URL)
  http.get("/api/v1/auth", ({ request }) => {
    const provider = new URL(request.url).searchParams.get("provider") ?? "demo";
    return HttpResponse.json(
      ok({
        provider,
        redirectUrl: `/api/v1/auth/callback/${provider}`,
      })
    );
  }),

  // OAuth callbacks — never used in demo (cookies already injected)
  http.get("/api/v1/auth/callback/:provider", ({ params }) => {
    const s = getStore();
    return HttpResponse.json(
      ok({
        userId: s.currentUser.userId,
        accessToken: "demo-access-token",
        refreshToken: "demo-refresh-token",
        provider: params.provider,
      })
    );
  }),
];
