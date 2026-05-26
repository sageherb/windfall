import { describe, it, expect } from "vitest";

import { computeCurrentPrice, computeDiscountRate } from "./price";

const baseAuction = {
  startPrice: 1_000_000,
  dropAmount: 50_000,
  startedAt: "2026-05-27T03:00:00.000Z",
  stopLoss: 700_000,
};

describe("computeCurrentPrice", () => {
  it("returns startPrice before auction starts", () => {
    const now = Date.parse("2026-05-27T02:59:00.000Z");
    expect(computeCurrentPrice(baseAuction, now)).toBe(1_000_000);
  });

  it("returns startPrice exactly at startedAt", () => {
    const now = Date.parse("2026-05-27T03:00:00.000Z");
    expect(computeCurrentPrice(baseAuction, now)).toBe(1_000_000);
  });

  it("drops once after first 5-minute step", () => {
    const now = Date.parse("2026-05-27T03:05:00.000Z");
    expect(computeCurrentPrice(baseAuction, now)).toBe(950_000);
  });

  it("drops correctly after multiple steps", () => {
    const now = Date.parse("2026-05-27T03:30:00.000Z"); // 6 steps
    expect(computeCurrentPrice(baseAuction, now)).toBe(700_000);
  });

  it("clamps at stopLoss when computed price would dip below", () => {
    const now = Date.parse("2026-05-27T04:00:00.000Z"); // would be 400k raw → clamp to 700k
    expect(computeCurrentPrice(baseAuction, now)).toBe(700_000);
  });
});

describe("computeDiscountRate", () => {
  it("returns 0 when current equals start", () => {
    expect(computeDiscountRate(1_000_000, 1_000_000)).toBe(0);
  });

  it("returns floor percentage", () => {
    expect(computeDiscountRate(1_000_000, 950_000)).toBe(5);
    expect(computeDiscountRate(1_000_000, 333_333)).toBe(66);
  });

  it("returns 0 for non-positive start", () => {
    expect(computeDiscountRate(0, 0)).toBe(0);
  });
});
