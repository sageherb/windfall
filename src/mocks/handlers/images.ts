import { http, HttpResponse } from "msw";

import type { ApiResponse } from "../types";

function ok<T>(data: T, message = "업로드 완료."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

const PLACEHOLDER_POOL = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800",
];

function pickPlaceholder(): string {
  return PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)];
}

export const imageHandlers = [
  http.post("*/api/v1/auction-images", () =>
    HttpResponse.json(ok({ imageUrl: pickPlaceholder() }))
  ),
  http.post("*/api/v1/chat-images", () =>
    HttpResponse.json(ok({ imageUrls: [pickPlaceholder()] }))
  ),
];
