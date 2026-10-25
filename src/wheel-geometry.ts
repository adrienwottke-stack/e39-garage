import * as T from "three";
import {conformingTessellation} from "./mesh-subdivision";

// Visual proportions reconstructed from the supplied photos, not measured fitment.
// Changing the selected rim diameter must never move the car or enlarge the tire.
export const visualTireRadius = 0.308;
export const wheelAxles = [-1.495, 1.35] as const;
export const wheelTrackHalf = 0.79;

export function photoSpokeGeometry(radius: number) {
  const s = new T.Shape(), k = radius / 0.216;
  s.moveTo(-0.033, 0.044);
  s.bezierCurveTo(-0.039, 0.09, -0.047, 0.155 * k, -0.067, 0.195 * k);
  s.bezierCurveTo(-0.070, 0.207 * k, -0.045, 0.213 * k, -0.037, 0.202 * k);
  s.bezierCurveTo(-0.027, 0.177 * k, -0.023, 0.143 * k, -0.015, 0.12 * k);
  s.bezierCurveTo(-0.011, 0.107 * k, 0.011, 0.107 * k, 0.015, 0.12 * k);
  s.bezierCurveTo(0.023, 0.143 * k, 0.027, 0.177 * k, 0.037, 0.202 * k);
  s.bezierCurveTo(0.045, 0.213 * k, 0.070, 0.207 * k, 0.067, 0.195 * k);
  s.bezierCurveTo(0.047, 0.155 * k, 0.039, 0.09, 0.033, 0.044);
  s.closePath();
  const source = new T.ExtrudeGeometry(s, {
    depth: 0.014, steps: 1, curveSegments: 12, bevelEnabled: true,
    bevelSegments: 3, bevelSize: 0.0038, bevelThickness: 0.0038,
  });
  const g = conformingTessellation(source);
  source.dispose();
  const p = g.getAttribute("position"), n = g.getAttribute("normal");
  for (let i = 0; i < p.count; i++) {
    const radial = Math.hypot(p.getX(i), p.getY(i));
    const t = T.MathUtils.smoothstep(radial, 0.055, radius * 0.94);
    p.setZ(i, p.getZ(i) + 0.045 + 0.039 * t + 0.005 * Math.sin(t * Math.PI));
    const u = T.MathUtils.clamp((radial - 0.055) / (radius * 0.94 - 0.055), 0, 1);
    const derivative = (0.039 + 0.005 * Math.PI * Math.cos(t * Math.PI)) *
      6 * u * (1 - u) / (radius * 0.94 - 0.055);
    const nz = n.getZ(i);
    n.setXYZ(i, n.getX(i) - derivative * p.getX(i) / radial * nz,
      n.getY(i) - derivative * p.getY(i) / radial * nz, nz);
  }
  // Transform the original bevel normals rather than averaging the tessellation.
  g.normalizeNormals();
  g.computeBoundingBox();
  return g;
}

export function designSpokeGeometry(radius: number, style: "double-five" | "radial" | "mesh") {
  const s = new T.Shape();
  const width = style === "radial" ? 0.006 : style === "mesh" ? 0.007 : 0.011;
  const sweep = style === "mesh" ? 0.027 : 0.004;
  s.moveTo(-width, 0.048);
  s.quadraticCurveTo(-width * 1.1, radius * 0.54, -width + sweep, radius - 0.012);
  s.lineTo(width + sweep, radius - 0.012);
  s.quadraticCurveTo(width * 0.9, radius * 0.54, width, 0.048);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: 0.016, steps: 1, curveSegments: 10, bevelEnabled: true,
    bevelSegments: 3, bevelSize: 0.0025, bevelThickness: 0.0025,
  });
  g.translate(0, 0, 0.073);
  return g;
}

function grooveDepth(z: number) {
  const distance = Math.min(...[-0.044, -0.015, 0.015, 0.044].map(c => Math.abs(z - c)));
  return 0.0042 * (1 - T.MathUtils.smoothstep(distance, 0.0011, 0.0033));
}

export function tireProfile(radius: number) {
  const treadZ = new Set<number>();
  for (let i = 0; i <= 8; i++) treadZ.add(Number((-0.064 + 0.128 * i / 8).toFixed(7)));
  for (const c of [-0.044, -0.015, 0.015, 0.044]) {
    for (const d of [-0.0033, -0.0011, 0, 0.0011, 0.0033]) treadZ.add(Number((c + d).toFixed(7)));
  }
  const values = [
    [radius - 0.007, -0.079], [radius - 0.003, -0.086],
    [radius + 0.005, -0.099], [radius + 0.012, -0.107],
    [radius + 0.030, -0.110], [0.278, -0.109], [0.289, -0.103],
    [0.297, -0.094], [0.303, -0.082], [0.307, -0.067],
    ...[...treadZ].sort((a, b) => a - b).map(z => [visualTireRadius - grooveDepth(z), z]),
    [0.307, 0.067], [0.303, 0.082], [0.297, 0.094],
    [0.289, 0.103], [0.278, 0.109], [radius + 0.030, 0.110],
    [radius + 0.029, 0.1102], [radius + 0.028, 0.1106],
    [radius + 0.027, 0.1102], [radius + 0.026, 0.110],
    [radius + 0.019, 0.109], [radius + 0.018, 0.1094],
    [radius + 0.017, 0.109], [radius + 0.012, 0.107],
    [radius + 0.005, 0.099], [radius - 0.003, 0.086],
    [radius - 0.007, 0.079], [radius - 0.011, 0.069],
    [radius - 0.011, -0.069], [radius - 0.007, -0.079],
  ];
  return values.map(([r, z]) => new T.Vector2(r, z));
}

// Closed carcass with grooves recessed into its tread. No floating tread boxes,
// brand lettering or invented tire specification. All coordinates are in meters.
export function tireGeometry(radius: number, segments = 192) {
  const profile = tireProfile(radius), p: number[] = [], uv: number[] = [], indices: number[] = [];
  const rows = profile.length;
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    for (let j = 0; j < rows; j++) {
      const sample = profile[j], z = sample.y;
      // The sweep is continuous at the circumference seam (48 whole pitches).
      const phase = i / segments * 48 + Math.abs(z) * 18;
      const wave = Math.abs(phase - Math.round(phase));
      const shoulder = T.MathUtils.smoothstep(sample.x, 0.303, 0.307);
      const transverse = (1 - T.MathUtils.smoothstep(wave, 0.025, 0.12)) *
        (1 - T.MathUtils.smoothstep(Math.abs(z), 0.057, 0.078)) * shoulder;
      const r = sample.x - 0.0013 * transverse;
      p.push(Math.sin(angle) * r, Math.cos(angle) * r, z);
      uv.push(i / segments, j / (rows - 1));
      if (i < segments && j < rows - 1) {
        const a = i * rows + j, b = a + rows;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Average duplicate seam vertices explicitly; the rest remains smoothly cast.
  const n = g.getAttribute("normal"), v = new T.Vector3(), w = new T.Vector3();
  for (let j = 0; j < rows; j++) {
    v.fromBufferAttribute(n, j).add(w.fromBufferAttribute(n, segments * rows + j)).normalize();
    n.setXYZ(j, v.x, v.y, v.z);
    n.setXYZ(segments * rows + j, v.x, v.y, v.z);
  }
  for (let i = 0; i <= segments; i++) {
    const start = i * rows, end = start + rows - 1;
    v.fromBufferAttribute(n, start).add(w.fromBufferAttribute(n, end)).normalize();
    n.setXYZ(start, v.x, v.y, v.z);
    n.setXYZ(end, v.x, v.y, v.z);
  }
  g.computeBoundingBox();
  return g;
}

export function lathedGeometry(profile: readonly (readonly [number, number])[], segments = 96) {
  return new T.LatheGeometry(profile.map(([r, z]) => new T.Vector2(r, z)), segments)
    .rotateX(Math.PI / 2);
}

export function barrelGeometry(radius: number) {
  return lathedGeometry([
    [radius - 0.005, -0.089], [radius - 0.001, -0.094],
    [radius + 0.002, -0.089], [radius + 0.004, -0.083],
    [radius + 0.004, -0.073], [radius - 0.001, -0.068],
    [radius - 0.010, -0.061], [radius - 0.016, -0.043],
    [radius - 0.016, 0.029], [radius - 0.011, 0.046],
    [radius - 0.006, 0.074], [radius - 0.001, 0.089],
    [radius - 0.010, 0.091], [radius - 0.013, 0.078],
    [radius - 0.017, 0.046], [radius - 0.021, 0.028],
    [radius - 0.021, -0.040], [radius - 0.017, -0.064],
    [radius - 0.008, -0.080], [radius - 0.005, -0.089],
  ]);
}

export function wheelHubGeometry() {
  const shape = new T.Shape();
  shape.absarc(0, 0, 0.077, 0, Math.PI * 2, false);
  const center = new T.Path();
  center.absarc(0, 0, 0.022, 0, Math.PI * 2, true);
  shape.holes.push(center);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, hole = new T.Path();
    hole.absarc(Math.sin(a) * 0.059, Math.cos(a) * 0.059, 0.0115, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return new T.ExtrudeGeometry(shape, {
    depth: 0.018, steps: 1, curveSegments: 16, bevelEnabled: true,
    bevelSize: 0.0013, bevelThickness: 0.0013, bevelSegments: 2,
  }).translate(0, 0, 0.057);
}
