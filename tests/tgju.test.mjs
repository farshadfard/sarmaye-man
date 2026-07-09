import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketNumber, parseTgjuHtml, toEnglishDigits } from "../app/lib/tgju.ts";

test("normalizes Persian and Arabic digits", () => {
  assert.equal(toEnglishDigits("۱,۲۳۴ ٥٦"), "1,234 56");
  assert.equal(parseMarketNumber("۱۸۱٬۵۰۰٬۰۰۰"), 181_500_000);
});

test("parses TGJU-like profile current price snippets", () => {
  const prices = parseTgjuHtml(
    {
      "/profile/geram18": `
        <html lang="fa">
          <body>
            <h1>طلای ۱۸ عیار</h1>
            <div>نرخ فعلی ۱۷٬۹۲۴٬۰۰۰</div>
          </body>
        </html>
      `,
      "/profile/price_dollar_rl": `
        <script>{"title":"دلار آمریکا","price":"1,747,500"}</script>
      `,
    },
    "2026-07-09T00:00:00.000Z",
  );

  const gold = prices.find((price) => price.instrumentId === "gold_melted_18");
  const usd = prices.find((price) => price.instrumentId === "currency_usd");

  assert.equal(gold?.priceToman, 1_792_400);
  assert.equal(usd?.priceToman, 174_750);
  assert.equal(gold?.source, "tgju");
  assert.match(gold?.sourceUrl ?? "", /tgju\.org\/profile\/geram18/);
});

