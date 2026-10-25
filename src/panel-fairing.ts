import * as T from 'three';
import {panelNormals} from './panel-normals';

// Small bounded fairing of the existing skin. Open boundaries, panel gaps and
// sharp creases remain fixed; nothing is globally scaled to guessed dimensions.
export function fairPanel(source:T.BufferGeometry) {
  const g=source.index?source.toNonIndexed():source.clone(),p=g.getAttribute('position');
  const positions:T.Vector3[]=[],map=new Map<string,number>(),ids:number[]=[],neighbors:Set<number>[]=[],edges=new Map<string,{a:number;b:number;normals:T.Vector3[]}>();
  const original:T.Vector3[]=[];
  for(let i=0;i<p.count;i++){
    const key=`${Math.round(p.getX(i)*100000)},${Math.round(p.getY(i)*100000)},${Math.round(p.getZ(i)*100000)}`;
    let id=map.get(key);
    if(id===undefined){id=positions.length;map.set(key,id);positions.push(new T.Vector3().fromBufferAttribute(p,i));neighbors.push(new Set());}
    ids.push(id);
  }
  positions.forEach(v=>original.push(v.clone()));
  for(let i=0;i<ids.length;i+=3){
    const tri=ids.slice(i,i+3),[a,b,c]=tri.map(id=>positions[id]);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(normal.lengthSq()<0.5)continue;
    for(let j=0;j<3;j++){
      const u=tri[j],v=tri[(j+1)%3];if(u===v)continue;
      neighbors[u].add(v);neighbors[v].add(u);
      const key=u<v?`${u}:${v}`:`${v}:${u}`,edge=edges.get(key)??{a:u,b:v,normals:[]};edge.normals.push(normal);edges.set(key,edge);
    }
  }
  const fixed=new Set<number>();
  for(const edge of edges.values())if(edge.normals.length!==2||edge.normals[0].dot(edge.normals[1])<0.65){fixed.add(edge.a);fixed.add(edge.b);}
  for(let step=0;step<10;step++)for(const factor of [0.5,-0.53]){
    const next=positions.map((v,i)=>{
      if(fixed.has(i)||neighbors[i].size<3)return v.clone();
      const mean=new T.Vector3();neighbors[i].forEach(j=>mean.add(positions[j]));mean.multiplyScalar(1/neighbors[i].size);
      const target=v.clone().lerp(mean,factor),delta=target.clone().sub(original[i]);
      if(delta.length()>0.012)target.copy(original[i]).add(delta.setLength(0.012));
      return target;
    });
    next.forEach((v,i)=>positions[i].copy(v));
  }
  ids.forEach((id,i)=>p.setXYZ(i,positions[id].x,positions[id].y,positions[id].z));
  const result=panelNormals(g);g.dispose();return result;
}
