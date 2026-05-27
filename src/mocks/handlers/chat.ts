// src/mocks/handlers/chat.ts
import { http, HttpResponse } from "msw";

import { getStore } from "../store";

import type { ApiResponse, CursorResponse, ChatMessageRecord } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

export const chatHandlers = [
  // GET /api/v1/chat-rooms — list
  http.get("/api/v1/chat-rooms", () => {
    const s = getStore();
    const rooms = [...s.chatRooms.values()].map((r) => {
      const auction = s.auctions.get(r.auctionId);
      const other = s.users.get(r.otherUserId);
      return {
        chatRoomId: r.chatRoomId,
        auctionTitle: auction?.title ?? "경매",
        auctionImage: auction?.imageUrls[0] ?? null,
        otherUser: other
          ? { userId: other.userId, name: other.username, profileImage: other.userProfileUrl }
          : null,
        lastMessage: r.lastMessage,
        lastMessageAt: r.lastMessageAt,
        unreadCount: r.unreadCount,
      };
    });
    return HttpResponse.json(ok(rooms));
  }),

  // POST /api/v1/chat-rooms — create (idempotent: returns existing if any)
  http.post("/api/v1/chat-rooms", async ({ request }) => {
    const body = (await request.json()) as { auctionId?: number };
    const s = getStore();
    const existing = [...s.chatRooms.values()].find((r) => r.auctionId === body.auctionId);
    if (existing) return HttpResponse.json(ok({ chatRoomId: existing.chatRoomId }));
    const newId = Math.max(0, ...s.chatRooms.keys()) + 1;
    const auction = s.auctions.get(body.auctionId ?? 0);
    const newRoom = {
      chatRoomId: newId,
      tradeId: newId,
      auctionId: body.auctionId ?? 0,
      otherUserId: auction?.sellerId ?? 2,
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };
    s.chatRooms.set(newId, newRoom);
    s.chatMessages.set(newId, []);
    return HttpResponse.json(ok({ chatRoomId: newId }), { status: 201 });
  }),

  // GET /api/v1/chat-rooms/:id
  http.get("/api/v1/chat-rooms/:id", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    const room = s.chatRooms.get(id);
    if (!room) {
      return HttpResponse.json(
        { code: 404, status: "NOT_FOUND", message: "채팅방을 찾을 수 없습니다.", data: null },
        { status: 404 }
      );
    }
    const auction = s.auctions.get(room.auctionId);
    const other = s.users.get(room.otherUserId);
    return HttpResponse.json(
      ok({
        chatRoomId: room.chatRoomId,
        auctionId: room.auctionId,
        auctionTitle: auction?.title ?? "경매",
        auctionImage: auction?.imageUrls[0] ?? null,
        otherUser: other
          ? { userId: other.userId, name: other.username, profileImage: other.userProfileUrl }
          : null,
      })
    );
  }),

  // GET /api/v1/chat-rooms/:id/messages
  http.get("/api/v1/chat-rooms/:id/messages", ({ params, request }) => {
    const s = getStore();
    const id = Number(params.id);
    const room = s.chatRooms.get(id);
    if (!room) {
      return HttpResponse.json(
        { code: 404, status: "NOT_FOUND", message: "채팅방을 찾을 수 없습니다.", data: null },
        { status: 404 }
      );
    }
    const all = (s.chatMessages.get(id) ?? []).slice().sort((a, b) => b.messageId - a.messageId);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const size = Number(url.searchParams.get("size") ?? 20);
    const startIdx = cursor === null ? 0 : all.findIndex((m) => m.messageId === Number(cursor)) + 1;
    const cut = all.slice(startIdx, startIdx + size);
    const nextCursor = cut.length === size ? cut[cut.length - 1].messageId : null;
    const messagesResponse: CursorResponse<ChatMessageRecord> = {
      content: cut,
      nextCursor,
      hasNext: nextCursor !== null,
      size,
      timeStamp: new Date().toISOString(),
    };
    return HttpResponse.json(
      ok({
        chatRoomMeta: {
          trade: {
            tradeId: room.tradeId,
            auctionId: room.auctionId,
            auctionTitle: s.auctions.get(room.auctionId)?.title ?? "경매",
            finalPrice: s.purchases.find((p) => p.tradeId === room.tradeId)?.finalPrice ?? 0,
            status: "IN_PROGRESS",
          },
        },
        messages: messagesResponse,
      })
    );
  }),

  // PATCH /api/v1/chat-rooms/:id/messages/read — REST fallback when WS down
  http.patch("/api/v1/chat-rooms/:id/messages/read", ({ params }) => {
    const s = getStore();
    const id = Number(params.id);
    const room = s.chatRooms.get(id);
    if (room) room.unreadCount = 0;
    return HttpResponse.json(ok(null));
  }),
];
