import { load } from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";
import { catalog } from "./catalog.mjs";
const tidy = (s) => s.replace(/\s+/g, " ").trim();
const hosts = new Set([
  "parts33.com",
  "maxtondesign.de",
  "www.sjs-carstyling.com",
  "beamerstyling.nl",
]);
export function sourceFor(item) {
  if (!catalog.some((p) => p.id === item.id && p.url === item.url))
    throw Error("Quelle nicht im Katalog");
  const u = new URL(item.url);
  if (
    u.protocol !== "https:" ||
    !hosts.has(u.hostname) ||
    u.username ||
    u.password ||
    u.search
  )
    throw Error("Unzulässige Quelle");
  return item.adapter === "shopify" ? item.url + ".js" : item.url;
}
export function parseOffer(item, text) {
  if (item.adapter === "shopify") {
    const p = JSON.parse(text),
      v = p.variants?.find(
        (v) => v.id === item.variantId && v.sku === item.sku,
      );
    if (
      !v ||
      !Number.isSafeInteger(v.price) ||
      v.price <= 0 ||
      v.price > 1e7 ||
      !/E39/i.test(p.title + " " + p.description)
    )
      throw Error("Produktvariante nicht eindeutig");
    return {
      price: v.price / 100,
      currency: "EUR",
      availability: v.available ? "in_stock" : "out_of_stock",
      delivery: null,
      variant: v.title,
    };
  }
  const $ = load(text),
    root = $("h1").first().closest('[itemscope][itemtype$="/Product"]');
  const sku = tidy(root.find("[itemprop=sku]").first().text());
  const price = Number(
    root.find("meta[itemprop=price]").first().attr("content"),
  );
  const currency = root
    .find("meta[itemprop=priceCurrency]")
    .first()
    .attr("content");
  if (
    sku !== item.sku ||
    !root.length ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 100000 ||
    currency !== "EUR" ||
    !/E39/i.test(root.find("h1").text())
  )
    throw Error("Produkt/Preis nicht eindeutig");
  const delivery =
    tidy(root.find("#product-offer .delivery-status").first().text()).slice(
      0,
      180,
    ) || null;
  const a = root.find("[itemprop=availability]").first().attr("href") || "";
  const availability = /produziert|bestellung.*gefertigt/i.test(delivery || "")
    ? "made_to_order"
    : /OutOfStock|Discontinued|SoldOut/.test(a)
      ? "out_of_stock"
      : /InStock/.test(a)
        ? "in_stock"
        : "unknown";
  return { price, currency, availability, delivery, variant: item.unit };
}
export async function fetchOffer(item, fetcher = fetch) {
  const url = sourceFor(item),
    r = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "E39Garage/0.5 (+personal product comparison)",
        Accept: item.adapter === "shopify" ? "application/json" : "text/html",
      },
    });
  if (!r.ok) throw Error("Quelle nicht erreichbar");
  if (Number(r.headers.get("content-length") || 0) > 2_000_000)
    throw Error("Quelle zu groß");
  const reader = r.body.getReader(),
    chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 2_000_000) {
      await reader.cancel();
      throw Error("Quelle zu groß");
    }
    chunks.push(value);
  }
  const parsed = parseOffer(item, Buffer.concat(chunks).toString("utf8"));
  return {
    ...parsed,
    checkedAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    stale: false,
    error: null,
  };
}
export function failedOffer(previous, now = new Date().toISOString()) {
  return {
    ...(previous || {
      price: null,
      currency: "EUR",
      availability: "unknown",
      delivery: null,
      checkedAt: null,
    }),
    stale: true,
    lastAttemptAt: now,
    error:
      "Quelle derzeit nicht prüfbar; letzten Preisstand beim Händler kontrollieren.",
  };
}
export class OfferStore {
  constructor(dir) {
    this.dir = dir;
    this.offers = {};
    this.lastRefresh = 0;
    this.running = null;
  }
  async load() {
    try {
      this.offers = JSON.parse(
        await fs.readFile(path.join(this.dir, "offers.json"), "utf8"),
      );
    } catch {}
  }
  async refresh() {
    if (this.running) return this.running;
    if (Date.now() - this.lastRefresh < 15 * 60_000) return;
    this.lastRefresh = Date.now();
    this.running = (async () => {
      const pending = [...catalog];
      const worker = async () => {
        while (pending.length) {
          const p = pending.shift();
          try {
            this.offers[p.id] = await fetchOffer(p);
          } catch {
            this.offers[p.id] = failedOffer(this.offers[p.id]);
          }
        }
      };
      await Promise.all([worker(), worker()]);
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(
        path.join(this.dir, "offers.next.json"),
        JSON.stringify(this.offers),
      );
      await fs.rename(
        path.join(this.dir, "offers.next.json"),
        path.join(this.dir, "offers.json"),
      );
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  get(id) {
    const o = this.offers[id];
    if (!o) return failedOffer(null);
    return {
      ...o,
      stale:
        o.stale ||
        !o.checkedAt ||
        Date.now() - Date.parse(o.checkedAt) > 6 * 3600_000,
    };
  }
}
