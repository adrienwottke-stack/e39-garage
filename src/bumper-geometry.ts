import * as T from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Photo-derived dimensions in model metres. This is a visual reconstruction,
// not a measured bumper, a purchase-part specification or fitment CAD.
export const FRONT_SKIN_HALF_WIDTH = 0.84;
export const FRONT_SKIN_BOTTOM = 0.162;
export const FRONT_SKIN_TOP = 0.5185;
export const FRONT_PLATE_HOLDER_Z = 2.226;
export const FRONT_PLATE_FACE_Z = 2.238;

export function frontSkinHalfWidthAt(y: number) {
  return FRONT_SKIN_HALF_WIDTH - 0.030 * T.MathUtils.smoothstep(y, 0.430, FRONT_SKIN_TOP);
}

// A broad, quiet section replaces the previous 54 mm sinusoidal bulge. The
// number-plate plane is separately placed ahead of the complete section.
export function frontSurfaceZ(x: number, y: number) {
  const h = T.MathUtils.clamp((y - FRONT_SKIN_BOTTOM) / (FRONT_SKIN_TOP - FRONT_SKIN_BOTTOM), 0, 1);
  const crown = 0.033 * Math.sin(Math.PI * h);
  const lowerShelf = 0.005 * Math.exp(-(((y - 0.185) / 0.025) ** 2));
  const fogPocket = 0.013 * Math.exp(-(((Math.abs(x) - 0.70) / 0.14) ** 2) - ((y - 0.285) / 0.075) ** 2);
  return 2.181 + crown + lowerShelf - 0.12 * (x / 0.89) ** 2 - 0.25 * (x / 0.89) ** 4 - fogPocket;
}

function gradient(x: number, y: number) {
  const h = 0.0001;
  return [
    (frontSurfaceZ(x + h, y) - frontSurfaceZ(x - h, y)) / (2 * h),
    (frontSurfaceZ(x, y + h) - frontSurfaceZ(x, y - h)) / (2 * h),
  ];
}

// Build the front cap and its aperture returns independently. Every cap normal
// comes from the same continuous surface; triangulation cannot add broad waves.
// Holes roll into a real 4 mm rim and a recessed wall instead of ending at a
// floating black plane. Outer edges remain shared with the corner return skin.
export function frontPanelGeometry(shape: T.Shape, depth = 0.065, offset = 0) {
  const source = new T.ShapeGeometry(shape, 48);
  const cap = new TessellateModifier(0.026, 6).modify(source);
  source.dispose();
  const p = cap.getAttribute('position'), n = cap.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), [dx, dy] = gradient(x, y);
    p.setZ(i, frontSurfaceZ(x, y) + offset);
    n.setXYZ(i, -dx, -dy, 1);
  }
  cap.normalizeNormals();

  const contours = shape.extractPoints(48);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const normal = new T.Vector3();
  [contours.shape, ...contours.holes].forEach((raw, contourIndex) => {
    const contour = raw.map(point => point.clone());
    if (contour[0].equals(contour[contour.length - 1])) contour.pop();
    const clockwise = T.ShapeUtils.isClockWise(contour);
    if ((contourIndex === 0 && clockwise) || (contourIndex > 0 && !clockwise)) contour.reverse();
    const radius = contourIndex ? 0.004 : 0;
    const profile = radius
      ? [0, Math.PI / 6, Math.PI / 3, Math.PI / 2].map(angle => ({ shift: radius * Math.sin(angle), z: radius * (Math.cos(angle) - 1), angle })).concat([{ shift: radius, z: -depth, angle: Math.PI / 2 }])
      : [{ shift: 0, z: 0, angle: Math.PI / 2 }, { shift: 0, z: -depth, angle: Math.PI / 2 }];
    const rings: { point: T.Vector3; normal: T.Vector3 }[][] = [];
    for (const ring of profile) rings.push(contour.map((point, i) => {
      const previous = contour[(i + contour.length - 1) % contour.length], next = contour[(i + 1) % contour.length];
      const outward = new T.Vector2(next.y - previous.y, previous.x - next.x).normalize();
      const x = point.x + outward.x * ring.shift, y = point.y + outward.y * ring.shift;
      const [dx, dy] = gradient(x, y), nz = Math.cos(ring.angle);
      normal.set(outward.x * Math.sin(ring.angle) - dx * nz, outward.y * Math.sin(ring.angle) - dy * nz, nz).normalize();
      return { point: new T.Vector3(x, y, frontSurfaceZ(x, y) + offset + ring.z), normal: normal.clone() };
    }));
    for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      for (const [r, c] of [[row, i], [row + 1, i], [row, j], [row, j], [row + 1, i], [row + 1, j]]) {
        const vertex = rings[r][c];
        positions.push(...vertex.point.toArray()); normals.push(...vertex.normal.toArray()); uvs.push(c / contour.length, r / (rings.length - 1));
      }
    }
  });
  const walls = new T.BufferGeometry();
  walls.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  walls.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  walls.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  const result = mergeGeometries([cap, walls])!;
  cap.dispose(); walls.dispose();
  result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData.reconstruction = 'analytic cap and rolled aperture returns';
  return result;
}

// A cubic corner continues the cap's tangent and ends at the wheel-arch edge.
// The previous constant-x rectangle had an abrupt corner and stopped 16 mm
// below the lamp/fender interface. The top edge follows the existing fender
// nose (x approximately .827 at z 1.80), leaving its 4-6 mm panel seam.
export function frontReturnGeometry(side: number, minY = FRONT_SKIN_BOTTOM, maxY = FRONT_SKIN_TOP, offset = 0) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [], rows = 28, columns = 24;
  const point = (u: number, y: number) => {
    const arch = 1.35 + Math.sqrt(Math.max(0, 0.37 ** 2 - (y - 0.308) ** 2));
    const x = frontSkinHalfWidthAt(y), front = frontSurfaceZ(x, y), [dx] = gradient(x, y);
    const upper = T.MathUtils.smoothstep(y, 0.410, FRONT_SKIN_TOP);
    const c1 = T.MathUtils.lerp(0.870, 0.821, upper), c2 = T.MathUtils.lerp(0.893, 0.827, upper), end = T.MathUtils.lerp(0.879, 0.874, upper);
    const v = 1 - u;
    return new T.Vector3(side * (v ** 3 * x + 3 * v ** 2 * u * c1 + 3 * v * u ** 2 * c2 + u ** 3 * end + offset), y,
      v ** 3 * front + 3 * v ** 2 * u * (front + dx * (c1 - x)) + 3 * v * u ** 2 * (arch + 0.080) + u ** 3 * arch);
  };
  for (let row = 0; row <= rows; row++) {
    const y = T.MathUtils.lerp(minY, maxY, row / rows);
    for (let col = 0; col <= columns; col++) {
      const u = col / columns, q = point(u, y), h = 0.0001;
      const du = point(u + h, y).sub(point(u - h, y));
      const dy = point(u, y + h).sub(point(u, y - h));
      const normal = du.cross(dy).multiplyScalar(side).normalize();
      positions.push(...q.toArray()); normals.push(...normal.toArray());
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(...(side > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
  }
  const result = new T.BufferGeometry();
  result.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  result.setIndex(indices); result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
