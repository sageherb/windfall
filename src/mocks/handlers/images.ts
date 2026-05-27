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

let nextImageId = 1;
function newImage() {
  return { imageId: nextImageId++, imageUrl: pickPlaceholder() };
}

export const imageHandlers = [
  // POST /api/v1/auction-images — accepts a multipart upload of one or more files
  // and returns an array of { imageId, imageUrl }. Frontend reads response.data
  // as that array and maps each entry to .imageId.
  http.post("*/api/v1/auction-images", async ({ request }) => {
    let count = 1;
    try {
      const form = await request.formData();
      const all = [...form.getAll("files"), ...form.getAll("images")].filter(
        (v) => v instanceof File
      );
      if (all.length > 0) count = all.length;
    } catch {
      // not multipart — keep count=1
    }
    return HttpResponse.json(
      ok(
        Array.from({ length: count }, () => newImage()),
        "이미지 업로드 완료."
      )
    );
  }),

  http.post("*/api/v1/chat-images", () => HttpResponse.json(ok([newImage()]))),
];
