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
      return {
        tradeId: p.tradeId,
        auctionId: p.auctionId,
        auctionTitle: auction?.title ?? "경매",
        auctionImage: auction?.imageUrls[0] ?? null,
        sellerName: seller?.username ?? "판매자",
        finalPrice: p.finalPrice,
        status: p.status,
        purchasedAt: p.purchasedAt,
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
