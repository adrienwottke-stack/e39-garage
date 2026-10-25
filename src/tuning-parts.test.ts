import { describe, expect, it } from "vitest";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { frontBumpers, rearBumpers, wheelDesigns } from "./tuning-parts";
import { frontStudyShapes, rearStudyShapes, studyPanelGeometry, wheelSpokeGeometry, exhaustCenters, rearReturnGeometry, rearSurfaceZ } from "./tuning-parts-geometry";
import { differences, lookSchema, photoLook, saveLookDraft, tuningSummary } from "./studio-domain";
import { emptyGarage, validateGarage } from "./domain";

function signature(g: T.BufferGeometry) {
  let hash = 2166136261;
  const p = g.getAttribute("position");
  for (const v of p.array) hash = Math.imul(hash ^ Math.round(v * 1e6), 16777619);
  return `${p.count}:${hash >>> 0}`;
}
function finite(g: T.BufferGeometry) {
  return ["position", "normal"].every(name => [...g.getAttribute(name).array].every(Number.isFinite));
}
describe("Tuning studies are saved options backed by geometry", () => {
  it("keeps the actual rear crash bar behind the replacement shell", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read("public/models/e39-body-9651faf179e2.glb");
    const body = doc.getRoot().listNodes().find(n => n.getName() === "pab_e39_body")!;
    const primitive = body.getMesh()!.listPrimitives().find(p => p.getMaterial()?.getName() === "pab_e39_metal")!;
    const p = primitive.getAttribute("POSITION")!;
    let clearance = Infinity;
    for (let i = 0; i < p.getCount(); i++) {
      const [x,y,z] = p.getElement(i, [0,0,0] as [number,number,number]);
      if (z < -2.3 && y > .43 && y < .599) clearance = Math.min(clearance, z - rearSurfaceZ(x,y));
    }
    expect(clearance).toBeGreaterThan(.002);
  });
  it("provides twenty additional front and rear shells with different cut-outs", () => {
    const frontSignatures = new Set<string>(), rearSignatures = new Set<string>();
    expect(frontBumpers).toHaveLength(22); expect(rearBumpers).toHaveLength(22);
    for (const spec of frontBumpers.filter(p => !["photo", "standard"].includes(p.id))) {
      const shapes = frontStudyShapes(spec), g = studyPanelGeometry(shapes.shell, false);
      expect(finite(g), spec.id).toBe(true);
      expect(shapes.shell.holes).toHaveLength(spec.vent === "none" ? 1 : 3);
      // Apertures stay inside the shell and do not overlap their neighbours.
      const mouth = new T.Box2().setFromPoints(shapes.mouth.getPoints(24));
      expect(mouth.min.y).toBeGreaterThan(.162); expect(mouth.max.y).toBeLessThan(.43);
      for (const vent of shapes.vents) {
        const b = new T.Box2().setFromPoints(vent.getPoints(24));
        expect(Math.max(Math.abs(b.min.x), Math.abs(b.max.x))).toBeLessThan(.833);
        expect(b.max.x < mouth.min.x || b.min.x > mouth.max.x).toBe(true);
      }
      frontSignatures.add(signature(g)); g.dispose();
    }
    for (const spec of rearBumpers.filter(p => !["photo", "standard"].includes(p.id))) {
      const shapes = rearStudyShapes(spec), g = studyPanelGeometry(shapes.shell, true);
      expect(finite(g), spec.id).toBe(true);
      const mouth = new T.Box2().setFromPoints(shapes.mouth.getPoints(24));
      expect(mouth.min.y).toBeGreaterThan(.162); expect(mouth.max.y).toBeLessThan(.414);
      const tips = exhaustCenters(spec.exhaust);
      expect(tips.every(x => Math.abs(x) + .045 < .82)).toBe(true);
      rearSignatures.add(signature(g)); g.dispose();
    }
    expect(frontSignatures.size).toBe(20); expect(rearSignatures.size).toBe(20);
  });
  it("has twenty distinct wheel structures with finite surfaces within the tire", () => {
    const signatures = new Set<string>();
    expect(wheelDesigns).toHaveLength(20);
    for (const spec of wheelDesigns) {
      for (const size of [17, 19]) {
        const g = wheelSpokeGeometry(spec, size * .0254 / 2), p = g.getAttribute("position");
        expect(finite(g), spec.id).toBe(true);
        let radius = 0;
        for (let i = 0; i < p.count; i++) radius = Math.max(radius, Math.hypot(p.getX(i), p.getY(i)));
        expect(radius).toBeLessThan(.25);
        if (size === 17) signatures.add(`${signature(g)}:${spec.spokes}:${spec.split}:${spec.profile}`);
        g.dispose();
      }
    }
    expect(signatures.size).toBe(20);
    for (const side of [-1, 1]) { const g = rearReturnGeometry(side); expect(finite(g)).toBe(true); g.dispose(); }
  });
  it("loads format-3 looks without new fields and preserves every new choice in A/B and backup", () => {
    const { steeringWheel: _s, shiftKnob: _k, ...old } = photoLook();
    const look = lookSchema.parse(old);
    expect(look.steeringWheel).toBe("oem"); expect(look.shiftKnob).toBe("leather");
    const tuned = { ...look, frontBumper: "track-endurance" as const, rearBumper: "aero-split" as const, wheelStyle: "aero-slot" as const, interiorTrim: "walnut" as const, upholstery: "tartan" as const, steeringWheel: "flat-bottom" as const, shiftKnob: "billet" as const };
    const garage = emptyGarage();
    const saved = validateGarage(JSON.parse(JSON.stringify({ ...garage, studio: saveLookDraft(garage.studio, "A", "Club", tuned) })));
    expect(saved.studio.drafts[0].look).toEqual(tuned);
    expect(differences(look, tuned)).toEqual(["Räder", "Frontstoßfänger", "Heckstoßfänger", "Innenraum", "Lenkrad", "Schaltknauf"]);
    expect(tuningSummary(tuned)).toContain("Endurance 04"); expect(tuningSummary(tuned)).toContain("Aluminiumknauf");
    expect(saved.entries).toEqual(garage.entries);
    expect(() => lookSchema.parse({ ...tuned, frontBumper: "fake-sku" })).toThrow();
  });
});
