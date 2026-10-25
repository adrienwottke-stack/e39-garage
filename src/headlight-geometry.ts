import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Coordinates sampled from the actual 0.8 GLB cover, not original BMW dimensions.
// +z is the front of the car.
const coverProfile = [
  [.28, 2.115], [.35, 2.110], [.40, 2.102], [.45, 2.091],
  [.50, 2.078], [.55, 2.064], [.60, 2.050], [.65, 2.031],
  [.70, 2.005], [.75, 1.959], [.79, 1.899], [.81, 1.854],
] as const;

export function headlightCoverDepth(x: number): number {
  const u = Math.abs(x);
  for (let i = 1; i < coverProfile.length; i++) {
    const [x0, z0] = coverProfile[i - 1], [x1, z1] = coverProfile[i];
    if (u <= x1) return T.MathUtils.lerp(z0, z1, T.MathUtils.clamp((u - x0) / (x1 - x0), 0, 1));
  }
  return coverProfile[coverProfile.length - 1][1];
}

export const headlightOptics = [
  {x: .442, y: .588, radius: .060, projector: false},
  {x: .594, y: .588, radius: .060, projector: true},
] as const;

// Rim clearance also accounts for the rearward curl of the cover at its top.
export const headlightOpticSetback = .037;

function insertOutline() {
  const shape = new T.Shape();
  shape.moveTo(.332, .522);
  shape.quadraticCurveTo(.314, .573, .337, .626);
  shape.quadraticCurveTo(.346, .651, .376, .652);
  shape.lineTo(.670, .652);
  shape.quadraticCurveTo(.726, .649, .766, .620);
  shape.quadraticCurveTo(.792, .602, .799, .577);
  shape.lineTo(.778, .546);
  shape.quadraticCurveTo(.731, .524, .676, .522);
  shape.closePath();
  return shape;
}
function fittedClosedPanel(shape:T.Shape, setback:number, depth:number) {
  const g=new T.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:16,bevelEnabled:false});
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),h=.0001;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),nz=n.getZ(i);
    const dx=(headlightCoverDepth(x+h)-headlightCoverDepth(x-h))/(2*h);
    p.setZ(i,headlightCoverDepth(x)-setback+z);
    n.setXYZ(i,n.getX(i)-dx*nz,n.getY(i),nz);
  }
  g.normalizeNormals();g.computeBoundingBox();return g;
}

/** Connected black insert, pierced by the two circular optical apertures. */
export function createHeadlightInsert(): T.BufferGeometry {
  const shape = insertOutline();
  for (const optic of headlightOptics) {
    const hole = new T.Path();
    hole.absarc(optic.x, optic.y, optic.radius + .001, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const frame=fittedClosedPanel(shape,.134,.085),back=fittedClosedPanel(insertOutline(),.138,.004);
  const geometry=mergeGeometries([frame,back])!;frame.dispose();back.dispose();
  // Keep a regular index for ordinary glTF export and closed-surface checks.
  geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,i)=>i));
  geometry.computeBoundingBox();return geometry;
}

/** Closed rear housing and turned front rim, with an open optical mouth. */
export function createHeadlightHousing() {
  const g=new T.LatheGeometry([
    [0,-.086],[.054,-.086],[.064,-.077],[.065,-.012],[.062,.001],
    [.059,.001],[.057,-.009],[.050,-.074],[0,-.074],
  ].map(([r,z])=>new T.Vector2(r,z)),64);
  g.rotateX(Math.PI/2);g.computeBoundingBox();return g;
}
/** Dark annular projector shroud; the lens remains visibly smaller than its ring. */
export function createProjectorShroud() {
  const g=new T.LatheGeometry([
    [.034,-.022],[.050,-.039],[.058,-.012],[.058,-.002],
    [.054,.001],[.039,.001],[.034,-.004],[.034,-.022],
  ].map(([r,z])=>new T.Vector2(r,z)),64);
  g.rotateX(Math.PI/2);g.computeBoundingBox();return g;
}
/** Watertight convex projector element, rather than a flattened full sphere. */
export function createProjectorLens() {
  const p=[new T.Vector2(0,-.018),new T.Vector2(.034,-.018),new T.Vector2(.034,-.008)];
  for(let i=23;i>=0;i--) {const r=.034*i/24,z=.002-.010*(r/.034)**2;p.push(new T.Vector2(r,z));}
  p.push(new T.Vector2(0,-.018));
  const g=new T.LatheGeometry(p,64);g.rotateX(Math.PI/2);g.computeBoundingBox();return g;
}

/** Open parabolic reflector with physical radial flutes rather than spheres. */
export function createHeadlightReflector(): T.BufferGeometry {
  const segments = 64, rings = 12;
  const positions: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const r = .013 + j / rings * .047;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      const z = -.047 + .047 * (r / .060) ** 2 + .0011 * Math.cos(32 * a) * Math.sin(j/rings*Math.PI);
      positions.push(r * Math.cos(a), r * Math.sin(a), z);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** The clear outer indicator wraps rearwards with the existing lamp cover. */
export function createHeadlightCorner(): T.BufferGeometry {
  const shape = new T.Shape();
  shape.moveTo(.679, .537);
  shape.lineTo(.690, .635);
  shape.quadraticCurveTo(.734, .642, .773, .612);
  shape.lineTo(.790, .582);
  shape.lineTo(.775, .550);
  shape.lineTo(.736, .536);
  shape.closePath();
  const geometry = new T.ShapeGeometry(shape, 12), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, headlightCoverDepth(p.getX(i)) - .038);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Ridges on the clear corner lens, with no photographic texture. */
export function createHeadlightCornerRibs(): T.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row < 11; row++) {
    const y = .547 + row * .0073;
    const maxX = .777 - Math.max(0, y - .595) * 1.8;
    const start = positions.length / 3;
    for (let col = 0; col <= 12; col++) {
      const x = T.MathUtils.lerp(.692, maxX, col / 12);
      for (const dy of [-.00045, .00045]) positions.push(x, y + dy, headlightCoverDepth(x) - .031 + (col%2)*.0007);
    }
    for (let col = 0; col < 12; col++) {
      const a = start + col * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
