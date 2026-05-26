// src/mocks/time/scheduler.ts
import { getStore } from "../store";
import { computeCurrentPrice } from "./price";
import { broadcastSse, buildPriceAlertNotification } from "../handlers/notifications";

const FIVE_MIN_MS = 5 * 60 * 1000;

function msUntilNextBoundary(): number {
  return FIVE_MIN_MS - (Date.now() % FIVE_MIN_MS);
}

let started = false;

export function startSseBoundaryScheduler(): void {
  if (started) return;
  started = true;
  const fire = () => {
    emitBoundaryNotification();
    setTimeout(fire, msUntilNextBoundary());
  };
  setTimeout(fire, msUntilNextBoundary());
}

function emitBoundaryNotification(): void {
  const s = getStore();
  const subId = [...s.notificationSubs][0];
  if (subId === undefined) return;
  const a = s.auctions.get(subId);
  if (!a) return;
  const price = computeCurrentPrice(a, Date.now());
  const item = buildPriceAlertNotification(subId, a.title, price);
  s.notifications.unshift(item);
  broadcastSse("priceAlert", item);
}
