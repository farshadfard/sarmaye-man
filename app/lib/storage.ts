"use client";

import { emptySnapshot, type AssetRecord, type ManualPriceRecord, type PortfolioSnapshot, type PriceRecord, type TransactionRecord } from "./portfolio";

const DB_NAME = "persian-asset-log";
const DB_VERSION = 1;
const STORES = ["assets", "transactions", "priceCache", "manualPrices", "settings"] as const;
type StoreName = (typeof STORES)[number];

type StoreRecord = AssetRecord | TransactionRecord | PriceRecord | ManualPriceRecord | { id: string; value: unknown };

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openPortfolioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const keyPath = store === "priceCache" || store === "manualPrices" ? "instrumentId" : "id";
          db.createObjectStore(store, { keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll<T>(db: IDBDatabase, storeName: StoreName): Promise<T[]> {
  const transaction = db.transaction(storeName, "readonly");
  return requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
}

async function replaceAll(db: IDBDatabase, storeName: StoreName, records: StoreRecord[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    for (const record of records) store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadSnapshot(): Promise<PortfolioSnapshot> {
  const db = await openPortfolioDb();
  try {
    const [assets, transactions, priceCache, manualPrices, settingsRows] = await Promise.all([
      readAll<AssetRecord>(db, "assets"),
      readAll<TransactionRecord>(db, "transactions"),
      readAll<PriceRecord>(db, "priceCache"),
      readAll<ManualPriceRecord>(db, "manualPrices"),
      readAll<{ id: string; value: unknown }>(db, "settings"),
    ]);
    return {
      assets,
      transactions,
      priceCache,
      manualPrices,
      settings: Object.fromEntries(settingsRows.map((row) => [row.id, row.value])),
    };
  } finally {
    db.close();
  }
}

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  const db = await openPortfolioDb();
  try {
    await replaceAll(db, "assets", snapshot.assets);
    await replaceAll(db, "transactions", snapshot.transactions);
    await replaceAll(db, "priceCache", snapshot.priceCache);
    await replaceAll(db, "manualPrices", snapshot.manualPrices);
    await replaceAll(
      db,
      "settings",
      Object.entries(snapshot.settings).map(([id, value]) => ({ id, value })),
    );
  } finally {
    db.close();
  }
}

export function exportSnapshot(snapshot: PortfolioSnapshot): string {
  return JSON.stringify({ version: DB_VERSION, exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}

export function parseImportedSnapshot(input: string): PortfolioSnapshot {
  const parsed = JSON.parse(input) as Partial<PortfolioSnapshot> & { version?: number };
  return {
    ...emptySnapshot(),
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    priceCache: Array.isArray(parsed.priceCache) ? parsed.priceCache : [],
    manualPrices: Array.isArray(parsed.manualPrices) ? parsed.manualPrices : [],
    settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
  };
}

