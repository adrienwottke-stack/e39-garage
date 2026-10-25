import * as T from 'three';
import definition from './shoulder-surface.json';
import {panelNormals} from './panel-normals';

function basis(value:number,count:number) {
  const t=T.MathUtils.clamp(value,0,1-1e-10),knots=[0,0,0];
  for(let i=0;i<=count-3;i++)knots.push(i/(count-3));
  knots.push(1,1,1);
  let b:number[]=knots.slice(0,-1).map((v,i)=>t>=v&&t<knots[i+1]?1:0);
  for(let d=1;d<=3;d++)b=Array.from({length:knots.length-d-1},(_,i)=>{
    const a=knots[i+d]-knots[i],c=knots[i+d+1]-knots[i+1];
    return (a?(t-knots[i])/a*b[i]:0)+(c?(knots[i+d+1]-t)/c*b[i+1]:0);
  });
  return b;
}
export function shoulderPoint(p:T.Vector3,side:number) {
  const theta=Math.atan2(Math.abs(p.x)-.70,p.y-.57);
  const u=basis(theta/1.6,definition.uCount),v=basis((p.z-.65)/1.35,definition.vCount);
  const r=definition.coeff.reduce((sum,row,i)=>sum+row.reduce((s,c,j)=>s+c*u[i]*v[j],0),0);
  return new T.Vector3(side*(.70+r*Math.sin(theta)),.57+r*Math.cos(theta),p.z);
}

// Offline authoring: only the shoulder's broad outer skin is reconstructed.
// A sparse 5 x 8 control lattice rejects short wavelength waviness. Original
// door/hood seams, arch folds, lamp seats and underside remain pinned.
export function rebuildShoulder(source:T.BufferGeometry,side:number) {
  const g=source.index?source.toNonIndexed():source.clone();
  const p=g.getAttribute('position'),n=g.getAttribute('normal');
  const groups=new Map<string,{p:T.Vector3;edges:Set<string>;distance:number}>();
  const keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(','));
  for(let i=0;i<p.count;i++) {
    const point=new T.Vector3().fromBufferAttribute(p,i);
    const entry=groups.get(keys[i])??{p:point,edges:new Set<string>(),distance:.08};
    if(n.getY(i)<-.2||n.getX(i)*side<-.1)entry.distance=0;
    groups.set(keys[i],entry);
  }
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++) {
    const a=keys[i+j],b=keys[i+(j+1)%3];groups.get(a)!.edges.add(b);groups.get(b)!.edges.add(a);
  }
  for(let pass=0;pass<12;pass++)for(const a of groups.values())for(const k of a.edges) {
    const b=groups.get(k)!;a.distance=Math.min(a.distance,b.distance+a.p.distanceTo(b.p));
  }
  let changed=0,maxDisplacement=0;
  for(let i=0;i<p.count;i++) {
    const group=groups.get(keys[i])!,point=group.p;
    const theta=Math.atan2(Math.abs(point.x)-.70,point.y-.57),smooth=T.MathUtils.smoothstep;
    const weight=smooth(point.z,.76,.87)*(1-smooth(point.z,1.85,1.96))*
      smooth(theta,.04,.18)*(1-smooth(theta,1.4,1.58))*smooth(group.distance,0,.055)*smooth(point.y,.57,.63);
    if(weight<1e-6)continue;
    const delta=shoulderPoint(point,side).sub(point);
    if(delta.length()>.026)delta.setLength(.026);
    delta.multiplyScalar(weight);
    p.setXYZ(i,point.x+delta.x,point.y+delta.y,point.z+delta.z);
    if(delta.length()>1e-6)changed++;
    maxDisplacement=Math.max(maxDisplacement,delta.length());
  }
  // Derive normals from the actual final skin, including transition strips.
  // Lerp of an unrelated fitted normal into the old normal produced false
  // highlights even where positions moved only a fraction of a millimetre.
  const next=panelNormals(g);g.dispose();
  next.computeBoundingBox();next.computeBoundingSphere();
  next.userData.shoulderRebuild={changed,maxDisplacement,controls:40,method:'sparse shoulder surface with geometry-derived normals'};
  return next;
}
