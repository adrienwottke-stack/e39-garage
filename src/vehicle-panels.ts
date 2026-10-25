import * as T from 'three';
import {panelNormals} from './panel-normals';

/** Millimetre-bounded fairing. Panel seams, folded returns and arch lips stay fixed. */
export function fairVehicleSkin(source:T.BufferGeometry, panel:'hood'|'fender') {
  if(source.userData.continuousPanel&&source.userData.authoredPanelNormals)return source.clone();
  const g=source.index?source.toNonIndexed():source.clone();
  const p=g.getAttribute('position'), n=g.getAttribute('normal');
  const nodes:{p:T.Vector3; original:T.Vector3; fixed:boolean; neighbors:Set<number>}[]=[], ids:number[]=[], welded=new Map<string,number>();
  const edgeUse=new Map<string,{a:number;b:number;count:number}>();
  for(let i=0;i<p.count;i++) {
    const v=new T.Vector3().fromBufferAttribute(p,i), normal=new T.Vector3().fromBufferAttribute(n,i);
    const eligible=panel==='hood'
      ? normal.y>.7&&v.z>.86&&v.z<1.99&&Math.abs(v.x)<.73
      : Math.abs(normal.x)>.18&&normal.y>-.02&&v.y>.635&&v.z>.82&&v.z<1.89;
    const key=[v.x,v.y,v.z].map(value=>Math.round(value*1e6)).join(',');
    let id=welded.get(key);
    if(id===undefined){id=nodes.length;welded.set(key,id);nodes.push({p:v.clone(),original:v,fixed:!eligible,neighbors:new Set()});}
    else if(!eligible)nodes[id].fixed=true;
    ids.push(id);
  }
  for(let i=0;i<ids.length;i+=3)for(let k=0;k<3;k++) {
    const a=ids[i+k], b=ids[i+(k+1)%3]; if(a===b)continue;
    nodes[a].neighbors.add(b);nodes[b].neighbors.add(a);
    const key=a<b?`${a}:${b}`:`${b}:${a}`, edge=edgeUse.get(key)??{a,b,count:0};edge.count++;edgeUse.set(key,edge);
  }
  edgeUse.forEach(edge=>{if(edge.count!==2){nodes[edge.a].fixed=true;nodes[edge.b].fixed=true;}});
  const bound=panel==='hood'?.0018:.0012;
  for(let pass=0;pass<7;pass++)for(const amount of [.46,-.47]) {
    const next=nodes.map(node=>{
      if(node.fixed||node.neighbors.size<3)return node.p.clone();
      const mean=new T.Vector3();node.neighbors.forEach(id=>mean.add(nodes[id].p));mean.divideScalar(node.neighbors.size);
      const v=node.p.clone().lerp(mean,amount), delta=v.clone().sub(node.original).clampLength(0,bound);
      return node.original.clone().add(delta);
    });
    nodes.forEach((node,i)=>node.p.copy(next[i]));
  }
  let maxDisplacement=0;
  ids.forEach((id,i)=>{const node=nodes[id];p.setXYZ(i,node.p.x,node.p.y,node.p.z);maxDisplacement=Math.max(maxDisplacement,node.p.distanceTo(node.original));});
  const result=panelNormals(g);g.dispose();result.computeBoundingBox();result.computeBoundingSphere();
  result.userData.surfaceRefinement={panel,maxDisplacement,bound,method:'fixed-boundary Taubin fairing'};
  return result;
}

/** A closed inner roof skin follows the fitted roof; no invented cross-members. */
export function createHeadliner() {
  const positions:number[]=[],indices:number[]=[];
  const columns=24,rows=30;
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++) {
    const u=i/columns*2-1, v=j/rows;
    const z=-1.36+v*1.50, halfWidth=.535+.020*Math.sin(v*Math.PI);
    positions.push(u*halfWidth,1.365+.022*Math.sin(v*Math.PI)-.036*u*u,z);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++) {
    const a=j*(columns+1)+i,b=a+columns+1;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
  return geometry;
}

export function vehicleBodyOffset(lowering=0) { return -T.MathUtils.clamp(lowering,0,55)/1000; }
