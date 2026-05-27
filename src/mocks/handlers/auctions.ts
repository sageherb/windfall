// src/mocks/handlers/auctions.ts
import { http, HttpResponse } from "msw";

import { getStore } from "../store";
import { computeCurrentPrice, computeDiscountRate } from "../time/price";

import type { ApiResponse, SliceResponse, AuctionRecord } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

function projectListCard(a: AuctionRecord, now: number, isLiked: boolean, isNotification: boolean) {
  const currentPrice = computeCurrentPrice(a, now);
  return {
    auctionId: a.auctionId,
    imageUrl: a.imageUrls[0],
    title: a.title,
    startPrice: a.startPrice,
    currentPrice,
    discountRate: computeDiscountRate(a.startPrice, currentPrice),
    isLiked,
    startedAt: a.startedAt,
    status: a.status,
    isNotification,
  };
}

function buildHistory(a: AuctionRecord, now: number, limit: number) {
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const start = Date.parse(a.startedAt);
  if (!Number.isFinite(start) || now < start) return [];
  const stepCount = Math.min(limit, Math.floor((now - start) / FIVE_MIN_MS));
  const rows = [];
  for (let i = 1; i <= stepCount; i++) {
    const at = start + i * FIVE_MIN_MS;
    const raw = a.startPrice - i * a.dropAmount;
    const price = Math.max(a.stopLoss, raw);
    rows.push({
      historyId: i,
      currentPrice: price,
      viewerCount: 1,
      createdAt: new Date(at).toISOString(),
    });
    if (price <= a.stopLoss) break;
  }
  return rows.reverse(); // newest first
}

export const auctionHandlers = [
  // GET /api/v1/auctions (main) — popular + process + scheduled
  http.get("*/api/v1/auctions", () => {
    const s = getStore();
    const now = Date.now();
    const project = (id: number) => {
      const a = s.auctions.get(id)!;
      return projectListCard(a, now, s.likes.has(id), s.notificationSubs.has(id));
    };
    return HttpResponse.json(
      ok({
        serverAt: new Date(now).toISOString(),
        popularList: s.popularIds.map(project),
        processList: s.processIds.map(project),
        scheduledList: s.scheduledIds.map((id) => {
          // ScheduledInfo has no currentPrice/discountRate per backend DTO
          const a = s.auctions.get(id)!;
          return {
            auctionId: a.auctionId,
            imageUrl: a.imageUrls[0],
            title: a.title,
            startPrice: a.startPrice,
            isLiked: s.likes.has(id),
            startedAt: a.startedAt,
            isNotification: s.notificationSubs.has(id),
          };
        }),
      })
    );
  }),

  // GET /api/v1/auctions/search
  http.get("*/api/v1/auctions/search", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") ?? "").trim();
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const size = Number(url.searchParams.get("size") ?? 15);
    const sortBy = url.searchParams.get("sortBy") ?? "createDate";
    const sortDirection = url.searchParams.get("sortDirection") ?? "DESC";

    const now = Date.now();
    let items = [...s.auctions.values()];

    if (query)
      items = items.filter((a) => a.title.includes(query) || a.tags.some((t) => t.includes(query)));
    if (category && category !== "ALL") items = items.filter((a) => a.category === category);
    if (status && status !== "ALL") items = items.filter((a) => a.status === status);
    if (minPrice) items = items.filter((a) => a.startPrice >= Number(minPrice));
    if (maxPrice) items = items.filter((a) => a.startPrice <= Number(maxPrice));

    const STATUS_RANK: Record<string, number> = {
      PROCESS: 0,
      SCHEDULED: 1,
      COMPLETED: 2,
      CANCELED: 3,
    };
    items.sort((a, b) => {
      const statusDelta = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      if (statusDelta !== 0) return statusDelta;

      let cmp: number;
      if (sortBy === "startPrice") {
        cmp = a.startPrice - b.startPrice;
      } else if (sortBy === "startedAt") {
        cmp = Date.parse(a.startedAt) - Date.parse(b.startedAt);
      } else {
        cmp = Date.parse(a.createdDate) - Date.parse(b.createdDate);
      }
      return sortDirection === "DESC" ? -cmp : cmp;
    });

    const start = (page - 1) * size;
    const end = start + size;
    const cut = items
      .slice(start, end)
      .map((a) =>
        projectListCard(a, now, s.likes.has(a.auctionId), s.notificationSubs.has(a.auctionId))
      );
    const body: SliceResponse<unknown> = {
      slice: cut,
      hasNext: end < items.length,
      page,
      size,
      timeStamp: new Date().toISOString(),
    };
    return HttpResponse.json(ok(body));
  }),

  // GET /api/v1/auctions/:id
  http.get("*/api/v1/auctions/:id", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    const a = s.auctions.get(id);
    if (!a) {
      return HttpResponse.json(
        { code: 404, status: "NOT_FOUND", message: "경매를 찾을 수 없습니다.", data: null },
        { status: 404 }
      );
    }
    const seller = s.users.get(a.sellerId) ?? s.currentUser;
    const now = Date.now();
    const currentPrice = computeCurrentPrice(a, now);
    return HttpResponse.json(
      ok({
        auctionId: a.auctionId,
        title: a.title,
        description: a.description,
        category: a.category,
        imageUrls: a.imageUrls,
        seller: {
          sellerId: seller.userId,
          username: seller.username,
          profileImageUrl: seller.userProfileUrl,
          rating: seller.rating,
          reviewCount: seller.totalReviews,
        },
        startPrice: a.startPrice,
        dropAmount: a.dropAmount,
        currentPrice,
        stopLoss: a.stopLoss,
        discountRate: computeDiscountRate(a.startPrice, currentPrice),
        status: a.status,
        likeCount: a.likeCount + (s.likes.has(id) ? 1 : 0),
        isLiked: s.likes.has(id),
        viewerCount: 1,
        startedAt: a.startedAt,
        serverTime: new Date(now).toISOString(),
        createdDate: a.createdDate,
        recentPriceHistory: buildHistory(a, now, 10),
        tags: a.tags,
      })
    );
  }),

  // GET /api/v1/auctions/:id/history
  http.get("*/api/v1/auctions/:id/history", ({ params, request }) => {
    const s = getStore();
    const id = Number(params.id);
    const a = s.auctions.get(id);
    if (!a) {
      return HttpResponse.json(
        { code: 404, status: "NOT_FOUND", message: "경매를 찾을 수 없습니다.", data: null },
        { status: 404 }
      );
    }
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const size = Number(url.searchParams.get("size") ?? 10);
    const all = buildHistory(a, Date.now(), 200);
    const start = page * size;
    const end = start + size;
    return HttpResponse.json(
      ok({
        slice: all.slice(start, end),
        hasNext: end < all.length,
        page,
        size,
        timeStamp: new Date().toISOString(),
      })
    );
  }),

  // POST /api/v1/auctions/:id/like  — toggle
  http.post("*/api/v1/auctions/:id/like", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    if (s.likes.has(id)) s.likes.delete(id);
    else s.likes.add(id);
    return HttpResponse.json(ok({ isLiked: s.likes.has(id) }));
  }),
  http.delete("*/api/v1/auctions/:id/like", ({ params }) => {
    const s = getStore();
    s.likes.delete(Number(params.id));
    return HttpResponse.json(ok(null));
  }),

  // GET /api/v1/auctions/:id/notification-settings
  http.get("*/api/v1/auctions/:id/notification-settings", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    return HttpResponse.json(
      ok({
        auctionStart: s.notificationSubs.has(id),
        auctionEnd: false,
        priceReached: false,
        price: 0,
      })
    );
  }),

  // PUT /api/v1/auctions/:id/notification-settings — save settings
  http.put("*/api/v1/auctions/:id/notification-settings", async ({ params, request }) => {
    const body = (await request.json()) as {
      auctionStart?: boolean;
      auctionEnd?: boolean;
      priceReached?: boolean;
      price?: number;
    };
    const s = getStore();
    const id = Number(params.id);
    const anyOn = body.auctionStart || body.auctionEnd || body.priceReached;
    if (anyOn) s.notificationSubs.add(id);
    else s.notificationSubs.delete(id);
    return HttpResponse.json(ok({ updated: true }));
  }),

  // POST /api/v1/auctions/:id/notification-settings (legacy)
  http.post("*/api/v1/auctions/:id/notification-settings", async ({ params, request }) => {
    const body = (await request.json()) as { auctionStart?: boolean; startAlert?: boolean };
    const s = getStore();
    const id = Number(params.id);
    const on = body.auctionStart ?? body.startAlert;
    if (on) s.notificationSubs.add(id);
    else if (on === false) s.notificationSubs.delete(id);
    return HttpResponse.json(ok({ updated: true }));
  }),

  // POST /api/v1/auctions/:id/notification-settings/start (legacy single-flag)
  http.post("*/api/v1/auctions/:id/notification-settings/start", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    if (s.notificationSubs.has(id)) s.notificationSubs.delete(id);
    else s.notificationSubs.add(id);
    return HttpResponse.json(ok({ isNotification: s.notificationSubs.has(id) }));
  }),

  // GET /api/v1/auctions/:sellerId/seller — seller info
  http.get("*/api/v1/auctions/:sellerId/seller", ({ params }) => {
    const s = getStore();
    const sellerId = Number(params.sellerId);
    const seller = s.users.get(sellerId) ?? s.currentUser;

    const buyers = s.reviews
      .filter((r) => r.revieweeId === sellerId)
      .slice(0, 3)
      .map((r) => ({
        buyerId: r.reviewerId,
        username: s.users.get(r.reviewerId)?.username ?? "익명",
        content: r.content,
      }));

    const sellerAuctions = [...s.auctions.values()]
      .filter((a) => a.sellerId === sellerId)
      .slice(0, 5)
      .map((a) => ({
        auctionId: a.auctionId,
        title: a.title,
        auctionImageUrl: a.imageUrls[0],
      }));

    return HttpResponse.json(
      ok({
        sellerId: seller.userId,
        username: seller.username,
        profileImageUrl: seller.userProfileUrl,
        rating: seller.rating,
        reviewCount: seller.totalReviews,
        totalReviews: seller.totalReviews,
        buyers,
        auctions: sellerAuctions,
      })
    );
  }),

  // POST /api/v1/auctions — create
  http.post("*/api/v1/auctions", async ({ request }) => {
    const body = (await request.json()) as Partial<AuctionRecord>;
    const s = getStore();
    const newId = Math.max(...s.auctions.keys()) + 1;
    const newAuction: AuctionRecord = {
      auctionId: newId,
      title: body.title ?? "새 경매",
      description: body.description ?? "",
      category: (body.category as AuctionRecord["category"]) ?? "ETC",
      imageUrls: body.imageUrls ?? [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
      ],
      sellerId: s.currentUser.userId,
      startPrice: body.startPrice ?? 100_000,
      dropAmount: body.dropAmount ?? 5_000,
      stopLoss: body.stopLoss ?? 50_000,
      status: "SCHEDULED",
      startedAt: body.startedAt ?? new Date(Date.now() + 10 * 60_000).toISOString(),
      createdDate: new Date().toISOString(),
      tags: body.tags ?? [],
      likeCount: 0,
    };
    s.auctions.set(newId, newAuction);
    s.scheduledIds = [newId, ...s.scheduledIds];
    return HttpResponse.json(ok({ auctionId: newId, status: newAuction.status }), { status: 201 });
  }),

  // DELETE /api/v1/auctions/:id
  http.delete("*/api/v1/auctions/:id", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    s.auctions.delete(id);
    s.processIds = s.processIds.filter((x) => x !== id);
    s.scheduledIds = s.scheduledIds.filter((x) => x !== id);
    s.popularIds = s.popularIds.filter((x) => x !== id);
    s.endedIds = s.endedIds.filter((x) => x !== id);
    return HttpResponse.json(ok(null, "경매가 삭제되었습니다."));
  }),
];
