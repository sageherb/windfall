// src/mocks/handlers/notifications.ts
import { http, HttpResponse } from "msw";

import { getStore, nextNotificationId } from "../store";

import type { ApiResponse, SliceResponse, NotificationRecord } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

// SSE subscribers — used by the SSE handler added in the next task.
export const sseSubscribers = new Set<ReadableStreamDefaultController>();
export const sseEncoder = new TextEncoder();

export function broadcastSse(eventName: string, payload: NotificationRecord) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  const bytes = sseEncoder.encode(data);
  sseSubscribers.forEach((c) => {
    try {
      c.enqueue(bytes);
    } catch {
      /* closed */
    }
  });
}

// SSE handler is appended into this array in the next task.
export const notificationHandlers = [
  // GET /api/v1/notifications — paginated list
  http.get("*/api/v1/notifications", ({ request }) => {
    const s = getStore();
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const size = Number(url.searchParams.get("size") ?? 15);
    const start = page * size;
    const end = start + size;
    const cut = s.notifications.slice(start, end);
    const body: SliceResponse<NotificationRecord> = {
      slice: cut,
      hasNext: end < s.notifications.length,
      page,
      size,
      timeStamp: new Date().toISOString(),
    };
    return HttpResponse.json(ok(body));
  }),

  // PATCH /api/v1/notifications — mark all read
  http.patch("*/api/v1/notifications", () => {
    const s = getStore();
    let count = 0;
    s.notifications.forEach((n) => {
      if (!n.readStatus) {
        n.readStatus = true;
        count++;
      }
    });
    return HttpResponse.json(ok({ count }));
  }),

  // PATCH /api/v1/notifications/:id — mark single read
  http.patch("*/api/v1/notifications/:id", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    const n = s.notifications.find((x) => x.notificationId === id);
    if (n) n.readStatus = true;
    return HttpResponse.json(ok({ notificationId: id, readStatus: true }));
  }),

  // GET /api/v1/notifications/subscribe — SSE stream
  http.get("*/api/v1/notifications/subscribe", () => {
    let controllerRef: ReadableStreamDefaultController | null = null;

    const stream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
        sseSubscribers.add(controller);

        controller.enqueue(sseEncoder.encode(": ping\n\n"));

        const s = getStore();
        if (!s.firstDemoAlertSent) {
          s.firstDemoAlertSent = true;
          setTimeout(() => {
            const subId = [...s.notificationSubs][0];
            if (subId === undefined) return;
            const a = s.auctions.get(subId);
            if (!a) return;
            const item = buildAuctionStartNotification(subId, a.title);
            s.notifications.unshift(item);
            const data = `event: auctionStartAlert\ndata: ${JSON.stringify(item)}\n\n`;
            try {
              controller.enqueue(sseEncoder.encode(data));
            } catch {
              /* closed */
            }
          }, 5_000);
        }
      },
      cancel() {
        if (controllerRef) sseSubscribers.delete(controllerRef);
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),
];

// Exported for the SSE handler (and the boundary scheduler) to build payloads.
export function buildAuctionStartNotification(
  auctionId: number,
  title: string
): NotificationRecord {
  return {
    notificationId: nextNotificationId(),
    type: "AUCTION_START_WISHLIST",
    title: "관심 경매가 시작됐어요",
    message: `${title} 경매가 시작됐습니다.`,
    readStatus: false,
    target: "auction",
    targetId: auctionId,
    notificationAt: new Date().toISOString(),
  };
}

export function buildPriceAlertNotification(
  auctionId: number,
  title: string,
  price: number
): NotificationRecord {
  return {
    notificationId: nextNotificationId(),
    type: "PRICE_DROP",
    title: "찜한 경매 가격이 떨어졌어요",
    message: `${title}의 가격이 ${price.toLocaleString()}원으로 떨어졌습니다.`,
    readStatus: false,
    target: "auction",
    targetId: auctionId,
    notificationAt: new Date().toISOString(),
  };
}
