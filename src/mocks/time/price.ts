const FIVE_MIN_MS = 5 * 60 * 1000;

export interface PriceInputs {
  startPrice: number;
  dropAmount: number;
  startedAt: string;
  stopLoss: number;
}

export function computeCurrentPrice(auction: PriceInputs, now: number = Date.now()): number {
  const startMs = Date.parse(auction.startedAt);
  if (!Number.isFinite(startMs) || now < startMs) return auction.startPrice;
  const steps = Math.floor((now - startMs) / FIVE_MIN_MS);
  const raw = auction.startPrice - steps * auction.dropAmount;
  return Math.max(auction.stopLoss, raw);
}

export function computeDiscountRate(startPrice: number, currentPrice: number): number {
  if (startPrice <= 0) return 0;
  return Math.floor(((startPrice - currentPrice) / startPrice) * 100);
}
