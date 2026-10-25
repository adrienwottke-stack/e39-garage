import * as T from "three";

// Split every long edge in each pass, including all incident triangles. A
// longest-edge-only modifier leaves T-junctions that tear after a curved warp.
export function conformingTessellation(source: T.BufferGeometry, maxEdge = 0.024) {
  const input = source.index ? source.toNonIndexed() : source;
  type Vertex = { p: T.Vector3; n: T.Vector3 };
  let triangles: Vertex[][] = [];
  const p = input.getAttribute("position"), n = input.getAttribute("normal");
  for (let i = 0; i < p.count; i += 3) triangles.push([0, 1, 2].map(j => ({
    p: new T.Vector3().fromBufferAttribute(p, i + j),
    n: new T.Vector3().fromBufferAttribute(n, i + j),
  })));
  const midpoint = (a: Vertex, b: Vertex): Vertex => ({
    p: a.p.clone().add(b.p).multiplyScalar(0.5), n: a.n.clone().add(b.n).multiplyScalar(0.5),
  });
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    const next: Vertex[][] = [];
    for (const [a, b, c] of triangles) {
      const ab = a.p.distanceToSquared(b.p) > maxEdge ** 2;
      const bc = b.p.distanceToSquared(c.p) > maxEdge ** 2;
      const ca = c.p.distanceToSquared(a.p) > maxEdge ** 2;
      const mask = (ab ? 1 : 0) + (bc ? 2 : 0) + (ca ? 4 : 0);
      if (!mask) { next.push([a, b, c]); continue; }
      changed = true;
      const d = midpoint(a, b), e = midpoint(b, c), f = midpoint(c, a);
      if (mask === 1) next.push([a, d, c], [d, b, c]);
      else if (mask === 2) next.push([a, b, e], [a, e, c]);
      else if (mask === 4) next.push([a, b, f], [b, c, f]);
      else if (mask === 3) next.push([d, b, e], [a, d, c], [d, e, c]);
      else if (mask === 5) next.push([f, a, d], [d, b, c], [d, c, f]);
      else if (mask === 6) next.push([e, c, f], [a, b, e], [a, e, f]);
      else next.push([a, d, f], [d, b, e], [f, e, c], [d, e, f]);
    }
    triangles = next;
    if (!changed) break;
  }
  const positions: number[] = [], normals: number[] = [];
  for (const triangle of triangles) for (const v of triangle) {
    positions.push(v.p.x, v.p.y, v.p.z);
    normals.push(v.n.x, v.n.y, v.n.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  if (input !== source) input.dispose();
  return g;
}

