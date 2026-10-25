import * as T from 'three';
import {conformingTessellation} from './mesh-subdivision';
import surfaces from './body-surfaces.json';
import {panelNormals} from './panel-normals';
type Surface={kind:string;axis:number;center:number[];scale:number[];powers:number[][];coeff:number[]};
export function bodySurfacePoint(name:string,p:T.Vector3){
 const s=(surfaces as Record<string,Surface>)[name];if(!s)return p.clone();
 const a=s.axis===1?p.x:p.y,b=p.z,u=(a-s.center[0])/s.scale[0],v=(b-s.center[1])/s.scale[1];
 const value=s.coeff.reduce((sum,c,k)=>sum+c*u**s.powers[k][0]*v**s.powers[k][1],0),q=p.clone();q.setComponent(s.axis,value);return q;
}
// Offline authoring. Broad outer skins only; seams, mouldings and folded returns
// remain fixed. These are modest visual surface corrections, never real CAD.
export function rebuildBodyPanel(source:T.BufferGeometry,name:string){
 const s=(surfaces as Record<string,Surface>)[name];if(!s)return source.clone();
 const g=conformingTessellation(source,.04),p=g.getAttribute('position'),n=g.getAttribute('normal'),smooth=T.MathUtils.smoothstep;
 const groups=new Map<string,{p:T.Vector3;distance:number;edges:Set<string>}>();
 const keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(','));
 for(let i=0;i<p.count;i++){
  const point=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i);
  const a=groups.get(keys[i])??{p:point,distance:.07,edges:new Set<string>()};
  const eligible=s.axis===1?normal.y>.8:Math.abs(normal.x)>.91&&Math.abs(point.x)>.83&&point.y>.33&&point.y<.77;
  if(!eligible)a.distance=0;groups.set(keys[i],a);
 }
 for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=keys[i+j],b=keys[i+(j+1)%3];groups.get(a)!.edges.add(b);groups.get(b)!.edges.add(a);}
 for(let pass=0;pass<12;pass++)for(const a of groups.values())for(const k of a.edges){const b=groups.get(k)!;a.distance=Math.min(a.distance,b.distance+a.p.distanceTo(b.p));}
 let changed=0,maxDisplacement=0;
 for(let i=0;i<p.count;i++){
  const a=groups.get(keys[i])!,point=a.p;
  let weight=smooth(a.distance,0,.045);
  if(s.kind==='roof')weight*=smooth(point.y,1.33,1.36)*(1-smooth(Math.abs(point.x),.48,.54))*smooth(point.z,-1.3,-1.22)*(1-smooth(point.z,.02,.10));
  else if(s.kind==='trunk')weight*=smooth(point.y,1.0,1.018)*(1-smooth(Math.abs(point.x),.55,.61))*smooth(point.z,-2.45,-2.39)*(1-smooth(point.z,-1.98,-1.91));
  else weight*=smooth(point.y,.33,.37)*(1-smooth(point.y,.72,.77))*(1-(smooth(point.y,.458,.477)*(1-smooth(point.y,.53,.55))));
  if(weight<1e-8)continue;
  const delta=bodySurfacePoint(name,point).sub(point).clampLength(0,.003).multiplyScalar(weight);
  p.setXYZ(i,point.x+delta.x,point.y+delta.y,point.z+delta.z);
  if(delta.length()>1e-7)changed++;maxDisplacement=Math.max(maxDisplacement,delta.length());
 }
 const final=panelNormals(g);g.dispose();final.computeBoundingBox();final.computeBoundingSphere();
 final.userData.bodyRebuild={changed,maxDisplacement,kind:s.kind,method:'bounded sparse polynomial skin with fixed panel interfaces'};return final;
}
