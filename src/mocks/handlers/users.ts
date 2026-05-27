// src/mocks/handlers/users.ts
import { http, HttpResponse } from "msw";

import { getStore } from "../store";
import { computeCurrentPrice, computeDiscountRate } from "../time/price";

import type { ApiResponse, SliceResponse, AuctionRecord } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

function projectAuctionCard(a: AuctionRecord, now: number, isLiked: boolean) {
  const currentPrice = computeCurrentPrice(a, now);
  const discountPercent = computeDiscountRate(a.startPrice, currentPrice);
  return {
    auctionId: a.auctionId,
    title: a.title,
    auctionImageUrl: a.imageUrls[0],
    imageUrl: a.imageUrls[0],
    startPrice: a.startPrice,
    currentPrice,
    endPrice: a.status === "COMPLETED" ? currentPrice : undefined,
    discountPercent,
    discountRate: discountPercent,
    isLiked,
    startedAt: a.startedAt,
    status: a.status,
  };
}

function slice<T>(items: T[], page: number, size: number): SliceResponse<T> {
  const start = page * size;
  const end = start + size;
  const cut = items.slice(start, end);
  return {
    slice: cut,
    hasNext: end < items.length,
    page,
    size,
    timeStamp: new Date().toISOString(),
  };
}

export const userHandlers = [
  // GET /api/v1/users/:userId
  http.get("/api/v1/users/:userId", ({ params }) => {
    const s = getStore();
    const id = Number(params.userId);
    const user = s.users.get(id) ?? s.currentUser;
    return HttpResponse.json(
      ok({
        userId: user.userId,
        username: user.username,
        email: user.userEmail,
        profileImage: user.userProfileUrl,
        rating: user.rating,
        totalReviews: user.totalReviews,
        isOwner: user.userId === s.currentUser.userId,
      })
    );
  }),

  // PUT /api/v1/users/names
  http.put("/api/v1/users/names", async ({ request }) => {
    const body = (await request.json()) as { username?: string };
    const s = getStore();
    if (body.username) s.currentUser.username = body.username;
    return HttpResponse.json(ok(null, "이름이 변경되었습니다."));
  }),

  // PUT /api/v1/users/images
  http.put("/api/v1/users/images", () => {
    const s = getStore();
    s.currentUser.userProfileUrl = `https://images.unsplash.com/photo-1521119989659-a83eee488004?w=200&h=200&fit=crop&t=${Date.now()}`;
    return HttpResponse.json(ok({ profileImage: s.currentUser.userProfileUrl }));
  }),

  // GET /api/v1/users/:userId/sales
  http.get("/api/v1/users/:userId/sales", ({ params, request }) => {
    const s = getStore();
    const sellerId = Number(params.userId);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 15);
    const now = Date.now();
    const items = [...s.auctions.values()]
      .filter((a) => a.sellerId === sellerId)
      .map((a) => projectAuctionCard(a, now, s.likes.has(a.auctionId)));
    return HttpResponse.json(ok(slice(items, page, size)));
  }),

  // GET /api/v1/users/:userId/reviews — reviews written for this seller
  http.get("/api/v1/users/:userId/reviews", ({ params, request }) => {
    const s = getStore();
    const sellerId = Number(params.userId);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 5);
    const seller = s.users.get(sellerId) ?? s.currentUser;
    const items = s.reviews
      .filter((r) => r.revieweeId === sellerId)
      .map((r) => {
        const reviewer = s.users.get(r.reviewerId);
        const auction = s.auctions.get(r.auctionId);
        return {
          reviewId: r.reviewId,
          auctionId: r.auctionId,
          buyerId: r.reviewerId,
          nickname: reviewer?.username ?? "익명",
          userImageUrl: reviewer?.userProfileUrl ?? "",
          rating: r.rating,
          content: r.content,
          sellerId: seller.userId,
          sellerName: seller.username,
          sellerProfileImage: seller.userProfileUrl,
          auctionImageUrl: auction?.imageUrls[0] ?? "",
          auctionTitle: auction?.title ?? "경매",
          reviewedAt: r.createdAt,
        };
      });
    return HttpResponse.json(ok(slice(items, page, size)));
  }),

  // GET /api/v1/me/likes
  http.get("/api/v1/me/likes", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 15);
    const now = Date.now();
    const items = [...s.likes]
      .map((id) => s.auctions.get(id)!)
      .filter(Boolean)
      .map((a) => projectAuctionCard(a, now, true));
    return HttpResponse.json(ok(slice(items, page, size)));
  }),

  // GET /api/v1/me/recentviews
  http.get("/api/v1/me/recentviews", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 15);
    const now = Date.now();
    const items = s.recentViews
      .map((id) => s.auctions.get(id)!)
      .filter(Boolean)
      .map((a) => projectAuctionCard(a, now, s.likes.has(a.auctionId)));
    return HttpResponse.json(ok(slice(items, page, size)));
  }),

  // POST /api/v1/recentview/:auctionId
  http.post("/api/v1/recentview/:auctionId", ({ params }) => {
    const s = getStore();
    const id = Number(params.auctionId);
    s.recentViews = [id, ...s.recentViews.filter((x) => x !== id)].slice(0, 30);
    return HttpResponse.json(ok(null));
  }),

  // DELETE /api/v1/recentview/:auctionId
  http.delete("/api/v1/recentview/:auctionId", ({ params }) => {
    const s = getStore();
    const id = Number(params.auctionId);
    s.recentViews = s.recentViews.filter((x) => x !== id);
    return HttpResponse.json(ok(null));
  }),

  // GET /api/v1/me/notifications — paginated list of auctions the user has
  // notification-subscribed to (used by NotificationPreferenceList).
  http.get("/api/v1/me/notifications", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 5);
    const now = Date.now();
    const items = [...s.notificationSubs]
      .map((id) => s.auctions.get(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .map((a) => {
        const currentPrice = computeCurrentPrice(a, now);
        const discountPercent = computeDiscountRate(a.startPrice, currentPrice);
        return {
          status: a.status,
          auctionId: a.auctionId,
          title: a.title,
          auctionImageUrl: a.imageUrls[0],
          startPrice: a.startPrice,
          currentPrice,
          endPrice: a.status === "COMPLETED" ? currentPrice : undefined,
          discountPercent,
          startedAt: a.startedAt,
          notificationInfo: {
            alertStart: true,
            alertEnd: false,
            alertPrice: false,
            triggerPrice: 0,
          },
        };
      });
    return HttpResponse.json(ok(slice(items, page, size)));
  }),
];
