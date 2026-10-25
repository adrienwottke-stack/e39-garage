import * as T from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";

export const visualTireRadius = 0.308;
// One complete paired spoke, traced by proportion from the supplied photos.
// This is a visual reconstruction, not a measured or identified wheel product.
export function photoSpokeGeometry(radius: number) {
  const s = new T.Shape(), k = radius / 0.216;
  s.moveTo(-0.033,0.044);
  s.bezierCurveTo(-0.039,0.09,-0.047,0.155*k,-0.067,0.195*k);
  s.bezierCurveTo(-0.070,0.207*k,-0.045,0.213*k,-0.037,0.202*k);
  s.bezierCurveTo(-0.027,0.177*k,-0.023,0.143*k,-0.015,0.12*k);
  s.bezierCurveTo(-0.011,0.107*k,0.011,0.107*k,0.015,0.12*k);
  s.bezierCurveTo(0.023,0.143*k,0.027,0.177*k,0.037,0.202*k);
  s.bezierCurveTo(0.045,0.213*k,0.070,0.207*k,0.067,0.195*k);
  s.bezierCurveTo(0.047,0.155*k,0.039,0.09,0.033,0.044);
  s.closePath();
  const source = new T.ExtrudeGeometry(s,{depth:0.018,steps:1,curveSegments:20,
    bevelEnabled:true,bevelSegments:5,bevelSize:0.0045,bevelThickness:0.0045});
  const g = new TessellateModifier(0.012,5).modify(source); source.dispose();
  const p = g.getAttribute("position"), n = g.getAttribute("normal");
  for(let i=0;i<p.count;i++) {
    const radial = Math.hypot(p.getX(i),p.getY(i));
    const t = T.MathUtils.smoothstep(radial,0.055,radius*0.94);
    // Dish the centre and crown the face as it meets the outer barrel.
    p.setZ(i,p.getZ(i)+0.043+0.041*t+0.006*Math.sin(t*Math.PI));
    const u = T.MathUtils.clamp((radial-0.055)/(radius*0.94-0.055),0,1);
    const derivative = (0.041+0.006*Math.PI*Math.cos(t*Math.PI))*6*u*(1-u)/(radius*0.94-0.055);
    const nz=n.getZ(i);
    n.setXYZ(i,n.getX(i)-derivative*p.getX(i)/radial*nz,n.getY(i)-derivative*p.getY(i)/radial*nz,nz);
  }
  // Preserve the extrusion's smooth bevel normals using the inverse Jacobian,
  // rather than averaging tiny tessellated triangles into rippled highlights.
  g.normalizeNormals();g.computeBoundingBox();return g;
}
export function tireProfile(radius:number) {
  return [
    [radius-0.004,-0.084],[radius+0.009,-0.103],[0.287,-0.109],
    [0.302,-0.086],[visualTireRadius,-0.061],[visualTireRadius,0.061],
    [0.302,0.091],[0.287,0.112],[radius+0.009,0.108],[radius-0.004,0.089],
  ].map(([x,y])=>new T.Vector2(x,y));
}
