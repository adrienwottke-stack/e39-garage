import * as T from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FRONT_SKIN_BOTTOM, FRONT_SKIN_TOP, frontSkinHalfWidthAt, frontSurfaceZ, frontPanelGeometry } from "./bumper-geometry";
import { photoSpokeGeometry } from "./wheel-geometry-09";
import type { FrontSpec, RearSpec, WheelSpec } from "./tuning-parts";

export function aperture(width: number, height: number, bottom: number, taper = 0, radius = .02, center = 0) {
  const s = new T.Shape(), left = center - width / 2, right = center + width / 2;
  const lowerLeft = left + taper / 2, lowerRight = right - taper / 2;
  const r = Math.min(radius, height * .45, width * .15), top = bottom + height;
  s.moveTo(lowerLeft + r, bottom); s.lineTo(lowerRight - r, bottom);
  s.quadraticCurveTo(lowerRight, bottom, lowerRight, bottom + r);
  s.lineTo(right, top - r); s.quadraticCurveTo(right, top, right - r, top);
  s.lineTo(left + r, top); s.quadraticCurveTo(left, top, left, top - r);
  s.lineTo(lowerLeft, bottom + r); s.quadraticCurveTo(lowerLeft, bottom, lowerLeft + r, bottom);
  s.closePath(); return s;
}
export function frontStudyShapes(spec: FrontSpec) {
  const shell = new T.Shape();
  shell.moveTo(-frontSkinHalfWidthAt(FRONT_SKIN_BOTTOM), FRONT_SKIN_BOTTOM);
  shell.lineTo(frontSkinHalfWidthAt(FRONT_SKIN_BOTTOM), FRONT_SKIN_BOTTOM);
  for (let i = 1; i <= 28; i++) { const y = T.MathUtils.lerp(FRONT_SKIN_BOTTOM, FRONT_SKIN_TOP, i / 28); shell.lineTo(frontSkinHalfWidthAt(y), y); }
  shell.lineTo(-frontSkinHalfWidthAt(FRONT_SKIN_TOP), FRONT_SKIN_TOP);
  for (let i = 27; i >= 0; i--) { const y = T.MathUtils.lerp(FRONT_SKIN_BOTTOM, FRONT_SKIN_TOP, i / 28); shell.lineTo(-frontSkinHalfWidthAt(y), y); }
  shell.closePath();
  const mouth = aperture(spec.width, spec.height, spec.bottom, spec.taper, spec.radius);
  const vents: T.Shape[] = [];
  if (spec.vent !== "none") for (const side of [-1, 1]) {
    const center = side * Math.min(.70, (spec.width + Math.max(0, -spec.taper)) / 2 + spec.ventWidth / 2 + .052);
    vents.push(aperture(spec.ventWidth, spec.ventHeight, spec.bottom + .025,
      spec.vent === "duct" ? .035 : 0, spec.vent === "round" ? spec.ventHeight / 2 : .012, center));
  }
  for (const s of [mouth, ...vents]) shell.holes.push(new T.Path(s.getPoints(32)));
  return { shell, mouth, vents };
}
export function rearStudyShapes(spec: RearSpec) {
  const shell = aperture(1.765, .437, .162, .042, .025);
  const mouth = aperture(spec.width, spec.height, spec.bottom, spec.taper, spec.radius);
  const vents: T.Shape[] = [];
  if (spec.vent !== "none") for (const side of [-1, 1]) vents.push(aperture(
    spec.vent === "tall" ? .085 : .22, spec.vent === "tall" ? .11 : .034,
    spec.vent === "tall" ? .365 : .414, .01, .009, side * (spec.vent === "tall" ? .77 : .66)));
  for (const s of [mouth, ...vents]) shell.holes.push(new T.Path(s.getPoints(24)));
  return { shell, mouth, vents };
}
// The E39 is broad and nearly flat up to the outer quarter; its corner turns
// only beyond x=.75. A low-order power curve exposed the internal crash bar by
// bowing inward 180 mm too early. These smoothed sections follow samples of the
// active reference bumper. The lower rows continue its rolled-under envelope.
const REAR_X = [0,.2,.4,.5,.6,.7,.75,.8,.84,.87,.89];
const REAR_Y = [.162,.22,.27,.35,.43,.51,.57,.599];
const REAR_SECTIONS = [
  [-2.42,-2.415,-2.395,-2.37,-2.34,-2.27,-2.18,-2.04,-1.89,-1.80,-1.74],
  [-2.43,-2.425,-2.40,-2.38,-2.34,-2.28,-2.20,-2.05,-1.90,-1.81,-1.74],
  [-2.46,-2.45,-2.43,-2.40,-2.35,-2.29,-2.24,-2.14,-1.96,-1.83,-1.74],
  [-2.5262,-2.5194,-2.5006,-2.4877,-2.4693,-2.4333,-2.3746,-2.2018,-2.0074,-1.87,-1.74],
  [-2.5876,-2.5819,-2.5662,-2.5546,-2.5388,-2.5104,-2.4679,-2.3008,-2.0835,-1.8895,-1.75],
  [-2.5981,-2.5916,-2.5752,-2.564,-2.5476,-2.5218,-2.4907,-2.37,-2.1652,-1.9695,-1.76],
  [-2.5921,-2.5853,-2.5679,-2.5553,-2.5383,-2.5124,-2.4807,-2.3277,-2.0754,-1.8586,-1.73],
  [-2.5155,-2.5094,-2.4978,-2.4879,-2.471,-2.444,-2.3928,-2.23,-1.99,-1.81,-1.71],
];
function monotoneSection(knots: number[], values: number[], input: number) {
  const v = T.MathUtils.clamp(input, knots[0], knots[knots.length - 1]);
  let i = 0; while (i < knots.length - 2 && v > knots[i + 1]) i++;
  const slope = (j: number) => (values[j + 1] - values[j]) / (knots[j + 1] - knots[j]);
  const tangent = (j: number) => {
    if (j === 0) return slope(0);
    if (j === knots.length - 1) return slope(j - 1);
    const a = slope(j - 1), b = slope(j);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  const h = knots[i + 1] - knots[i], t = (v - knots[i]) / h;
  return (2*t*t*t-3*t*t+1)*values[i] + (t*t*t-2*t*t+t)*h*tangent(i)
    + (-2*t*t*t+3*t*t)*values[i+1] + (t*t*t-t*t)*h*tangent(i+1);
}
export function rearSurfaceZ(x: number, y: number) {
  return monotoneSection(REAR_Y, REAR_SECTIONS.map(row => monotoneSection(REAR_X, row, Math.abs(x))), y);
}
function rearSurfaceGradient(x: number, y: number) {
  const h = .0001;
  return [(rearSurfaceZ(x+h,y)-rearSurfaceZ(x-h,y))/(2*h), (rearSurfaceZ(x,y+h)-rearSurfaceZ(x,y-h))/(2*h)];
}
export function rearSkinHalfWidthAt(y: number) {
  const r = .025, bottom = .162, top = .599, half = .8825, lower = half - .021;
  if (y < bottom + r) return lower - r * (1 - Math.sqrt(Math.max(0, (y - bottom) / r))) ** 2;
  if (y > top - r) return half - r * (1 - Math.sqrt(Math.max(0, (top - y) / r))) ** 2;
  return T.MathUtils.lerp(lower, half, (y - bottom - r) / (top - bottom - r * 2));
}
export function studyPanelGeometry(shape: T.Shape, rear: boolean, depth = .055, offset = 0) {
  if (!rear) return frontPanelGeometry(shape, depth, offset);
  const source = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: .0035, bevelThickness: .0035, curveSegments: 24, steps: 1 });
  const g = new TessellateModifier(.045, 5).modify(source); source.dispose();
  const p = g.getAttribute("position"), n = g.getAttribute("normal");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    p.setZ(i, rearSurfaceZ(x, y) + p.getZ(i) - offset);
    const [dx, dy] = rearSurfaceGradient(x, y);
    n.setXYZ(i, nx - dx * nz, ny - dy * nz, nz);
  }
  g.normalizeNormals(); g.computeBoundingBox(); return g;
}
export function rearReturnGeometry(side: number) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [], rows = 28, cols = 22;
  const point = (u: number, y: number) => {
    const half = rearSkinHalfWidthAt(y);
    const arch = -1.495 - Math.sqrt(Math.max(0, .37 ** 2 - (y - .308) ** 2));
    const v = 1 - u, z = rearSurfaceZ(half, y), [dx] = rearSurfaceGradient(half, y);
    return new T.Vector3(side * (v ** 3 * half + 3 * v ** 2 * u * (half + .011) + 3 * v * u ** 2 * .895 + u ** 3 * .88), y,
      v ** 3 * z + 3 * v ** 2 * u * (z + dx * .011) + 3 * v * u ** 2 * (arch - .04) + u ** 3 * arch);
  };
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const y = .162 + .437 * j / rows, u = i / cols, h = .0001, p = point(u, y);
    const du = point(u + h, y).sub(point(u - h, y)), dy = point(u, y + h).sub(point(u, y - h));
    const n = dy.cross(du).multiplyScalar(side).normalize();
    positions.push(...p.toArray()); normals.push(...n.toArray());
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    indices.push(...(side > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setIndex(indices); g.computeBoundingBox(); return g;
}
function inside(x: number, y: number, points: T.Vector2[]) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}
export function intakeGrilleGeometry(shape: T.Shape, pattern: FrontSpec["grille"], rear = false, offset = .018) {
  const points = shape.getPoints(32), bounds = new T.Box2().setFromPoints(points), pos: number[] = [];
  const z = (x: number, y: number) => rear ? rearSurfaceZ(x, y) + offset : frontSurfaceZ(x, y) - offset;
  const strip = (x: number, y: number, horizontal: boolean) => {
    const w = horizontal ? .008 : .0016, h = horizontal ? .0016 : .008;
    for (const [dx, dy] of [[-w,-h],[w,-h],[w,h],[-w,-h],[w,h],[-w,h]]) pos.push(x + dx, y + dy, z(x + dx, y + dy));
  };
  for (let y = bounds.min.y + .006; y < bounds.max.y - .004; y += .012)
    for (let x = bounds.min.x + .006; x < bounds.max.x - .004; x += .012) {
      if (!inside(x, y, points)) continue;
      if (pattern !== "vertical") strip(x, y, true);
      if (pattern !== "horizontal") strip(x, y, false);
    }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
export function exhaustCenters(exhaust: RearSpec["exhaust"]) {
  return ({ left: [.485, .585], single: [.54], dual: [-.59, .59], quad: [-.65, -.54, .54, .65], center: [-.055, .055], hidden: [] })[exhaust];
}
export function studyExhaustGeometry() {
  return new T.LatheGeometry([new T.Vector2(.034, .16), new T.Vector2(.034, .004), new T.Vector2(.036, 0), new T.Vector2(.043, 0), new T.Vector2(.045, .005), new T.Vector2(.045, .16)], 40);
}
export function wheelSpokeGeometry(spec: WheelSpec, radius: number) {
  if (spec.profile === "photo") return photoSpokeGeometry(radius);
  const s = new T.Shape(), tip = radius - .017, hub = .046, w = spec.width;
  if (spec.profile === "disc" || spec.profile === "slot") {
    s.absarc(0, 0, tip, 0, Math.PI * 2, false);
    const hubOpening = new T.Path(); hubOpening.absarc(0, 0, .071, 0, Math.PI * 2, true); s.holes.push(hubOpening);
    for (let i = 0; i < spec.spokes; i++) {
      const angle = i * Math.PI * 2 / spec.spokes, hole = new T.Path();
      if (spec.profile === "disc") hole.absarc(Math.sin(angle) * radius * .69, Math.cos(angle) * radius * .69, radius * .16, 0, Math.PI * 2, true);
      else {
        const shape = aperture(radius * .13, radius * .40, radius * .47, -.007, radius * .065);
        hole.setFromPoints(shape.getPoints(24).map(p => p.rotateAround(new T.Vector2(), -angle)));
      }
      s.holes.push(hole);
    }
  } else {
    const sweep = spec.sweep;
    s.moveTo(-w * .65, hub);
    s.bezierCurveTo(-w * .9, radius * .42, sweep - w, radius * .78, sweep - w * 1.10, tip);
    s.quadraticCurveTo(sweep, tip + .004, sweep + w * 1.1, tip);
    s.bezierCurveTo(sweep + w, radius * .78, w * .9, radius * .42, w * .65, hub);
    s.closePath();
    if (spec.profile === "y" && spec.split === 1) {
      const h = new T.Path(); h.moveTo(-.004, radius * .59); h.lineTo(.004, radius * .59); h.lineTo(sweep + w * .45, tip - .01); h.lineTo(sweep - w * .45, tip - .01); h.closePath(); s.holes.push(h);
    }
  }
  const source = new T.ExtrudeGeometry(s, { depth: .016, bevelEnabled: true, bevelSegments: 2, bevelSize: .0022, bevelThickness: .0022, curveSegments: spec.profile === "disc" || spec.profile === "slot" ? 16 : 7, steps: 1 });
  const g = new TessellateModifier(.04, 3).modify(source); source.dispose();
  const p = g.getAttribute("position"), n = g.getAttribute("normal");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), t = T.MathUtils.smoothstep(r, .055, radius * .94);
    p.setZ(i, p.getZ(i) + .078 - spec.dish * (1 - t));
    const u = T.MathUtils.clamp((r - .055) / (radius * .94 - .055), 0, 1);
    const derivative = spec.dish * 6 * u * (1 - u) / (radius * .94 - .055), nz = n.getZ(i);
    if (r > 1e-6) n.setXYZ(i, n.getX(i) - derivative * x / r * nz, n.getY(i) - derivative * y / r * nz, nz);
  }
  g.normalizeNormals(); g.computeBoundingBox(); return g;
}
export function diffuserFinGeometry(x: number, spec: RearSpec) {
  const bottom = spec.bottom + .005, height = Math.min(.07, spec.height * .42);
  const s = new T.Shape(); s.moveTo(-rearSurfaceZ(x, bottom), bottom + height);
  s.quadraticCurveTo(-rearSurfaceZ(x, bottom) + .06 + spec.lip, bottom + height * .55,
    -rearSurfaceZ(x, bottom) + .07 + spec.lip, bottom - .012);
  s.lineTo(-rearSurfaceZ(x, bottom) + .01, bottom - .009); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: .005, bevelEnabled: true, bevelSegments: 2, bevelSize: .001, bevelThickness: .001, curveSegments: 10 });
  g.rotateY(Math.PI / 2); g.translate(x - .0025, 0, 0); g.computeBoundingBox(); return g;
}
export function wheelBoltGeometry(radius: number) {
  const pieces: T.BufferGeometry[] = [];
  for (let i = 0; i < 30; i++) { const a = i * Math.PI * 2 / 30, g = new T.SphereGeometry(.0033, 6, 4); g.translate(Math.sin(a) * (radius - .014), Math.cos(a) * (radius - .014), .095); pieces.push(g); }
  const result = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose()); return result;
}
