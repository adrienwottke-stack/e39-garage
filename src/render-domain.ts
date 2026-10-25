import { z } from "zod";

export const renderSchema = z.object({
  environment: z
    .enum(["workshop", "pearl", "graphite", "sunset"])
    .default("workshop"),
  format: z.enum(["wide", "classic", "square", "portrait"]).default("wide"),
  quality: z.enum(["hd", "large"]).default("hd"),
  focal: z.union([z.literal(35), z.literal(50), z.literal(85)]).default(50),
  exposure: z.number().min(0.6).max(1.6).default(1),
  lightAngle: z.number().min(-180).max(180).default(25),
  reflection: z.boolean().default(false),
});
export type RenderSettings = z.infer<typeof renderSchema>;
export type CaptureOptions = { width?: number; height?: number };
export type Capture = (options?: CaptureOptions) => Promise<Blob>;
export const defaultRender = (): RenderSettings => renderSchema.parse({});
export const environments = [
  {
    id: "workshop",
    name: "Tuning-Garage",
    detail: "Dunkle Werkstatt · breite Lichtbänder · matter Stahlboden",
    color: "#111820",
    floor: "#303840",
    key: "#f2f5f7",
    fill: "#c5d9e9",
    intensity: 1.7,
  },
  {
    id: "pearl",
    name: "Lichtstudio",
    detail: "Weiches Tageslicht · heller Beton",
    color: "#c5c8ca",
    floor: "#a0a4a7",
    key: "#ffffff",
    fill: "#dceaff",
    intensity: 1.5,
  },
  {
    id: "graphite",
    name: "Nachtstudio",
    detail: "Dunkler Raum · klare Lichtkanten",
    color: "#202831",
    floor: "#2c343e",
    key: "#d9eaff",
    fill: "#80a9d0",
    intensity: 2.2,
  },
  {
    id: "sunset",
    name: "Abendlicht",
    detail: "Warmes Seitenlicht · kühle Schatten",
    color: "#a69b90",
    floor: "#827d79",
    key: "#ffd4a2",
    fill: "#acc8e7",
    intensity: 1.8,
  },
] as const;
export const formats = [
  { id: "wide", name: "Breitbild", ratio: "16 / 9" },
  { id: "classic", name: "Foto", ratio: "3 / 2" },
  { id: "square", name: "Quadrat", ratio: "1 / 1" },
  { id: "portrait", name: "Hochformat", ratio: "2 / 3" },
] as const;

export function exportSize(settings: RenderSettings, maxEdge = 8192) {
  const sizes = {
    wide: { hd: [1920, 1080], large: [3840, 2160] },
    classic: { hd: [1800, 1200], large: [3000, 2000] },
    square: { hd: [1440, 1440], large: [2880, 2880] },
    portrait: { hd: [1080, 1620], large: [2160, 3240] },
  } as const;
  const [width, height] = sizes[settings.format][settings.quality];
  if (Math.max(width, height) > maxEdge)
    throw new Error(
      "Diese Auflösung ist auf deinem Gerät nicht verfügbar. Wähle die kleinere Bildgröße.",
    );
  return { width, height };
}

export function renderFilename(name: string, settings: RenderSettings) {
  const safe =
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "Mein-E39";
  const { width, height } = exportSize(settings);
  return `E39-${safe}-${settings.environment}-${width}x${height}.png`;
}
