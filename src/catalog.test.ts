import { describe, it, expect } from "vitest";
import { emptyGarage } from "./domain";
import { rememberCatalogItem } from "./catalog-actions";
import { catalogItemSchema, type CatalogItem } from "./catalog-domain";
import { createLookProject } from "./studio-actions";
import { photoLook } from "./studio-domain";
const item: CatalogItem = {
  id: "test-wheel-set",
  category: "wheels",
  name: "Synthetischer Felgensatz",
  sku: "TEST-4",
  merchant: "Test",
  url: "https://parts33.com/products/test?variant=1",
  sourceUrl: "https://parts33.com/products/test",
  brand: "Test",
  color: "Silber",
  diameter: 18,
  width: 8,
  offset: 20,
  pcd: "5x120",
  bore: 74.1,
  quantity: 4,
  unit: "4 Felgen als Satz",
  certificate: "Prüfung offen",
  conflicts: [],
  evidence: "Synthetische Quelle",
  preview: { wheelStyle: "double-five", wheelSize: 18 },
  offer: {
    price: 1600,
    currency: "EUR",
    availability: "in_stock",
    delivery: null,
    checkedAt: "2026-10-17T10:00:00Z",
    stale: false,
    error: null,
  },
  fit: {
    status: "conditional",
    label: "Prüfen",
    reasons: ["Testquelle"],
    pending: ["Gutachten prüfen"],
  },
};
describe("Händlerangebot zur Teileidee", () => {
  it("merkt einen Satz einmal vor ohne Preis zu vervierfachen, Kauf oder Passform zu bestätigen", () => {
    const g = emptyGarage(),
      next = rememberCatalogItem(g, item);
    expect(next.parts[0]).toMatchObject({
      quantity: 1,
      price: 1600,
      fitChecked: false,
      bought: false,
    });
    expect(next.parts[0].name).toContain("4 Felgen");
    expect(next.tasks[0].note).toContain("2026-10-17T10:00:00Z");
    expect(next.tasks[0].done).toBe(false);
    expect(next.entries).toEqual(g.entries);
    expect(next.studio).toEqual(g.studio);
    expect(rememberCatalogItem(next, item)).toBe(next);
  });
  it("übernimmt einen alten Preis nicht als aktuellen Planpreis", () => {
    expect(
      rememberCatalogItem(emptyGarage(), {
        ...item,
        offer: { ...item.offer, stale: true },
      }).parts[0].price,
    ).toBeNull();
  });
  it("blockiert widersprüchliche oder ausgeschlossene Angebote", () => {
    for (const status of ["conflict", "excluded"] as const)
      expect(() =>
        rememberCatalogItem(emptyGarage(), {
          ...item,
          fit: { ...item.fit, status },
        }),
      ).toThrow();
  });
  it("öffnet einen konkreten Teileplan auch ohne optische Änderung", () => {
    const g = emptyGarage();
    const next = createLookProject(
      g,
      photoLook(),
      "Teil prüfen",
      "wheels",
      "product-only",
      { name: item.name, url: item.url, price: "1600", partNumber: item.sku },
    );
    expect(next.tasks).toHaveLength(1);
    expect(next.parts[0].fitChecked).toBe(false);
    expect(next.studio).toEqual(g.studio);
  });
  it("validiert Händlerantworten und sperrt fremde oder unsichere Links", () => {
    expect(catalogItemSchema.parse(item).offer.price).toBe(1600);
    expect(() =>
      catalogItemSchema.parse({ ...item, url: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      catalogItemSchema.parse({ ...item, url: "https://example.com/fake" }),
    ).toThrow();
  });
});
