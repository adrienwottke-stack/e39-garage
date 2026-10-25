import * as T from "three";

// Measured against the fitted source geometry, in the app's metre coordinates.
// Gauge zero positions are a static modelling reference, not live vehicle data.
export const cabinFit = {
  steering: [ .383964, .887655, .231851 ] as const,
  radio: [ 0, .754, .356 ] as const,
  climate: [ 0, .6345, .345 ] as const,
  shifter: [ .0134, .5575, .1686 ] as const,
  gauges: [
    { key: "speed", x: .43912, y: .91178, z: .4885, radius: .0495, max: 260, major: 13, label: "km/h" },
    { key: "rpm", x: .32594, y: .91178, z: .4885, radius: .0495, max: 7, major: 7, label: "1/min ×1000" },
    { key: "fuel", x: .51906, y: .87489, z: .4753, radius: .0236, max: 1, major: 2, label: "1/2" },
    { key: "temp", x: .24385, y: .87318, z: .4749, radius: .0236, max: 1, major: 2, label: "°C" },
  ],
};

export function gaugeAngle(fraction: number) {
  // Starts at lower left as seen by the driver (the faces look toward -Z).
  return Math.PI * (1.25 - 1.5 * fraction);
}

function reflectGeometryX(geometry: T.BufferGeometry) {
  geometry.scale(-1, 1, 1);
  // A reflection reverses face winding. Reverse the indices (or the complete
  // unindexed vertices) as well so the driver's-facing surfaces stay visible.
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const first = index.getX(i);
      index.setX(i, index.getX(i + 2)); index.setX(i + 2, first);
    }
  } else {
    for (const attribute of Object.values(geometry.attributes)) {
      const a = attribute as T.BufferAttribute;
      for (let i = 0; i < a.count; i += 3) {
        const first = a.array.slice(i * a.itemSize, (i + 1) * a.itemSize);
        for (let k = 0; k < a.itemSize; k++) {
          a.array[i * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k];
          a.array[(i + 2) * a.itemSize + k] = first[k];
        }
      }
    }
  }
}

export function createWheelSpoke(side: -1 | 1 | 0) {
  const shape = new T.Shape();
  if (side === 0) {
    shape.moveTo(-.040, -.039); shape.quadraticCurveTo(-.031, -.083, -.025, -.148);
    shape.quadraticCurveTo(0, -.157, .025, -.148);
    shape.quadraticCurveTo(.031, -.083, .040, -.039); shape.closePath();
  } else {
    shape.moveTo(.044, .024); shape.quadraticCurveTo(.095, .034, .144, .031);
    shape.quadraticCurveTo(.158, .013, .150, -.012);
    shape.quadraticCurveTo(.094, -.037, .049, -.042); shape.closePath();
  }
  const g = new T.ExtrudeGeometry(shape, { depth: .019, bevelEnabled: true, bevelSize: .004, bevelThickness: .003, bevelSegments: 3, curveSegments: 14 });
  g.translate(0, 0, -.0095);
  if (side === -1) reflectGeometryX(g);
  g.normalizeNormals();
  g.computeBoundingBox();
  return g;
}

export function createShiftKnob() {
  const profile = [new T.Vector2(.0105, 0), new T.Vector2(.0115, .009), new T.Vector2(.013, .025), new T.Vector2(.018, .053), new T.Vector2(.022, .064), new T.Vector2(.023, .072), new T.Vector2(.020, .077), new T.Vector2(.0145, .079)];
  const g = new T.LatheGeometry(profile, 48);
  g.normalizeNormals();
  g.computeBoundingBox();
  return g;
}
