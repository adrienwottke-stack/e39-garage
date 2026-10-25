import { describe, expect, it } from "vitest";
import { brakeDimensions, brakeHatGeometry, brakeVentGeometry, caliperGeometry, frictionRingGeometry } from "./brake-geometry";

describe("Plain vented brake reconstruction", () => {
  it("keeps both friction plates separated with outward-facing normals and an open ventilation gap", () => {
    for (const front of [true, false]) {
      const d = brakeDimensions(front);
      const outer = frictionRingGeometry(front, true), inner = frictionRingGeometry(front, false);
      outer.computeBoundingBox(); inner.computeBoundingBox();
      expect(outer.boundingBox!.min.z - inner.boundingBox!.max.z).toBeGreaterThan(0.013);
      for (const [g, expected] of [[outer, 1], [inner, -1]] as const) {
        const p = g.getAttribute("position"), n = g.getAttribute("normal");
        let faceVertices = 0;
        for (let i = 0; i < p.count; i++) {
          const radius = Math.hypot(p.getX(i), p.getY(i));
          if (radius > d.innerRadius + 0.006 && radius < d.outerRadius - 0.006) {
            expect(n.getZ(i) * expected).toBeGreaterThan(0.99);
            faceVertices++;
          }
        }
        expect(faceVertices).toBeGreaterThan(400);
      }
      const vanes = brakeVentGeometry(front);
      vanes.computeBoundingBox();
      expect(vanes.boundingBox!.min.z).toBeGreaterThan(d.back);
      expect(vanes.boundingBox!.max.z).toBeLessThan(d.front);
      expect(vanes.getIndex()!.count / 3).toBe(40 * 12);
      outer.dispose(); inner.dispose(); vanes.dispose();
    }
  });
  it("clears the smallest rim and keeps all cast geometry behind the visible spokes", () => {
    const smallestInnerBarrel = 17 * 0.0254 / 2 - 0.021;
    for (const front of [true, false]) {
      for (const g of [caliperGeometry(front), caliperGeometry(front, true), brakeHatGeometry(front)]) {
        const p = g.getAttribute("position"), n = g.getAttribute("normal");
        for (let i = 0; i < p.count; i++) {
          expect([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(p.getX(i), p.getY(i))).toBeLessThan(smallestInnerBarrel - 0.005);
          expect(p.getZ(i)).toBeLessThan(0.057);
        }
        g.dispose();
      }
    }
  });
});
