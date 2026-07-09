import assert from "node:assert/strict";
import test from "node:test";
import { computePortfolio, parseLocalizedNumber } from "../app/lib/portfolio.ts";

const asset = {
  id: "asset_gold",
  category: "gold",
  instrumentId: "gold_melted_18",
  name: "طلای آب‌شده",
  unit: "گرم",
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("computes average cost and unrealized profit for stepped buys", () => {
  const summary = computePortfolio({
    assets: [asset],
    transactions: [
      { id: "t1", assetId: asset.id, type: "buy", quantity: 100, unitPrice: 6_000_000, fee: 0, date: "2026-01-01T00:00:00.000Z" },
      { id: "t2", assetId: asset.id, type: "buy", quantity: 50, unitPrice: 8_000_000, fee: 0, date: "2026-02-01T00:00:00.000Z" },
    ],
    priceCache: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 10_000_000, source: "tgju", fetchedAt: "2026-03-01T00:00:00.000Z" }],
    manualPrices: [],
    settings: {},
  });

  assert.equal(summary.holdings[0].quantity, 150);
  assert.equal(summary.holdings[0].averageCost, 6_666_666.666666667);
  assert.equal(summary.totalValue, 1_500_000_000);
  assert.equal(summary.unrealizedProfit, 500_000_000);
});

test("computes realized profit for partial sells", () => {
  const summary = computePortfolio({
    assets: [asset],
    transactions: [
      { id: "t1", assetId: asset.id, type: "buy", quantity: 10, unitPrice: 100, fee: 0, date: "2026-01-01T00:00:00.000Z" },
      { id: "t2", assetId: asset.id, type: "sell", quantity: 4, unitPrice: 150, fee: 10, date: "2026-02-01T00:00:00.000Z" },
    ],
    priceCache: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 140, source: "tgju", fetchedAt: "2026-03-01T00:00:00.000Z" }],
    manualPrices: [],
    settings: {},
  });

  assert.equal(summary.holdings[0].quantity, 6);
  assert.equal(summary.realizedProfit, 190);
  assert.equal(summary.unrealizedProfit, 240);
});

test("prefers fresh TGJU price over manual fallback", () => {
  const summary = computePortfolio({
    assets: [asset],
    transactions: [{ id: "t1", assetId: asset.id, type: "buy", quantity: 1, unitPrice: 100, fee: 0, date: "2026-01-01T00:00:00.000Z" }],
    priceCache: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 120, source: "tgju", fetchedAt: "2026-03-01T00:00:00.000Z" }],
    manualPrices: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 180, source: "manual", fetchedAt: "2026-03-02T00:00:00.000Z" }],
    settings: {},
  });

  assert.equal(summary.totalValue, 120);
  assert.equal(summary.unrealizedProfit, 20);
});

test("uses manual price when market price is stale", () => {
  const summary = computePortfolio({
    assets: [asset],
    transactions: [{ id: "t1", assetId: asset.id, type: "buy", quantity: 1, unitPrice: 100, fee: 0, date: "2026-01-01T00:00:00.000Z" }],
    priceCache: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 120, source: "cache", stale: true, fetchedAt: "2026-03-01T00:00:00.000Z" }],
    manualPrices: [{ instrumentId: "gold_melted_18", name: "طلای آب‌شده", category: "gold", priceToman: 180, source: "manual", fetchedAt: "2026-03-02T00:00:00.000Z" }],
    settings: {},
  });

  assert.equal(summary.totalValue, 180);
  assert.equal(summary.unrealizedProfit, 80);
});

test("parses Persian decimal and thousands separators", () => {
  assert.equal(parseLocalizedNumber("۱۴۷٫۸"), 147.8);
  assert.equal(parseLocalizedNumber("۱٬۰۰۰٬۰۰۰٫۵"), 1_000_000.5);
});
