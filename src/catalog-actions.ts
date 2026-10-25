import { type Garage } from "./domain";
import type { CatalogItem } from "./catalog-domain";
export function rememberCatalogItem(garage: Garage, item: CatalogItem): Garage {
  if (item.fit.status === "conflict" || item.fit.status === "excluded")
    throw Error(
      "Dieses Angebot hat einen offenen Datenkonflikt oder eine abweichende Zuordnung. Bitte zuerst klären.",
    );
  const taskId = "catalog-idea-" + item.id,
    partId = "catalog-part-" + item.id;
  if (garage.parts.some((p) => p.id === partId)) return garage;
  const note = [
    `Händlerangebot: ${item.merchant} · ${item.sku}`,
    `Angebotseinheit: ${item.unit}. Preis gilt für diese Einheit, nicht automatisch für einen vollständigen Radsatz.`,
    `Quelle: ${item.sourceUrl}`,
    `Preis-/Bestandsstand: ${item.offer.checkedAt || "nicht bestätigt"}${item.offer.stale ? " (veraltet/nicht erneut prüfbar)" : ""}`,
    item.evidence,
    ...item.fit.pending,
    `Fahrzeugbasis laut Nutzer: 530i E39 Limousine, Baujahr 2001, originale M-Technik-Stoßstange.`,
    `Vorgemerkt, nicht gekauft und nicht als passend oder eingebaut bestätigt.`,
  ].join("\n");
  return {
    ...garage,
    tasks: garage.tasks.some((t) => t.id === taskId)
      ? garage.tasks
      : [
          ...garage.tasks,
          {
            id: taskId,
            title: ("Teil prüfen: " + item.name).slice(0, 160),
            componentId: item.category === "wheels" ? "wheels" : "body",
            note,
            dueDate: null,
            dueKm: null,
            intervalMonths: null,
            intervalKm: null,
            source:
              "Eigenes Vormerken eines Händlerangebots; Passformprüfung offen",
            done: false,
            completedEntryId: null,
          },
        ],
    parts: [
      ...garage.parts,
      {
        id: partId,
        taskId,
        name: (item.name + " · " + item.unit).slice(0, 160),
        quantity: 1,
        partNumber: item.sku,
        url: item.url,
        price: item.offer.stale ? null : item.offer.price,
        fitChecked: false,
        bought: false,
      },
    ],
  };
}
