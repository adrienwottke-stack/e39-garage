import * as T from "three";
import { lathedGeometry } from "./wheel-geometry";

// Proportions only: a plain, internally vented road-car brake. These dimensions
// do not identify a purchasable disc, brake package or verified vehicle fitment.
export function brakeDimensions(front: boolean) {
  return { outerRadius: front ? 0.159 : 0.149, innerRadius: front ? 0.081 : 0.075,
    back: 0.003, front: 0.027, hatFront: 0.038, caliperOuter: front ? 0.184 : 0.174 };
}

export function frictionRingGeometry(front: boolean, outside: boolean) {
  const d = brakeDimensions(front), face = outside ? d.front : d.back;
  const depth = outside ? -0.005 : 0.005;
  const profile: [number, number][] = [[d.innerRadius, face + depth]];
  profile.push([d.outerRadius - 0.001, face + depth], [d.outerRadius, face + depth / 2]);
  profile.push([d.outerRadius - 0.0006, face]);
  // Fine concentric machining is actual relief, far below the tread/groove scale.
  for (let i = 0; i <= 8; i++) {
    const r = d.outerRadius - 0.001 - (d.outerRadius - d.innerRadius - 0.001) * i / 8;
    profile.push([r, face + (outside ? 1 : -1) * (i % 2 ? 0.000016 : 0)]);
  }
  profile.push([d.innerRadius, face + depth]);
  return lathedGeometry(outside ? profile : profile.reverse(), 96);
}

export function brakeHatGeometry(front: boolean) {
  const d = brakeDimensions(front);
  return lathedGeometry([
    [0.030, d.back - 0.001], [d.innerRadius + 0.003, d.back - 0.001],
    [d.innerRadius + 0.003, d.front - 0.002], [d.innerRadius - 0.007, d.front + 0.001],
    [d.innerRadius - 0.015, d.hatFront - 0.002], [d.innerRadius - 0.018, d.hatFront],
    [0.030, d.hatFront], [0.028, d.hatFront - 0.002],
    [0.028, d.back + 0.001], [0.030, d.back - 0.001],
  ]);
}

export function brakeVentGeometry(front: boolean) {
  const d = brakeDimensions(front), vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i < 40; i++) {
    const angle = i * Math.PI * 2 / 40, a = vertices.length / 3;
    for (const z of [d.back + 0.0045, d.front - 0.0045]) {
      for (const [r, offset] of [[d.innerRadius, -0.010], [d.outerRadius - 0.0008, -0.008],
        [d.outerRadius - 0.0008, 0.008], [d.innerRadius, 0.010]]) {
        vertices.push(Math.cos(angle + offset) * r, Math.sin(angle + offset) * r, z);
      }
    }
    for (const face of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
      [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) {
      indices.push(a + face[0], a + face[2], a + face[1], a + face[0], a + face[3], a + face[2]);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function caliperGeometry(front: boolean, carrier = false) {
  const s = new T.Shape(), scale = front ? 1 : 0.94;
  s.moveTo(0.132, -0.057);
  s.bezierCurveTo(0.153, -0.063, 0.176, -0.041, 0.178, -0.022);
  s.lineTo(0.178, 0.025);
  s.bezierCurveTo(0.173, 0.047, 0.153, 0.063, 0.132, 0.057);
  s.lineTo(0.119, 0.036);
  s.bezierCurveTo(0.112, 0.024, 0.112, -0.024, 0.119, -0.036);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: carrier ? 0.020 : 0.035, steps: 1, curveSegments: 12,
    bevelEnabled: true, bevelSize: carrier ? 0.003 : 0.0055,
    bevelThickness: carrier ? 0.003 : 0.0055, bevelSegments: 3,
  });
  g.scale(scale, scale, 1);
  g.translate(0, 0, carrier ? -0.002 : 0.014);
  return g;
}
