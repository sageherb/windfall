import { describe, it, expect, beforeEach } from "vitest";

import { getStore, resetStore, nextNotificationId, nextChatMessageId } from "./store";

beforeEach(() => {
  resetStore();
});

describe("getStore", () => {
  it("returns a store with currentUser loaded from seed", () => {
    const store = getStore();
    expect(store.currentUser).toBeDefined();
    expect(typeof store.currentUser.userId).toBe("number");
  });

  it("returns a store with users Map populated from seed", () => {
    const store = getStore();
    expect(store.users).toBeInstanceOf(Map);
    expect(store.users.size).toBeGreaterThan(0);
  });

  it("returns a store with auctions Map populated from seed", () => {
    const store = getStore();
    expect(store.auctions).toBeInstanceOf(Map);
    expect(store.auctions.size).toBeGreaterThan(0);
  });

  it("returns popularIds as a non-empty number array", () => {
    const store = getStore();
    expect(Array.isArray(store.popularIds)).toBe(true);
    expect(store.popularIds.length).toBeGreaterThan(0);
  });

  it("returns processIds as a number array", () => {
    const store = getStore();
    expect(Array.isArray(store.processIds)).toBe(true);
  });

  it("returns scheduledIds as a number array", () => {
    const store = getStore();
    expect(Array.isArray(store.scheduledIds)).toBe(true);
  });

  it("returns endedIds as a number array", () => {
    const store = getStore();
    expect(Array.isArray(store.endedIds)).toBe(true);
  });

  it("returns notifications as an array", () => {
    const store = getStore();
    expect(Array.isArray(store.notifications)).toBe(true);
  });

  it("initializes nextNotificationId at 1000", () => {
    const store = getStore();
    expect(store.nextNotificationId).toBe(1000);
  });

  it("initializes likes as an empty Set", () => {
    const store = getStore();
    expect(store.likes).toBeInstanceOf(Set);
    expect(store.likes.size).toBe(0);
  });

  it("initializes notificationSubs as a Set", () => {
    const store = getStore();
    expect(store.notificationSubs).toBeInstanceOf(Set);
  });

  it("initializes recentViews as an empty array", () => {
    const store = getStore();
    expect(Array.isArray(store.recentViews)).toBe(true);
    expect(store.recentViews.length).toBe(0);
  });

  it("returns chatRooms as a Map", () => {
    const store = getStore();
    expect(store.chatRooms).toBeInstanceOf(Map);
  });

  it("returns chatMessages as a Map", () => {
    const store = getStore();
    expect(store.chatMessages).toBeInstanceOf(Map);
  });

  it("initializes nextChatMessageId at 10000", () => {
    const store = getStore();
    expect(store.nextChatMessageId).toBe(10_000);
  });

  it("returns purchases as an array", () => {
    const store = getStore();
    expect(Array.isArray(store.purchases)).toBe(true);
  });

  it("returns reviews as an array", () => {
    const store = getStore();
    expect(Array.isArray(store.reviews)).toBe(true);
  });

  it("initializes bootAt as a number", () => {
    const store = getStore();
    expect(typeof store.bootAt).toBe("number");
  });

  it("initializes firstDemoAlertSent as false", () => {
    const store = getStore();
    expect(store.firstDemoAlertSent).toBe(false);
  });
});

describe("nextNotificationId", () => {
  it("increments nextNotificationId and returns new value", () => {
    const store = getStore();
    const before = store.nextNotificationId;
    const result = nextNotificationId();
    expect(result).toBe(before + 1);
    expect(store.nextNotificationId).toBe(before + 1);
  });
});

describe("nextChatMessageId", () => {
  it("increments nextChatMessageId and returns new value", () => {
    const store = getStore();
    const before = store.nextChatMessageId;
    const result = nextChatMessageId();
    expect(result).toBe(before + 1);
    expect(store.nextChatMessageId).toBe(before + 1);
  });
});

describe("resetStore", () => {
  it("resets likes to empty on next getStore call", () => {
    const store = getStore();
    store.likes.add(999);
    expect(store.likes.size).toBe(1);
    resetStore();
    expect(getStore().likes.size).toBe(0);
  });
});
