import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./catalog.mjs";
import {
  compatibility,
  parseIntent,
  filterItems,
  vehicleDefaults,
} from "./domain.mjs";
import { parseOffer, failedOffer, sourceFor, fetchOffer } from "./offers.mjs";
const wheel = catalog[0],
  lip = catalog.find((i) => i.id === "maxton-set");
test("confirmed 2001 M-Technik matches lip condition, never certifies installation", () => {
  const fit = compatibility(lip);
  assert.equal(fit.status, "conditional");
  assert.ok(fit.pending.length);
  assert.equal(
    compatibility(lip, { ...vehicleDefaults, bumper: "standard" }).status,
    "excluded",
  );
  assert.equal(
    compatibility(lip, { ...vehicleDefaults, bumper: "unknown" }).status,
    "unknown",
  );
});
test("bore, PCD, year and conflicting retailer dimensions cannot be overriden by ranking", () => {
  assert.equal(compatibility({ ...wheel, bore: 72.6 }).status, "excluded");
  assert.equal(compatibility({ ...wheel, pcd: "5x112" }).status, "excluded");
  assert.equal(
    compatibility({ ...wheel, years: [2002, 2003] }).status,
    "excluded",
  );
  assert.equal(
    compatibility(catalog.find((i) => i.id === "p33-spoke-conflict")).status,
    "conflict",
  );
});
test("natural language handles category, budget, size and negative constraints", () => {
  const i = parseIntent(
    "Keine 19 Zoll, sondern 18 Zoll Felgen bis 450 Euro, keine schwarzen",
    "lip",
  );
  assert.equal(i.category, "wheels");
  assert.equal(i.size, 18);
  assert.equal(i.maxPrice, 450);
  assert.equal(
    parseIntent("Felgensatz bis 1.500 Euro", "wheels").maxPrice,
    1500,
  );
  assert.deepEqual(i.excludedSizes, [19]);
  assert.deepEqual(i.excludes, ["schwarz"]);
});
test("set budgets compare four individual prices and exclude unknown/stale prices", () => {
  const offer = { price: 370, availability: "in_stock", stale: false };
  const items = [
    { ...wheel, offer },
    { ...wheel, id: "stale", offer: { ...offer, stale: true } },
    { ...wheel, id: "unknown", offer: { ...offer, price: null } },
  ];
  assert.equal(
    filterItems(items, parseIntent("Satz Felgen bis 1400 Euro", "wheels"))
      .length,
    0,
  );
  assert.equal(
    filterItems(items, parseIntent("Satz Felgen bis 1500 Euro", "wheels"))
      .length,
    1,
  );
});
test("unsupported sizes and non-M bumper search return no invented fit", () => {
  assert.equal(
    parseIntent("schwarzer Frontansatz bis 300 Euro", "lip").budgetUnit,
    "offer",
  );
  assert.equal(
    filterItems(
      [{ ...wheel, offer: { price: 370, stale: false } }],
      parseIntent("bronze Felgen", "wheels"),
    ).length,
    0,
  );
  assert.equal(
    filterItems(
      [{ ...lip, offer: { price: 279, stale: false } }],
      parseIntent("Frontlippe ohne M-Paket", "lip"),
    ).length,
    0,
  );
});
test("Shopify parser selects exact SKU+variant and uses integer cents, no cheapest-variant leak", () => {
  const item = catalog.find((i) => i.id === "p33-bm34-set");
  const text = JSON.stringify({
    title: "E39 Felge",
    description: "E39",
    variants: [
      { id: 1, sku: "other", price: 100, available: true },
      { id: item.variantId, sku: item.sku, price: 160999, available: false },
    ],
  });
  assert.equal(parseOffer(item, text).price, 1609.99);
  assert.equal(parseOffer(item, text).availability, "out_of_stock");
  assert.throws(() => parseOffer({ ...item, sku: "WRONG" }, text));
});
test("microdata parser scopes identity and price to the main product, respects production lead time", () => {
  const html = `<main itemscope itemtype="https://schema.org/Product"><h1>E39 Frontlippe</h1><span itemprop="sku">${lip.sku}</span><div id="product-offer"><meta itemprop="price" content="279.00"><meta itemprop="priceCurrency" content="EUR"><div class="delivery-status">Wird bei Bestellung für Sie produziert, 59 Tage</div><link itemprop="availability" href="https://schema.org/InStock"></div><aside><meta itemprop="price" content="22.00"></aside></main>`;
  const o = parseOffer(lip, html);
  assert.equal(o.price, 279);
  assert.equal(o.availability, "made_to_order");
  assert.throws(() => parseOffer({ ...lip, sku: "OTHER" }, html));
});
test("fetch failure retains original date, never marks old stock fresh", () => {
  const old = {
    price: 123,
    checkedAt: "2026-10-01T00:00:00Z",
    availability: "in_stock",
  };
  const f = failedOffer(old, "2026-10-17T00:00:00Z");
  assert.equal(f.checkedAt, old.checkedAt);
  assert.equal(f.price, 123);
  assert.equal(f.stale, true);
  assert.equal(
    filterItems([{ ...wheel, offer: f }], parseIntent("", "wheels"), {
      onlyAvailable: true,
    }).length,
    0,
  );
});
test("source URL is exact allowlist, arbitrary URLs and redirects are rejected", async () => {
  assert.throws(() => sourceFor({ ...wheel, url: "http://127.0.0.1/private" }));
  assert.throws(() => sourceFor({ ...wheel, url: wheel.url + "?next=secret" }));
  let called = false;
  await assert.rejects(
    fetchOffer(wheel, async (u, options) => {
      called = true;
      assert.equal(options.redirect, "error");
      return new Response("not found", { status: 404 });
    }),
  );
  assert.equal(called, true);
});
test("data conflicts are hidden by default even with apparently available stock", () => {
  const item = {
    ...catalog.find((i) => i.id === "p33-spoke-conflict"),
    offer: { price: 409.99, stale: false, availability: "in_stock" },
  };
  assert.equal(filterItems([item], parseIntent("", "wheels")).length, 0);
  assert.equal(
    filterItems([item], parseIntent("", "wheels"), { includeConflicts: true })
      .length,
    1,
  );
});
