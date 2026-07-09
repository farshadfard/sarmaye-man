import { instruments, type AssetCategory, type PriceRecord } from "./portfolio";

const TGJU_ORIGIN = "https://www.tgju.org";

export type TgjUFetchResult = {
  prices: PriceRecord[];
  fetchedAt: string;
  source: "tgju";
  errors: string[];
};

type Candidate = {
  label: string;
  value: number;
  raw: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&rlm;|&lrm;/g, " ")
    .replace(/\s+/g, " ");
}

export function toEnglishDigits(input: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)));
}

export function parseMarketNumber(raw: string): number | undefined {
  const normalized = toEnglishDigits(raw)
    .replace(/[٬,\s]/g, "")
    .replace(/[^\d.]/g, "");
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function maybeRialToToman(value: number): number {
  return value > 1_000_000 ? Math.round(value / 10) : value;
}

function jsonCandidates(html: string): Candidate[] {
  const candidates: Candidate[] = [];
  const regex =
    /["']?(?:title|name|label|fa_name)["']?\s*:\s*["']([^"']{2,80})["'][\s\S]{0,260}?["']?(?:price|p|last|value|close)["']?\s*:\s*["']?([۰-۹٠-٩\d,.٬]+)["']?/gi;
  for (const match of html.matchAll(regex)) {
    const value = parseMarketNumber(match[2]);
    if (value) candidates.push({ label: match[1], value: maybeRialToToman(value), raw: match[2] });
  }
  return candidates;
}

function textCandidates(html: string): Candidate[] {
  const text = stripHtml(html);
  const candidates: Candidate[] = [];
  const regex = /([آ-یA-Za-z][آ-یA-Za-z\s‌\-()]{2,60})\s+([۰-۹٠-٩\d][۰-۹٠-٩\d,٬.]{3,})/g;
  for (const match of text.matchAll(regex)) {
    const value = parseMarketNumber(match[2]);
    if (value) candidates.push({ label: match[1].trim(), value: maybeRialToToman(value), raw: match[2] });
  }
  return candidates;
}

function profileCurrentPrice(html: string): Candidate | undefined {
  const text = stripHtml(html);
  const currentRate =
    /(?:نرخ فعلی|قیمت فعلی|قیمت زنده|آخرین نرخ)\s*[:：]?\s*([۰-۹٠-٩\d][۰-۹٠-٩\d,٬.]{3,})/i.exec(text);
  if (currentRate?.[1]) {
    const value = parseMarketNumber(currentRate[1]);
    if (value) return { label: "نرخ فعلی", value: maybeRialToToman(value), raw: currentRate[1] };
  }

  return [...jsonCandidates(html), ...textCandidates(html)]
    .sort((a, b) => b.value - a.value)
    .find((candidate) => candidate.value > 100);
}

function matchCategoryFromId(id: string): AssetCategory {
  const instrument = instruments.find((item) => item.id === id);
  return instrument?.category ?? "currency";
}

export function parseTgjuHtml(
  htmlByPath: Record<string, string>,
  fetchedAt = new Date().toISOString(),
): PriceRecord[] {
  const prices: PriceRecord[] = [];

  for (const instrument of instruments) {
    if (!instrument.tgjuPath) continue;
    const html = htmlByPath[instrument.tgjuPath];
    if (!html) continue;

    const candidate = profileCurrentPrice(html);
    if (!candidate) continue;

    prices.push({
      instrumentId: instrument.id,
      name: instrument.name,
      category: instrument.category,
      priceToman: candidate.value,
      source: "tgju",
      sourceUrl: `${TGJU_ORIGIN}${instrument.tgjuPath}`,
      rawValue: candidate.raw,
      fetchedAt,
    });
  }

  return prices;
}

export async function fetchTgjuPrices(fetcher: typeof fetch = fetch): Promise<TgjUFetchResult> {
  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  const htmlByPath: Record<string, string> = {};
  const uniquePaths = [...new Set(instruments.map((instrument) => instrument.tgjuPath).filter(Boolean))] as string[];

  await Promise.all(
    uniquePaths.map(async (path) => {
      try {
        const response = await fetcher(`${TGJU_ORIGIN}${path}`, {
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "Mozilla/5.0 asset-log-book price fetcher",
          },
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        htmlByPath[path] = await response.text();
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.message : "خطای ناشناخته"}`);
      }
    }),
  );

  return {
    prices: parseTgjuHtml(htmlByPath, fetchedAt).map((price) => ({
      ...price,
      category: matchCategoryFromId(price.instrumentId),
    })),
    fetchedAt,
    source: "tgju",
    errors,
  };
}

