export type AssetCategory = "gold" | "silver" | "coin" | "currency" | "crypto";

export type TransactionType = "buy" | "sell";

export type AssetRecord = {
  id: string;
  category: AssetCategory;
  instrumentId: string;
  name: string;
  unit: string;
  createdAt: string;
};

export type TransactionRecord = {
  id: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fee: number;
  date: string;
  note?: string;
};

export type PriceRecord = {
  instrumentId: string;
  name: string;
  category: AssetCategory;
  priceToman: number;
  source: "tgju" | "manual" | "cache";
  sourceUrl?: string;
  rawValue?: string;
  fetchedAt: string;
  stale?: boolean;
};

export type ManualPriceRecord = PriceRecord & {
  source: "manual";
  note?: string;
};

export type PortfolioSnapshot = {
  assets: AssetRecord[];
  transactions: TransactionRecord[];
  priceCache: PriceRecord[];
  manualPrices: ManualPriceRecord[];
  settings: Record<string, unknown>;
};

export type InstrumentDefinition = {
  id: string;
  name: string;
  category: AssetCategory;
  unit: string;
  tgjuPath?: string;
};

export const instruments: InstrumentDefinition[] = [
  { id: "gold_melted_18", name: "طلای آب‌شده ۱۸ عیار", category: "gold", unit: "گرم", tgjuPath: "/profile/geram18" },
  { id: "gold_24", name: "طلای ۲۴ عیار", category: "gold", unit: "گرم", tgjuPath: "/profile/geram24" },
  { id: "silver_999", name: "نقره ۹۹۹", category: "silver", unit: "گرم", tgjuPath: "/profile/silver" },
  { id: "coin_emami", name: "سکه امامی", category: "coin", unit: "عدد", tgjuPath: "/profile/sekee" },
  { id: "coin_bahar", name: "سکه بهار آزادی", category: "coin", unit: "عدد", tgjuPath: "/profile/sekeb" },
  { id: "coin_half", name: "نیم‌سکه", category: "coin", unit: "عدد", tgjuPath: "/profile/nim" },
  { id: "coin_quarter", name: "ربع‌سکه", category: "coin", unit: "عدد", tgjuPath: "/profile/rob" },
  { id: "coin_gram", name: "سکه گرمی", category: "coin", unit: "عدد", tgjuPath: "/profile/gerami" },
  { id: "coin_parsian", name: "سکه پارسیان", category: "coin", unit: "گرم", tgjuPath: "/coin" },
  { id: "currency_usd", name: "دلار آمریکا", category: "currency", unit: "دلار", tgjuPath: "/profile/price_dollar_rl" },
  { id: "currency_eur", name: "یورو", category: "currency", unit: "یورو", tgjuPath: "/profile/price_eur" },
  { id: "currency_gbp", name: "پوند انگلیس", category: "currency", unit: "پوند", tgjuPath: "/profile/price_gbp" },
  { id: "currency_aed", name: "درهم امارات", category: "currency", unit: "درهم", tgjuPath: "/profile/price_aed" },
  { id: "crypto_usdt", name: "تتر", category: "crypto", unit: "USDT", tgjuPath: "/profile/crypto-tether" },
  { id: "crypto_btc", name: "بیت‌کوین", category: "crypto", unit: "BTC", tgjuPath: "/profile/crypto-bitcoin" },
  { id: "crypto_eth", name: "اتریوم", category: "crypto", unit: "ETH", tgjuPath: "/profile/crypto-ethereum" },
];

export type HoldingSummary = {
  asset: AssetRecord;
  quantity: number;
  averageCost: number;
  invested: number;
  realizedProfit: number;
  currentPrice?: PriceRecord;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedPercent: number;
};

export type PortfolioSummary = {
  holdings: HoldingSummary[];
  totalValue: number;
  totalInvested: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  totalProfitPercent: number;
  stalePriceCount: number;
};

export function normalizeDigits(input: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/٬/g, "")
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .trim();
}

export function parseLocalizedNumber(input: string): number {
  const normalized = normalizeDigits(input);
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function formatToman(value: number): string {
  return `${Math.round(value).toLocaleString("fa-IR")} تومان`;
}

export function formatNumber(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString("fa-IR", { maximumFractionDigits });
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
}

export function getBestPrice(
  asset: AssetRecord,
  priceCache: PriceRecord[],
  manualPrices: ManualPriceRecord[],
): PriceRecord | undefined {
  const freshMarket = [...priceCache]
    .filter((price) => price.instrumentId === asset.instrumentId && !price.stale)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
  if (freshMarket) return freshMarket;

  const manual = [...manualPrices]
    .filter((price) => price.instrumentId === asset.instrumentId)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
  if (manual) return manual;

  return [...priceCache]
    .filter((price) => price.instrumentId === asset.instrumentId)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
}

export function computePortfolio(snapshot: PortfolioSnapshot): PortfolioSummary {
  const holdings = snapshot.assets.map((asset) => {
    const assetTransactions = snapshot.transactions
      .filter((transaction) => transaction.assetId === asset.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let quantity = 0;
    let invested = 0;
    let realizedProfit = 0;

    for (const transaction of assetTransactions) {
      const total = transaction.quantity * transaction.unitPrice + transaction.fee;
      if (transaction.type === "buy") {
        quantity += transaction.quantity;
        invested += total;
      } else {
        const averageCost = quantity > 0 ? invested / quantity : 0;
        const soldCost = Math.min(transaction.quantity, quantity) * averageCost;
        const proceeds = transaction.quantity * transaction.unitPrice - transaction.fee;
        realizedProfit += proceeds - soldCost;
        quantity = Math.max(0, quantity - transaction.quantity);
        invested = Math.max(0, invested - soldCost);
      }
    }

    const currentPrice = getBestPrice(asset, snapshot.priceCache, snapshot.manualPrices);
    const currentValue = currentPrice ? quantity * currentPrice.priceToman : 0;
    const averageCost = quantity > 0 ? invested / quantity : 0;
    const unrealizedProfit = currentPrice ? currentValue - invested : 0;
    const unrealizedPercent = invested > 0 ? (unrealizedProfit / invested) * 100 : 0;

    return {
      asset,
      quantity,
      averageCost,
      invested,
      realizedProfit,
      currentPrice,
      currentValue,
      unrealizedProfit,
      unrealizedPercent,
    };
  });

  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvested = holdings.reduce((sum, holding) => sum + holding.invested, 0);
  const realizedProfit = holdings.reduce((sum, holding) => sum + holding.realizedProfit, 0);
  const unrealizedProfit = holdings.reduce((sum, holding) => sum + holding.unrealizedProfit, 0);
  const totalProfit = realizedProfit + unrealizedProfit;
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const stalePriceCount = holdings.filter((holding) => holding.currentPrice?.stale).length;

  return {
    holdings,
    totalValue,
    totalInvested,
    realizedProfit,
    unrealizedProfit,
    totalProfit,
    totalProfitPercent,
    stalePriceCount,
  };
}

export function emptySnapshot(): PortfolioSnapshot {
  return {
    assets: [],
    transactions: [],
    priceCache: [],
    manualPrices: [],
    settings: {},
  };
}
