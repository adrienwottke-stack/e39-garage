import * as T from 'three';
import {conformingTessellation} from './mesh-subdivision';
import frontDefinitions from './front-surfaces.json';
import shoulderDefinition from './shoulder-surface.json';

type Panel='hood'|'fender-L'|'fender-R';
type Vertex={point:T.Vector3;original:T.Vector3;neighbors:Set<number>;fixed:boolean;distance:number;weight:number};
const smooth=(value:number)=>{const x=T.MathUtils.clamp(value,0,1);return x*x*x*(x*(x*6-15)+10);};

function basis(value:number,count:number) {
  const t=T.MathUtils.clamp(value,0,1-1e-10),knots=[0,0,0];
  for(let i=0;i<=count-3;i++)knots.push(i/(count-3));knots.push(1,1,1);
  let b:number[]=knots.slice(0,-1).map((v,i)=>t>=v&&t<knots[i+1]?1:0);
  for(let degree=1;degree<=3;degree++)b=Array.from({length:knots.length-degree-1},(_,i)=>{
    const a=knots[i+degree]-knots[i],c=knots[i+degree+1]-knots[i+1];
    return (a?(t-knots[i])/a*b[i]:0)+(c?(knots[i+degree+1]-t)/c*b[i+1]:0);
  });
  return b;
}

function surface(panel:Panel,point:T.Vector3) {
  if(panel==='hood') {
    const u=point.x/.8,v=(point.z-1.4)/.7;
    const y=frontDefinitions.pab_e39_hood.coeff.reduce((sum,row,i)=>sum+row.reduce((s,c,j)=>s+c*u**(2*i)*v**j,0),0);
    return new T.Vector3(point.x,y,point.z);
  }
  const theta=Math.atan2(Math.abs(point.x)-.70,point.y-.57),a=basis(theta/1.6,shoulderDefinition.uCount),b=basis((point.z-.65)/1.35,shoulderDefinition.vCount);
  const r=shoulderDefinition.coeff.reduce((sum,row,i)=>sum+row.reduce((s,c,j)=>s+c*a[i]*b[j],0),0),side=panel==='fender-L'?1:-1;
  return new T.Vector3(side*(.70+r*Math.sin(theta)),.57+r*Math.cos(theta),point.z);
}

function surfaceNormal(panel:Panel,p:T.Vector3) {
  const h=.0001;
  if(panel==='hood'){
    const dx=surface(panel,p.clone().add(new T.Vector3(h,0,0))).sub(surface(panel,p.clone().add(new T.Vector3(-h,0,0))));
    const dz=surface(panel,p.clone().add(new T.Vector3(0,0,h))).sub(surface(panel,p.clone().add(new T.Vector3(0,0,-h))));
    return dz.cross(dx).normalize();
  }
  const side=panel==='fender-L'?1:-1,theta=Math.atan2(Math.abs(p.x)-.7,p.y-.57),r=Math.hypot(Math.abs(p.x)-.7,p.y-.57);
  const sample=(t:number,z:number)=>surface(panel,new T.Vector3(side*(.7+r*Math.sin(t)),.57+r*Math.cos(t),z));
  const dt=sample(theta+h,p.z).sub(sample(theta-h,p.z)),dz=sample(theta,p.z+h).sub(sample(theta,p.z-h));
  const n=dt.cross(dz).normalize();if(n.x*side<0)n.negate();return n;
}

/** Smooth only connected face fans across non-crease edges, never through a panel gap. */
export function connectedPanelNormals(source:T.BufferGeometry,creaseDegrees=50) {
  const geometry=source.index?source.toNonIndexed():source.clone(),p=geometry.getAttribute('position'),faceNormals:T.Vector3[]=[],angles:number[][]=[];
  const ids:number[]=[],keys=new Map<string,number>(),incident:number[][]=[],edges=new Map<string,number[]>();
  for(let i=0;i<p.count;i++) {
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(',');
    let id=keys.get(key);if(id===undefined){id=keys.size;keys.set(key,id);incident.push([]);}ids.push(id);
  }
  for(let i=0;i<p.count;i+=3){
    const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
    const face=i/3;faceNormals.push(normal);angles.push(v.map((q,k)=>v[(k+1)%3].clone().sub(q).angleTo(v[(k+2)%3].clone().sub(q))));
    for(let k=0;k<3;k++){
      const a=ids[i+k],b=ids[i+(k+1)%3];incident[a].push(face);
      const key=a<b?`${a}:${b}`:`${b}:${a}`,list=edges.get(key)??[];list.push(face);edges.set(key,list);
    }
  }
  const cosine=Math.cos(T.MathUtils.degToRad(creaseDegrees)),normal=new Float32Array(p.count*3),links=incident.map(()=>new Map<number,Set<number>>());
  for(const [key,faces] of edges){
    if(faces.length!==2||faceNormals[faces[0]].dot(faceNormals[faces[1]])<cosine)continue;
    for(const vertex of key.split(':').map(Number))for(const [a,b] of [[faces[0],faces[1]],[faces[1],faces[0]]]){
      const fan=links[vertex].get(a)??new Set<number>();fan.add(b);links[vertex].set(a,fan);
    }
  }
  incident.forEach((faces,vertex)=>{
    const pending=new Set(faces);
    while(pending.size){
      const first=pending.values().next().value!;const queue=[first],component:number[]=[];pending.delete(first);
      while(queue.length){const face=queue.pop()!;component.push(face);for(const neighbor of links[vertex].get(face)??[])if(pending.delete(neighbor))queue.push(neighbor);}
      const sum=new T.Vector3();
      for(const face of component){const corner=[0,1,2].find(k=>ids[face*3+k]===vertex)!;sum.addScaledVector(faceNormals[face],angles[face][corner]);}
      if(sum.lengthSq()<1e-18)sum.copy(faceNormals[first]);sum.normalize();
      for(const face of component)for(let k=0;k<3;k++)if(ids[face*3+k]===vertex)sum.toArray(normal,(face*3+k)*3);
    }
  });
  geometry.setAttribute('normal',new T.BufferAttribute(normal,3));return geometry;
}

function graphDistance(vertices:Vertex[]) {
  // Multi-source Dijkstra with a binary heap gives a geometric transition width,
  // independent of triangle order and local tessellation density.
  const heap:{id:number;distance:number}[]=[];
  const push=(entry:{id:number;distance:number})=>{let i=heap.length;heap.push(entry);while(i){const parent=(i-1)>>1;if(heap[parent].distance<=entry.distance)break;heap[i]=heap[parent];i=parent;}heap[i]=entry;};
  const pop=()=>{const first=heap[0],tail=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].distance<heap[child].distance)child++;if(heap[child].distance>=tail.distance)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return first;};
  vertices.forEach((v,id)=>{if(v.fixed){v.distance=0;push({id,distance:0});}});
  while(heap.length){
    const entry=pop(),v=vertices[entry.id];if(entry.distance!==v.distance)continue;
    for(const id of v.neighbors){const candidate=v.distance+v.original.distanceTo(vertices[id].original);if(candidate<vertices[id].distance){vertices[id].distance=candidate;push({id,distance:candidate});}}
  }
}

export function reconstructContinuousPanel(source:T.BufferGeometry,panel:Panel) {
  // Start from the pre-warp reference mesh. Shared edges are divided on both
  // sides before any position is changed, so a curved warp cannot open a crack.
  const maxEdge=panel==='hood'?.024:.008;
  const dense=conformingTessellation(source,maxEdge),p=dense.getAttribute('position'),n=dense.getAttribute('normal');
  const vertices:Vertex[]=[],ids:number[]=[],welded=new Map<string,number>(),edges=new Map<string,{a:number;b:number;count:number}>();
  const side=panel==='fender-L'?1:-1;
  for(let i=0;i<p.count;i++){
    const point=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i).normalize(),theta=Math.atan2(Math.abs(point.x)-.70,point.y-.57);
    const eligible=panel==='hood'
      ?normal.y>.28&&point.y>.70&&point.z>.73&&point.z<2.045&&Math.abs(point.x)<.782
      :normal.x*side>-.02&&normal.y>-.16&&point.y>.595&&point.z>.70&&point.z<1.98&&theta>.015&&theta<1.57;
    const key=[point.x,point.y,point.z].map(v=>Math.round(v*1e6)).join(',');
    let id=welded.get(key);
    if(id===undefined){id=vertices.length;welded.set(key,id);vertices.push({point:point.clone(),original:point,fixed:!eligible,neighbors:new Set(),distance:Infinity,weight:0});}
    else if(!eligible)vertices[id].fixed=true;
    ids.push(id);
  }
  for(let i=0;i<ids.length;i+=3)for(let k=0;k<3;k++){
    const a=ids[i+k],b=ids[i+(k+1)%3];if(a===b)continue;vertices[a].neighbors.add(b);vertices[b].neighbors.add(a);
    const key=a<b?`${a}:${b}`:`${b}:${a}`,edge=edges.get(key)??{a,b,count:0};edge.count++;edges.set(key,edge);
  }
  edges.forEach(edge=>{if(edge.count!==2){vertices[edge.a].fixed=true;vertices[edge.b].fixed=true;}});
  graphDistance(vertices);
  let changed=0,maxDisplacement=0;
  for(const vertex of vertices){
    if(vertex.fixed)continue;
    const transition=panel==='hood'?.085:.065;
    vertex.weight=smooth(vertex.distance/transition);
    const desired=surface(panel,vertex.original),delta=desired.sub(vertex.original);
    const displacement=delta.length();
    if(displacement>.035){vertex.weight=0;continue;}
    // Fade the fender fit before its displacement limit. A hard accept/reject
    // threshold leaves triangle-sized ridges along the fitted patch boundary.
    if(panel!=='hood')vertex.weight*=smooth((.035-displacement)/.010);
    vertex.point.addScaledVector(delta,vertex.weight);
    const length=vertex.point.distanceTo(vertex.original);if(length>1e-8)changed++;maxDisplacement=Math.max(maxDisplacement,length);
  }
  ids.forEach((id,i)=>{const point=vertices[id].point;p.setXYZ(i,point.x,point.y,point.z);});
  const result=connectedPanelNormals(dense);dense.dispose();
  const normals=result.getAttribute('normal');
  ids.forEach((id,i)=>{
    // On the dense fenders use one connected geometric normal field across
    // both the fitted skin and its transition. Switching between analytic and
    // geometric normals at individual vertices reveals the old triangle grid.
    if(panel!=='hood')return;
    const vertex=vertices[id];if(vertex.weight<.999999)return;
    const analytic=surfaceNormal(panel,vertex.point),geometric=new T.Vector3().fromBufferAttribute(normals,i);
    if(analytic.dot(geometric)>.7)normals.setXYZ(i,analytic.x,analytic.y,analytic.z);
  });
  result.computeBoundingBox();result.computeBoundingSphere();
  result.userData={continuousPanel:true,authoredPanelNormals:true,surfaceRevision:panel==='hood'?'0.12':'0.12-fender-closeup',panel,reconstruction:{changed,maxDisplacement,maxEdge,sourceVertices:source.getAttribute('position').count,vertices:p.count,method:'shared-edge conforming tessellation; pinned interfaces; continuous transition; connected geometric fender normals'}};
  return result;
}
