import { z } from "zod";
import { bumperIds, wheelStyleIds, wheelDesigns, frontBumpers, rearBumpers, trimNames, upholsteryNames, steeringNames, shiftNames } from "./tuning-parts";

export const lookSchema = z.object({
  paint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hoodPaint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  finish: z.enum(["gloss", "satin"]),
  wheelStyle: z.enum(wheelStyleIds),
  wheelFinish: z.enum(["silver", "graphite", "bronze"]),
  wheelSize: z.union([z.literal(17), z.literal(18), z.literal(19)]),
  lowering: z.number().int().min(0).max(55),
  trim: z.enum(["black", "chrome"]),
  caliper: z.enum(["graphite", "red", "blue"]),
  lights: z.boolean(),
  frontBumper: z.enum(bumperIds).default("photo"),
  rearBumper: z.enum(bumperIds).default("photo"),
  frontLip: z.boolean().default(false),
  sideSkirts: z.boolean().default(false),
  spoiler: z.enum(["none", "lip", "ducktail"]).default("none"),
  mirrors: z.enum(["body", "black"]).default("body"),
  interiorTrim: z.enum(["silver", "dark", "brushed", "walnut", "piano-black", "carbon"]).default("silver"),
  upholstery: z.enum(["anthracite", "cognac", "ivory", "burgundy", "alcantara", "tartan"]).default("anthracite"),
  steeringWheel: z.enum(["oem", "sport", "flat-bottom", "three-spoke"]).default("oem"),
  shiftKnob: z.enum(["leather", "short", "billet", "wood"]).default("leather"),
});
export const draftSchema = z.object({
  id: z.enum(["A", "B"]),
  name: z.string().min(1).max(60),
  savedAt: z.string().datetime(),
  look: lookSchema,
});
export const studioSchema = z
  .object({
    baseline: lookSchema.nullable().default(null),
    baselineConfirmed: z.boolean().default(false),
    drafts: z.array(draftSchema).max(2).default([]),
  })
  .default({ baseline: null, baselineConfirmed: false, drafts: [] });
export type Look = z.infer<typeof lookSchema>;
export type Studio = z.infer<typeof studioSchema>;
export type LookDraft = z.infer<typeof draftSchema>;
export type CameraView = "front" | "side" | "rear" | "wheel" | "interior" | "engine";
export const wheelStyles = wheelDesigns.map(w => ({ ...w, spokes: w.spokes * w.split }));
export const wheelFinishes = {
  silver: "#b9c3cd",
  graphite: "#40464e",
  bronze: "#9c7952",
};
export const finishNames = {
  silver: "Silber",
  graphite: "Graphit",
  bronze: "Bronze",
};
export function photoLook(): Look {
  return {
    paint: "#254b87",
    hoodPaint: "#254b87",
    finish: "gloss",
    wheelStyle: "photo",
    wheelFinish: "silver",
    wheelSize: 17,
    lowering: 25,
    trim: "black",
    caliper: "graphite",
    lights: false,
    frontBumper: "photo",
    rearBumper: "photo",
    frontLip: false,
    sideSkirts: false,
    spoiler: "none",
    mirrors: "body",
    interiorTrim: "silver",
    upholstery: "anthracite",
    steeringWheel: "oem",
    shiftKnob: "leather",
  };
}
export function lookIdeas(
  baseline: Look,
): { id: string; name: string; detail: string; look: Look }[] {
  const clean = { ...baseline, hoodPaint: baseline.paint };
  return [
    {
      id: "subtle",
      name: "Dezent",
      detail: "Doppelspeiche · Silber · 18″",
      look: {
        ...clean,
        wheelStyle: "double-five",
        wheelFinish: "silver",
        wheelSize: 18,
        lowering: 20,
        trim: "black",
      },
    },
    {
      id: "classic",
      name: "Classic",
      detail: "Kreuzspeiche · Silber · 18″",
      look: {
        ...clean,
        wheelStyle: "mesh",
        wheelFinish: "silver",
        wheelSize: 18,
        lowering: 25,
        trim: "chrome",
      },
    },
    {
      id: "shadow",
      name: "Shadow",
      detail: "Vielspeiche · Graphit · 19″",
      look: {
        ...clean,
        wheelStyle: "radial",
        wheelFinish: "graphite",
        wheelSize: 19,
        lowering: 35,
        trim: "black",
        lights: true,
      },
    },
    {
      id: "bronze",
      name: "Bronze",
      detail: "Kreuzspeiche · Bronze · 18″",
      look: {
        ...clean,
        wheelStyle: "mesh",
        wheelFinish: "bronze",
        wheelSize: 18,
        lowering: 30,
        trim: "black",
      },
    },
  ];
}
export function baselineLook(
  profile: { paint: string; hoodPaint: string },
  studio: Studio,
): Look {
  const untouched =
    profile.paint === "#234864" && profile.hoodPaint === "#234864";
  return (
    studio.baseline ??
    (untouched
      ? photoLook()
      : { ...photoLook(), paint: profile.paint, hoodPaint: profile.hoodPaint })
  );
}
export function lookSummary(look: Look) {
  return `${wheelStyles.find((w) => w.id === look.wheelStyle)!.name} · ${look.wheelSize}″ · ${finishNames[look.wheelFinish]} · ${look.lowering ? "−" + look.lowering + " mm" : "Ausgangshöhe"}`;
}
export function tuningSummary(look: Look) {
  return [
    `Front: ${frontBumpers.find(p => p.id === look.frontBumper)!.name}`,
    `Heck: ${rearBumpers.find(p => p.id === look.rearBumper)!.name}`,
    `Frontlippe: ${look.frontLip ? "ja" : "nein"}`,
    `Schwelleransätze: ${look.sideSkirts ? "ja" : "nein"}`,
    `Heckspoiler: ${{ none: "ohne", lip: "dezente Lippe", ducktail: "Ducktail" }[look.spoiler]}`,
    `Spiegel: ${look.mirrors === "black" ? "schwarz" : "Wagenfarbe"}`,
    `Innenraum: ${trimNames[look.interiorTrim]} Leisten, ${upholsteryNames[look.upholstery]}`,
    `Lenkrad: ${steeringNames[look.steeringWheel]}`,
    `Schaltknauf: ${shiftNames[look.shiftKnob]}`,
  ].join(" · ");
}
export function saveLookDraft(
  studio: Studio,
  id: "A" | "B",
  name: string,
  look: Look,
): Studio {
  const checked = lookSchema.parse(look);
  return {
    ...studio,
    drafts: [
      ...studio.drafts.filter((d) => d.id !== id),
      {
        id,
        name: name.trim() || `Entwurf ${id}`,
        savedAt: new Date().toISOString(),
        look: { ...checked },
      },
    ].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export function differences(a: Look, b: Look): string[] {
  const result: string[] = [];
  if (a.paint !== b.paint) result.push("Karosseriefarbe");
  if (a.hoodPaint !== b.hoodPaint) result.push("Haubenfarbe");
  if (a.finish !== b.finish) result.push("Lackoberfläche");
  if (
    a.wheelStyle !== b.wheelStyle ||
    a.wheelSize !== b.wheelSize ||
    a.wheelFinish !== b.wheelFinish
  )
    result.push("Räder");
  if (a.lowering !== b.lowering) result.push("Fahrzeughöhe");
  if (a.trim !== b.trim) result.push("Nieren & Zierleisten");
  if (a.caliper !== b.caliper) result.push("Bremssattelfarbe");
  if (a.lights !== b.lights) result.push("Lichtansicht");
  if (a.frontBumper !== b.frontBumper) result.push("Frontstoßfänger");
  if (a.rearBumper !== b.rearBumper) result.push("Heckstoßfänger");
  if (a.frontLip !== b.frontLip) result.push("Frontlippe");
  if (a.sideSkirts !== b.sideSkirts) result.push("Schwelleransätze");
  if (a.spoiler !== b.spoiler) result.push("Heckspoiler");
  if (a.mirrors !== b.mirrors) result.push("Spiegelkappen");
  if (a.interiorTrim !== b.interiorTrim || a.upholstery !== b.upholstery)
    result.push("Innenraum");
  if (a.steeringWheel !== b.steeringWheel) result.push("Lenkrad");
  if (a.shiftKnob !== b.shiftKnob) result.push("Schaltknauf");
  return result;
}
