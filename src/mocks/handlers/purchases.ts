import { http, HttpResponse } from "msw";

import { getStore } from "../store";

import type { ApiResponse, SliceResponse } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

export const purchaseHandlers = [
  http.get("*/api/v1/me/purchases", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 15);
    const items = s.purchases.map((p) => {
      const auction = s.auctions.get(p.auctionId);
      const seller = s.users.get(p.sellerId);
      const startPrice = auction?.startPrice ?? p.finalPrice;
      const discountPercent =
        startPrice > 0 ? Math.floor(((startPrice - p.finalPrice) / startPrice) * 100) : 0;
      const matchedReview = s.reviews.find(
        (r) => r.auctionId === p.auctionId && r.reviewerId === s.currentUser.userId
      );
      const matchedRoom = [...s.chatRooms.values()].find((r) => r.tradeId === p.tradeId);
      return {
        status: p.status === "CONFIRMED" ? "PURCHASE_CONFIRMED" : "PAYMENT_COMPLETED",
        auctionId: p.auctionId,
        tradeId: p.tradeId,
        title: auction?.title ?? "경매",
        auctionImageUrl: auction?.imageUrls[0] ?? "",
        startPrice,
        endPrice: p.finalPrice,
        discountPercent,
        purchasedDate: p.purchasedAt,
        reviewId: matchedReview?.reviewId,
        chatInfo: matchedRoom
          ? { roomId: matchedRoom.chatRoomId, unreadCount: matchedRoom.unreadCount }
          : undefined,
        sellerId: p.sellerId,
        sellername: seller?.username ?? "판매자",
        sellerProfileImage: seller?.userProfileUrl,
      };
    });
    const start = page * size;
    const end = start + size;
    const body: SliceResponse<unknown> = {
      slice: items.slice(start, end),
      hasNext: end < items.length,
      page,
      size,
      timeStamp: new Date().toISOString(),
    };
    return HttpResponse.json(ok(body));
  }),

  http.post("*/api/v1/trades/:tradeId/confirm", ({ params }) => {
    const s = getStore();
    const tid = Number(params.tradeId);
    const p = s.purchases.find((x) => x.tradeId === tid);
    if (p) p.status = "CONFIRMED";
    return HttpResponse.json(ok({ tradeId: tid, status: "CONFIRMED" }));
  }),
];
