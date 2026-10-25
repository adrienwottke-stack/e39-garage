import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),output=[];
const reconstructed=JSON.parse(await fs.readFile('proofs/2026-10-24/fidelity/reconstruction.json','utf8').catch(()=>'null'));
for(const file of ['e39-b0aae9fcac8c.glb','e39-front-492b973651b6.glb','e39-body-9651faf179e2.glb',...(reconstructed?[reconstructed.file]:[])]){
 const doc=await io.read('public/models/'+file);
 for(const node of doc.getRoot().listNodes().filter(n=>/^pab_e39_(hood|fender_[LR]|roof|trunk|door_[FR][LR])$/.test(n.getName())))for(const primitive of node.getMesh()?.listPrimitives()??[]){
  if(primitive.getMaterial()?.getName()!=='pab_e39_paint')continue;
  const pa=primitive.getAttribute('POSITION').getArray(),na=primitive.getAttribute('NORMAL').getArray(),ix=primitive.getIndices()?.getArray()??Array.from({length:pa.length/3},(_,i)=>i),groups=new Map(),edges=new Map(),triangles=new Map();
  const point=i=>new T.Vector3().fromArray(pa,i*3),normal=i=>new T.Vector3().fromArray(na,i*3),key=i=>[0,1,2].map(k=>Math.round(pa[i*3+k]*1e6)).join(',');
  let degenerate=0,duplicates=0;
  for(let i=0;i<ix.length;i+=3){
   const ids=Array.from(ix.slice(i,i+3)),keys=ids.map(key),points=ids.map(point),face=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
   if(face.length()<1e-10)degenerate++;face.normalize();
   const triKey=keys.toSorted().join('|');if(triangles.has(triKey))duplicates++;triangles.set(triKey,1);
   for(let k=0;k<3;k++){
    const item=groups.get(keys[k])??{p:points[k],normals:[],faces:[]};item.normals.push(normal(ids[k]));item.faces.push(face);groups.set(keys[k],item);
    const e=[keys[k],keys[(k+1)%3]].toSorted().join('|'),edge=edges.get(e)??{a:points[k],b:points[(k+1)%3],faces:[]};edge.faces.push(face);edges.set(e,edge);
   }
  }
  let normalSeams=0,interiorNormalSeams=0,maxNormalSplit=0,internalBoundary=0;
  for(const group of groups.values()){
   const p=group.p;if(p.y<.62)continue;
   let split=0;for(const a of group.normals)for(const b of group.normals)split=Math.max(split,a.angleTo(b));
   if(split>.03)normalSeams++;maxNormalSplit=Math.max(maxNormalSplit,split);
   const faceMin=Math.min(...group.faces.map(a=>a.y));
   if(split>.03&&faceMin>.45&&Math.abs(p.x)<.69&&p.z>.89&&p.z<1.96)interiorNormalSeams++;
  }
  const edgeBends=[],boundaryEdges=[],outerBends=[];
  for(const edge of edges.values()){
   const p=edge.a.clone().add(edge.b).multiplyScalar(.5);
   if(p.y<.68||Math.abs(p.x)>.71||p.z<.90||p.z>1.94)continue;
   if(edge.faces.length===1){internalBoundary++;boundaryEdges.push({a:edge.a.toArray(),b:edge.b.toArray()});}
   if(edge.faces.length===2){const degrees=T.MathUtils.radToDeg(edge.faces[0].angleTo(edge.faces[1]));edgeBends.push(degrees);if(edge.faces.every(n=>n.y>.3))outerBends.push(degrees);}
  }
  edgeBends.sort((a,b)=>a-b);outerBends.sort((a,b)=>a-b);
  output.push({file,node:node.getName(),vertices:pa.length/3,triangles:ix.length/3,welded:groups.size,degenerate,duplicates,normalSeams,interiorNormalSeams,maxNormalSplitDeg:T.MathUtils.radToDeg(maxNormalSplit),internalBoundary,edgeBends:edgeBends.length?{p50:edgeBends[Math.floor(edgeBends.length*.5)],p95:edgeBends[Math.floor(edgeBends.length*.95)],max:edgeBends.at(-1)}:null,outerBends:outerBends.length?{p50:outerBends[Math.floor(outerBends.length*.5)],p95:outerBends[Math.floor(outerBends.length*.95)],max:outerBends.at(-1)}:null});
  if(/hood|fender/.test(node.getName()))await fs.writeFile('proofs/2026-10-24/fidelity/boundaries-'+file.replace('.glb','')+'-'+node.getName()+'.json',JSON.stringify(boundaryEdges));
 }
}
await fs.mkdir('proofs/2026-10-24/fidelity',{recursive:true});
await fs.writeFile('proofs/2026-10-24/fidelity/panel-diagnosis.json',JSON.stringify(output,null,2));
console.log(JSON.stringify(output.filter(x=>/hood|fender/.test(x.node)),null,2));
