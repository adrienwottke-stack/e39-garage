import { z } from "zod";
const text = z.string().max(2000);
const sourceUrl = z
  .string()
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      [
        "parts33.com",
        "maxtondesign.de",
        "www.sjs-carstyling.com",
        "beamerstyling.nl",
      ].includes(u.hostname)
    );
  });
export const catalogItemSchema = z.object({
  id: z.string().max(100),
  category: z.enum(["wheels", "lip"]),
  name: text,
  sku: text,
  merchant: text,
  url: sourceUrl,
  sourceUrl,
  brand: text,
  color: text,
  diameter: z.number().optional(),
  width: z.number().optional(),
  offset: z.number().nullable().optional(),
  pcd: text.optional(),
  bore: z.number().optional(),
  quantity: z.number().int().min(1).max(4),
  unit: text,
  certificate: text,
  conflicts: z.array(text),
  evidence: text,
  preview: z
    .object({
      frontLip: z.boolean().optional(),
      wheelStyle: z
        .enum(["photo", "double-five", "radial", "mesh", "reference"])
        .optional(),
      wheelSize: z
        .union([z.literal(17), z.literal(18), z.literal(19)])
        .optional(),
      wheelFinish: z.enum(["silver", "graphite", "bronze"]).optional(),
    })
    .nullable(),
  offer: z.object({
    price: z.number().nonnegative().nullable(),
    currency: z.literal("EUR"),
    availability: z.enum([
      "in_stock",
      "made_to_order",
      "out_of_stock",
      "unknown",
    ]),
    delivery: text.nullable(),
    checkedAt: z.string().datetime().nullable(),
    stale: z.boolean(),
    error: text.nullable(),
  }),
  fit: z.object({
    status: z.enum(["conditional", "conflict", "excluded", "unknown"]),
    label: text,
    reasons: z.array(text),
    pending: z.array(text),
  }),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type CatalogCategory = "wheels" | "lip";
export const catalogResponseSchema = z.object({
  items: z.array(catalogItemSchema).max(100),
  mode: z.enum(["semantic", "catalog"]).optional(),
  model: z.unknown().optional(),
  modelStatus: z.string().optional(),
  scope: text.optional(),
  budgetNote: text.optional(),
  intent: z
    .object({ category: z.enum(["wheels", "lip"]) })
    .passthrough()
    .optional(),
});
export function catalogPrice(item: CatalogItem) {
  return item.offer.price === null
    ? "Preis derzeit offen"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(item.offer.price);
}
