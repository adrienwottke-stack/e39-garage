import * as T from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import surfaces from './front-surfaces.json';

type Surface = {kind:string;uCount:number;vCount:number;coeff:number[][];side?:number};
const smooth=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b);

function basis(value:number,count:number) {
  const t=T.MathUtils.clamp(value,0,1-1e-10),knots=[0,0,0];
  for(let i=0;i<=count-3;i++)knots.push(i/(count-3));
  knots.push(1,1,1);
  let b:number[]=knots.slice(0,-1).map((v,i)=>t>=v&&t<knots[i+1]?1:0);
  for(let degree=1;degree<=3;degree++)b=Array.from({length:knots.length-degree-1},(_,i)=>{
    const d1=knots[i+degree]-knots[i],d2=knots[i+degree+1]-knots[i+1];
    return (d1?(t-knots[i])/d1*b[i]:0)+(d2?(knots[i+degree+1]-t)/d2*b[i+1]:0);
  });
  return b;
}
function value(s:Surface,u:number,v:number) {
  const a=basis(u,s.uCount),b=basis(v,s.vCount);
  return s.coeff.reduce((sum,row,i)=>sum+row.reduce((sum,c,j)=>sum+c*a[i]*b[j],0),0);
}
export function frontSurfacePoint(name:string,p:T.Vector3) {
  const s=(surfaces as Record<string,Surface>)[name];
  if(!s)return p.clone();
  if(s.kind==='hood') {
    const u=p.x/.8,v=(p.z-1.4)/.7;
    const y=s.coeff.reduce((sum,row,i)=>sum+row.reduce((sum,c,j)=>sum+c*u**(2*i)*v**j,0),0);
    return new T.Vector3(p.x,y,p.z);
  }
  const theta=Math.atan2(Math.abs(p.x)-.70,p.y-.57);
  const r=value(s,theta/1.6,(p.z-.65)/1.35);
  return new T.Vector3((s.side??1)*(.70+r*Math.sin(theta)),.57+r*Math.cos(theta),p.z);
}

// Reconstruct the broad outer skin from controlled polynomial/spline patches.
// Parameterized surfaces follow the reference panel; hems, openings, underside
// and cowl/lamp interfaces retain their original geometry. Not fitment CAD.
export function rebuildFrontPanel(source:T.BufferGeometry,name:string) {
  const geometry=new TessellateModifier(.035,3).modify(source);
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  const s=(surfaces as Record<string,Surface>)[name],p=new T.Vector3(),n=new T.Vector3();
  // A panel has coincident vertices at normal splits. Project them as one
  // position, and pin shared hem/underside positions so no cracks can open.
  const key=(i:number)=>`${Math.round(position.getX(i)*1e6)},${Math.round(position.getY(i)*1e6)},${Math.round(position.getZ(i)*1e6)}`;
  const groups=new Map<string,{point:T.Vector3;weight:number;distance:number;edges:Set<string>}>();
  const keys=Array.from({length:position.count},(_,i)=>key(i));
  for(let i=0;i<position.count;i++) {
    p.fromBufferAttribute(position,i);n.fromBufferAttribute(normal,i);
    const eligible=s.kind==='hood'?n.y>.10&&p.y>.69:n.x*(s.side??1)>.04&&n.y>.04&&p.y>.58;
    const entry=groups.get(keys[i])??{point:p.clone(),weight:1,distance:.06,edges:new Set<string>()};
    if(!eligible){entry.weight=0;entry.distance=0;}
    groups.set(keys[i],entry);
  }
  for(let i=0;i<position.count;i+=3)for(let j=0;j<3;j++) {
    const a=keys[i+j],b=keys[i+(j+1)%3];groups.get(a)!.edges.add(b);groups.get(b)!.edges.add(a);
  }
  // Bounded distance propagation gives the reconstructed surface a gentle
  // transition into its preserved outline and all original sharp interfaces.
  for(let pass=0;pass<8;pass++)for(const entry of groups.values())for(const neighbor of entry.edges) {
    const other=groups.get(neighbor)!;
    entry.distance=Math.min(entry.distance,other.distance+entry.point.distanceTo(other.point));
  }
  let changed=0,maxDisplacement=0;
  for(let i=0;i<position.count;i++) {
    p.fromBufferAttribute(position,i);n.fromBufferAttribute(normal,i);
    let weight=0;
    if(s.kind==='hood'&&n.y>.10&&p.y>.69) {
      weight=smooth(.81,.89,p.z)*(1-smooth(1.97,2.025,p.z))*(1-smooth(.72,.78,Math.abs(p.x)));
    } else if(s.kind==='fender'&&n.x*(s.side??1)>.04&&n.y>.04&&p.y>.58) {
      weight=smooth(.76,.84,p.z)*(1-smooth(1.87,1.96,p.z))*smooth(.58,.64,p.y);
      // Keep the narrow seam/hem next to the hood exactly in place.
      weight*=smooth(.06,.18,Math.atan2(Math.abs(p.x)-.70,p.y-.57));
    }
    const group=groups.get(keys[i])!;
    weight*=group.weight*smooth(0,.035,group.distance);
    if(weight<1e-6){n.normalize();normal.setXYZ(i,n.x,n.y,n.z);continue;}
    const q=frontSurfacePoint(name,p),delta=q.clone().sub(p);
    if(delta.length()>.025)delta.setLength(.025);
    delta.multiplyScalar(weight);q.copy(p).add(delta);
    position.setXYZ(i,q.x,q.y,q.z);
    // The control surface has continuous analytic derivatives; estimate its
    // normal at parameter neighbours instead of inheriting triangle ripples.
    const h=.0001;
    let du:T.Vector3,dv:T.Vector3;
    if(s.kind==='hood') {
      du=frontSurfacePoint(name,p.clone().add(new T.Vector3(h,0,0))).sub(frontSurfacePoint(name,p.clone().add(new T.Vector3(-h,0,0))));
      dv=frontSurfacePoint(name,p.clone().add(new T.Vector3(0,0,h))).sub(frontSurfacePoint(name,p.clone().add(new T.Vector3(0,0,-h))));
    } else {
      const theta=Math.atan2(Math.abs(p.x)-.70,p.y-.57),r=Math.hypot(Math.abs(p.x)-.70,p.y-.57);
      const neighbour=(t:number)=>new T.Vector3((s.side??1)*(.70+r*Math.sin(t)),.57+r*Math.cos(t),p.z);
      du=frontSurfacePoint(name,neighbour(theta+h)).sub(frontSurfacePoint(name,neighbour(theta-h)));
      dv=frontSurfacePoint(name,p.clone().add(new T.Vector3(0,0,h))).sub(frontSurfacePoint(name,p.clone().add(new T.Vector3(0,0,-h))));
    }
    const fittedNormal=dv.cross(du).normalize();
    if(fittedNormal.dot(n)<0)fittedNormal.negate();
    n.lerp(fittedNormal,weight).normalize();normal.setXYZ(i,n.x,n.y,n.z);
    maxDisplacement=Math.max(maxDisplacement,delta.length());changed++;
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...geometry.userData,frontRebuild:{changed,maxDisplacement,method:s.kind==='hood'?'symmetric polynomial patch':'regularized cubic tensor surface'}};
  return geometry;
}
