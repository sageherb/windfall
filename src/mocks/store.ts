// src/mocks/store.ts

import auctionsSeed from "./seed/auctions.json";
import chatMessagesSeed from "./seed/chat-messages.json";
import chatRoomsSeed from "./seed/chat-rooms.json";
import currentUserSeed from "./seed/current-user.json";
import notificationsSeed from "./seed/notifications.json";
import purchasesSeed from "./seed/purchases.json";
import reviewsSeed from "./seed/reviews.json";
import usersSeed from "./seed/users.json";

import type {
  AuctionRecord,
  NotificationRecord,
  UserRecord,
  ChatRoomRecord,
  ChatMessageRecord,
  PurchaseRecord,
  ReviewRecord,
} from "./types";

export interface DemoStore {
  currentUser: UserRecord;
  users: Map<number, UserRecord>;

  auctions: Map<number, AuctionRecord>;
  popularIds: number[];
  processIds: number[];
  scheduledIds: number[];
  endedIds: number[];

  notifications: NotificationRecord[];
  nextNotificationId: number;

  likes: Set<number>;
  notificationSubs: Set<number>;
  recentViews: number[];

  chatRooms: Map<number, ChatRoomRecord>;
  chatMessages: Map<number, ChatMessageRecord[]>;
  nextChatMessageId: number;

  purchases: PurchaseRecord[];
  reviews: ReviewRecord[];

  bootAt: number;
  firstDemoAlertSent: boolean;
}

function buildStore(): DemoStore {
  const auctions = new Map<number, AuctionRecord>();
  (auctionsSeed as AuctionRecord[]).forEach((a) => auctions.set(a.auctionId, a));

  const popularIds = (auctionsSeed as AuctionRecord[])
    .filter((a) => a.auctionId >= 31 && a.auctionId <= 45)
    .map((a) => a.auctionId);

  const processIds = (auctionsSeed as AuctionRecord[])
    .filter((a) => a.status === "PROCESS" && a.auctionId <= 15)
    .map((a) => a.auctionId);

  const scheduledIds = (auctionsSeed as AuctionRecord[])
    .filter((a) => a.status === "SCHEDULED")
    .map((a) => a.auctionId);

  const endedIds = (auctionsSeed as AuctionRecord[])
    .filter((a) => a.status === "COMPLETED")
    .map((a) => a.auctionId);

  const users = new Map<number, UserRecord>();
  (usersSeed as UserRecord[]).forEach((u) => users.set(u.userId, u));
  users.set((currentUserSeed as UserRecord).userId, currentUserSeed as UserRecord);

  const chatRooms = new Map<number, ChatRoomRecord>();
  (chatRoomsSeed as ChatRoomRecord[]).forEach((r) => chatRooms.set(r.chatRoomId, r));

  const chatMessages = new Map<number, ChatMessageRecord[]>();
  Object.entries(chatMessagesSeed as Record<string, ChatMessageRecord[]>).forEach(([key, msgs]) => {
    chatMessages.set(Number(key), msgs);
  });

  // Pre-subscribe to one upcoming auction so the T+5s demo alert has a target.
  const notificationSubs = new Set<number>();
  if (scheduledIds[0] !== undefined) notificationSubs.add(scheduledIds[0]);

  return {
    currentUser: currentUserSeed as UserRecord,
    users,
    auctions,
    popularIds,
    processIds,
    scheduledIds,
    endedIds,
    notifications: [...(notificationsSeed as NotificationRecord[])],
    nextNotificationId: 1000,
    likes: new Set<number>(),
    notificationSubs,
    recentViews: [],
    chatRooms,
    chatMessages,
    nextChatMessageId: 10_000,
    purchases: [...(purchasesSeed as PurchaseRecord[])],
    reviews: [...(reviewsSeed as ReviewRecord[])],
    bootAt: Date.now(),
    firstDemoAlertSent: false,
  };
}

let store: DemoStore | null = null;

export function getStore(): DemoStore {
  if (!store) store = buildStore();
  return store;
}

/** Test/dev helper — re-seed (do not use in production demo). */
export function resetStore(): void {
  store = buildStore();
}

export function nextNotificationId(): number {
  return ++getStore().nextNotificationId;
}

export function nextChatMessageId(): number {
  return ++getStore().nextChatMessageId;
}
