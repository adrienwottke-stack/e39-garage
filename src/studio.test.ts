import { describe, expect, it } from "vitest";
import { emptyGarage, validateGarage } from "./domain";
import {
  baselineLook,
  differences,
  lookSchema,
  photoLook,
  saveLookDraft,
} from "./studio-domain";
import { createLookProject } from "./studio-actions";
describe("Entwürfe und bestehende Fahrzeugakten", () => {
  it("ergänzt alte Format-2-Looks und erhält neue Umbauten in A/B und Sicherung", () => {
    const g = emptyGarage();
    const {
      frontBumper: _f,
      rearBumper: _r,
      frontLip: _l,
      sideSkirts: _s,
      spoiler: _p,
      mirrors: _m,
      interiorTrim: _i,
      upholstery: _u,
      ...legacyLook
    } = photoLook();
    const legacy = {
      ...g,
      version: 2,
      studio: {
        ...g.studio,
        drafts: [
          {
            id: "A",
            name: "Alter Entwurf",
            savedAt: new Date().toISOString(),
            look: legacyLook,
          },
        ],
      },
    };
    const upgraded = validateGarage(legacy);
    expect(upgraded.studio.drafts[0].look).toMatchObject({
      frontBumper: "photo",
      spoiler: "none",
      interiorTrim: "silver",
    });
    const tuned = {
      ...photoLook(),
      frontLip: true,
      spoiler: "ducktail" as const,
      upholstery: "cognac" as const,
    };
    const saved = validateGarage(
      JSON.parse(
        JSON.stringify({
          ...upgraded,
          studio: saveLookDraft(upgraded.studio, "B", "Umbau", tuned),
        }),
      ),
    );
    expect(saved.studio.drafts[0].name).toBe("Alter Entwurf");
    expect(saved.studio.drafts[1].look).toEqual(tuned);
    expect(differences(photoLook(), tuned)).toEqual([
      "Frontlippe",
      "Heckspoiler",
      "Innenraum",
    ]);
    expect(() => lookSchema.parse({ ...tuned, spoiler: "unknown" })).toThrow();
  });
  it("liest alte Akten ohne Verlust von Historie oder Profil", () => {
    const g = emptyGarage();
    const { studio: _, ...old } = g;
    const upgraded = validateGarage({
      ...old,
      version: 1,
      profile: { ...old.profile, notes: "Bestehende eigene Notiz" },
    });
    expect(upgraded.version).toBe(3);
    expect(upgraded.profile.notes).toBe("Bestehende eigene Notiz");
    expect(upgraded.studio.drafts).toEqual([]);
  });
  it("speichert unabhängige A/B-Schnappschüsse und ersetzt nur den gewählten Platz", () => {
    const g = emptyGarage(),
      look = photoLook();
    let studio = saveLookDraft(g.studio, "A", "Blau", look);
    look.paint = "#ffffff";
    studio = saveLookDraft(studio, "B", "Weiß", look);
    expect(studio.drafts[0].look.paint).toBe("#254b87");
    studio = saveLookDraft(studio, "A", "Silber", {
      ...look,
      paint: "#c0c6ce",
    });
    expect(studio.drafts).toHaveLength(2);
    expect(studio.drafts[1].name).toBe("Weiß");
    expect(studio.baseline).toBeNull();
  });
  it("bewahrt einen bereits eingestellten individuellen Lack als Ausgangspunkt", () => {
    const g = emptyGarage();
    expect(
      baselineLook({ ...g.profile, paint: "#123456" }, g.studio).paint,
    ).toBe("#123456");
  });
  it("weist beschädigte oder doppelte Entwürfe zurück", () => {
    const g = emptyGarage();
    const studio = saveLookDraft(g.studio, "A", "Test", photoLook());
    expect(() =>
      validateGarage({
        ...g,
        studio: { ...studio, drafts: [...studio.drafts, ...studio.drafts] },
      }),
    ).toThrow("Doppelte");
    expect(() => lookSchema.parse({ ...photoLook(), lowering: 100 })).toThrow();
    expect(() => lookSchema.parse({ ...photoLook(), wheelSize: 22 })).toThrow();
  });
  it("erkennt auch Material, Licht und Haubenfarbe als Änderungen", () => {
    const look = photoLook();
    expect(differences(look, look)).toEqual([]);
    expect(
      differences(look, {
        ...look,
        hoodPaint: "#ffffff",
        finish: "satin",
        lights: true,
      }),
    ).toEqual(["Haubenfarbe", "Lackoberfläche", "Lichtansicht"]);
  });
});
describe("Vom Look zum Umbauplan", () => {
  const product = {
    name: "Synthetischer Felgensatz",
    url: "https://example.com/felgen",
    price: "123,45",
    partNumber: "TEST",
  };
  it("plant atomar, ohne Historie, Istlook oder Passformbestätigung zu erfinden", () => {
    const g = emptyGarage(),
      look = { ...baselineLook(g.profile, g.studio), wheelSize: 18 as const };
    const next = createLookProject(
      g,
      look,
      "Idee",
      "wheels",
      "test-task",
      product,
    );
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].done).toBe(false);
    expect(next.parts[0]).toMatchObject({
      taskId: "test-task",
      fitChecked: false,
      bought: false,
      price: 123.45,
    });
    expect(next.entries).toEqual(g.entries);
    expect(next.studio).toEqual(g.studio);
    expect(g.tasks).toHaveLength(0);
    expect(
      createLookProject(next, look, "Idee", "wheels", "test-task", product),
    ).toBe(next);
  });
  it("lehnt unsichere Links und ungültige Preise ab", () => {
    const g = emptyGarage(),
      look = { ...photoLook(), lowering: 20 };
    expect(() =>
      createLookProject(g, look, "Idee", "wheels", "test-task", {
        ...product,
        url: "javascript:alert(1)",
      }),
    ).toThrow("Link");
    expect(() =>
      createLookProject(g, look, "Idee", "wheels", "test-task", {
        ...product,
        price: "-5",
      }),
    ).toThrow("Preis");
  });
  it("übernimmt die konkrete Anbauteil-Auswahl in den Plan", () => {
    const g = emptyGarage();
    const next = createLookProject(
      g,
      {
        ...photoLook(),
        frontLip: true,
        spoiler: "ducktail",
        interiorTrim: "dark",
      },
      "Wochenend-Idee",
      "body",
      "tuning-plan",
      { name: "", url: "", price: "", partNumber: "" },
    );
    expect(next.tasks[0].note).toContain("Heckspoiler: Ducktail");
    expect(next.tasks[0].note).toContain("Frontlippe: ja");
    expect(next.tasks[0].note).toContain("dunkle Leisten");
    expect(next.parts).toEqual([]);
    expect(next.studio).toEqual(g.studio);
  });
});
