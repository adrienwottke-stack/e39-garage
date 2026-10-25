import { uid, type Garage } from "./domain";
import {
  baselineLook,
  differences,
  lookSummary,
  tuningSummary,
  type Look,
} from "./studio-domain";
export function createLookProject(
  garage: Garage,
  look: Look,
  name: string,
  component: string,
  taskId: string,
  product: { name: string; url: string; price: string; partNumber: string },
): Garage {
  if (garage.tasks.some((t) => t.id === taskId)) return garage;
  const changes = differences(
    baselineLook(garage.profile, garage.studio),
    look,
  );
  if (!changes.length && !product.name.trim())
    throw new Error(
      "Verändere zuerst deinen Look, bevor du daraus einen Umbauplan machst.",
    );
  let price: number | null = null;
  if (product.price.trim()) {
    price = Number(product.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0)
      throw new Error("Bitte einen gültigen Preis angeben.");
  }
  let url = "";
  if (product.url.trim()) {
    try {
      const parsed = new URL(product.url);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
      url = parsed.href;
    } catch {
      throw new Error(
        "Bitte einen vollständigen http- oder https-Link angeben.",
      );
    }
  }
  const title = name.trim() || "Mein nächster Look";
  const note = `Gestaltungsentwurf: ${title}\n${lookSummary(look)}\n${tuningSummary(look)}\nGeändert: ${changes.join(", ")}\nLack: ${look.paint}, Haube: ${look.hoodPaint}.\nOptische Studie. Reale Abmessungen, Passform und notwendige Freigaben sind offen.`;
  return {
    ...garage,
    tasks: [
      ...garage.tasks,
      {
        id: taskId,
        title: `Umbauidee: ${title}`,
        componentId: component,
        note,
        dueDate: null,
        dueKm: null,
        intervalMonths: null,
        intervalKm: null,
        source: "Eigener Gestaltungsentwurf; technische Prüfung offen",
        done: false,
        completedEntryId: null,
      },
    ],
    parts: product.name.trim()
      ? [
          ...garage.parts,
          {
            id: uid(),
            taskId,
            name: product.name.trim(),
            quantity: 1,
            partNumber: product.partNumber.trim(),
            url,
            price,
            fitChecked: false,
            bought: false,
          },
        ]
      : garage.parts,
  };
}
