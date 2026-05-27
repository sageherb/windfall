import { describe, it, expect } from "vitest";

import { rebaseAuctionTimes } from "./store";

import type { AuctionRecord } from "./types";

const NOW = Date.parse("2026-05-28T12:00:00.000Z");

function baseAuction(overrides: Partial<AuctionRecord>): AuctionRecord {
  return {
    auctionId: 1,
    title: "t",
    description: "d",
    category: "DIGITAL",
    imageUrls: ["x"],
    sellerId: 2,
    startPrice: 1_000_000,
    dropAmount: 50_000,
    stopLoss: 500_000,
    status: "PROCESS",
    startedAt: "2020-01-01T00:00:00.000Z",
    createdDate: "2020-01-01T00:00:00.000Z",
    tags: [],
    likeCount: 0,
    ...overrides,
  };
}

describe("rebaseAuctionTimes", () => {
  it("PROCESS auctions get a startedAt within the last 50 minutes", () => {
    const out = rebaseAuctionTimes([baseAuction({ auctionId: 7, status: "PROCESS" })], NOW);
    const startMs = Date.parse(out[0].startedAt);
    const ageMin = (NOW - startMs) / 60_000;
    expect(ageMin).toBeGreaterThanOrEqual(1);
    expect(ageMin).toBeLessThanOrEqual(50);
  });
});
