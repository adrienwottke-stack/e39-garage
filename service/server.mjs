import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalog, publicItem } from "./catalog.mjs";
import {
  compatibility,
  filterItems,
  lexicalScores,
  parseIntent,
  vehicleDefaults,
} from "./domain.mjs";
import { OfferStore } from "./offers.mjs";
import { SemanticSearch } from "./semantic.mjs";
const store = new OfferStore(
  process.env.DATA_DIR ||
    fileURLToPath(new URL("../parts-cache", import.meta.url)),
);
const semantic = new SemanticSearch();
await store.load();
const getItems = (vehicle = vehicleDefaults) =>
  catalog.map((p) => ({
    ...publicItem(p),
    offer: store.get(p.id),
    fit: compatibility(p, vehicle),
  }));
const origins = new Set([
  "https://e39.127.0.0.1.sslip.io",
  "http://localhost:5189",
  "http://127.0.0.1:5189",
  "http://localhost:5268",
  "http://127.0.0.1:5268",
]);
const rates = new Map();
function allowed(ip) {
  const now = Date.now();
  for (const [k, v] of rates) if (now - v.start > 60000) rates.delete(k);
  if (rates.size > 1000) return false;
  const r = rates.get(ip) || { start: now, count: 0 };
  r.count++;
  rates.set(ip, r);
  return r.count <= 30;
}
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const a = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw Error("INVALID_REQUEST");
    a.push(chunk);
  }
  return JSON.parse(Buffer.concat(a).toString());
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/healthz") {
      return send(res, 200, {
        ok: true,
        model: semantic.status,
        catalogCount: catalog.length,
      });
    }
    if (!allowed(req.headers["x-real-ip"] || req.socket.remoteAddress))
      return send(res, 429, { error: "Zu viele Anfragen. Bitte kurz warten." });
    if (req.method === "GET" && req.url === "/api/parts/catalog")
      return send(res, 200, {
        version: 1,
        scope: "Kuratierter E39-Katalog · 4 Händler · Felgen und Frontansätze",
        vehicle: vehicleDefaults,
        model: semantic.status,
        items: getItems(),
        refreshing: !!store.running,
      });
    if (
      req.method !== "POST" ||
      !["/api/parts/search", "/api/parts/refresh"].includes(req.url)
    )
      return send(res, 404, { error: "Nicht gefunden." });
    if (req.headers.origin && !origins.has(req.headers.origin))
      return send(res, 403, { error: "Ursprung nicht erlaubt." });
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
      return send(res, 415, { error: "JSON erforderlich." });
    const data = await body(req);
    if (req.url === "/api/parts/refresh") {
      await store.refresh();
      return send(res, 200, { items: getItems(), model: semantic.status });
    }
    if (
      typeof data.query !== "string" ||
      data.query.length > 400 ||
      !["wheels", "lip"].includes(data.category) ||
      (data.onlyAvailable !== undefined &&
        typeof data.onlyAvailable !== "boolean") ||
      (data.includeConflicts !== undefined &&
        typeof data.includeConflicts !== "boolean")
    )
      throw Error("INVALID_REQUEST");
    const query = data.query.trim(),
      intent = parseIntent(query, data.category);
    if (data.size !== undefined && data.size !== null) {
      if (![17, 18, 19].includes(data.size)) throw Error("INVALID_REQUEST");
      intent.size = data.size;
    }
    if (data.maxPrice !== undefined && data.maxPrice !== null) {
      if (
        !Number.isFinite(data.maxPrice) ||
        data.maxPrice < 0 ||
        data.maxPrice > 100000
      )
        throw Error("INVALID_REQUEST");
      intent.maxPrice = data.maxPrice;
    }
    const items = filterItems(getItems(), intent, data);
    const ai = query ? await semantic.scores(query, items) : null;
    const scores = ai?.scores || lexicalScores(items, query);
    const rank = (item, i) =>
      (query ? scores[i] : 0) -
      (item.offer.stale ? 0.15 : 0) -
      (item.offer.availability === "out_of_stock"
        ? 0.05
        : item.offer.availability === "made_to_order"
          ? 0.02
          : 0);
    const ranked = items
      .map((item, i) => ({
        ...item,
        similarity: query ? scores[i] : null,
        rank: rank(item, i),
      }))
      .sort(
        (a, b) =>
          b.rank - a.rank ||
          Number(a.offer.availability !== "in_stock") -
            Number(b.offer.availability !== "in_stock"),
      )
      .map(({ rank, ...item }) => item);
    send(res, 200, {
      items: ranked,
      intent,
      mode: ai ? "semantic" : "catalog",
      modelStatus: semantic.status,
      model: ai
        ? { name: ai.model, revision: ai.revision, elapsedMs: ai.elapsedMs }
        : null,
      scope:
        "Durchsucht die aufgenommenen Händlerangebote; keine vollständige Websuche.",
      budgetNote:
        intent.budgetUnit === "set"
          ? "Satzbudget: bei Einzelfelgen mit 4 × Einzelpreis verglichen, ohne Mengenrabatt und Versand."
          : "Budget bezieht sich auf die angezeigte Angebotseinheit; Einzelfelge und Satz unterscheiden.",
    });
  } catch (e) {
    send(res, e.message === "SEARCH_BUSY" ? 429 : 400, {
      error:
        e.message === "SEARCH_BUSY"
          ? "Die KI bearbeitet gerade eine Suche. Bitte kurz erneut versuchen."
          : "Die Suche konnte nicht verarbeitet werden. Bitte Eingabe prüfen.",
    });
  }
});
server.headersTimeout = 10000;
server.requestTimeout = 20000;
server.listen(
  Number(process.env.PORT || 5191),
  process.env.HOST || "127.0.0.1",
  () => console.log("E39 parts service listening"),
);
void semantic.warm(catalog);
void store.refresh().catch(() => console.error("Offer cache refresh failed."));
setInterval(() => void store.refresh().catch(() => {}), 6 * 3600_000).unref();
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
