import { http, HttpResponse } from "msw";

import { getStore } from "../store";

import type { ApiResponse, ReviewRecord } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

export const reviewHandlers = [
  http.post("*/api/v1/reviews", async ({ request }) => {
    const body = (await request.json()) as Partial<ReviewRecord>;
    const s = getStore();
    const newId = Math.max(0, ...s.reviews.map((r) => r.reviewId)) + 1;
    const newReview: ReviewRecord = {
      reviewId: newId,
      reviewerId: s.currentUser.userId,
      revieweeId: body.revieweeId ?? 0,
      auctionId: body.auctionId ?? 0,
      rating: body.rating ?? 5,
      content: body.content ?? "",
      createdAt: new Date().toISOString(),
    };
    s.reviews.push(newReview);
    return HttpResponse.json(ok({ reviewId: newId }), { status: 201 });
  }),

  http.get("*/api/v1/reviews/:id", ({ params }) => {
    const s = getStore();
    const r = s.reviews.find((x) => x.reviewId === Number(params.id));
    if (!r) {
      return HttpResponse.json(
        { code: 404, status: "NOT_FOUND", message: "리뷰를 찾을 수 없습니다.", data: null },
        { status: 404 }
      );
    }
    return HttpResponse.json(ok(r));
  }),

  http.put("*/api/v1/reviews/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<ReviewRecord>;
    const s = getStore();
    const r = s.reviews.find((x) => x.reviewId === Number(params.id));
    if (r && body.rating !== undefined) r.rating = body.rating;
    if (r && body.content !== undefined) r.content = body.content;
    return HttpResponse.json(ok(r ?? null));
  }),

  http.delete("*/api/v1/reviews/:id", ({ params }) => {
    const s = getStore();
    s.reviews = s.reviews.filter((x) => x.reviewId !== Number(params.id));
    return HttpResponse.json(ok(null));
  }),
];
