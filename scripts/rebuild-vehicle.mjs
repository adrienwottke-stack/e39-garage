// Build the 0.10 vehicle from the preserved 0.9 front revision and isolated
// matching assemblies. No runtime remeshing, remote requests or private photos.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,unpartition,prune} from '@gltf-transform/functions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base='e39-body-9651faf179e2.glb',doc=await io.read('public/models/'+base);
await fs.mkdir('model-cache',{recursive:true});
await fs.writeFile('model-cache/panel-normals.mjs',stripTypeScriptTypes(await fs.readFile('src/panel-normals.ts','utf8')));
await fs.writeFile('model-cache/mesh-subdivision.mjs',stripTypeScriptTypes(await fs.readFile('src/mesh-subdivision.ts','utf8')));
let bodyCode=await fs.readFile('src/body-panels.ts','utf8');
bodyCode=bodyCode.replace("import surfaces from './body-surfaces.json';",'const surfaces='+await fs.readFile('src/body-surfaces.json','utf8')+';').replace("'./panel-normals'","'./panel-normals.mjs'").replace("'./mesh-subdivision'","'./mesh-subdivision.mjs'");
await fs.writeFile('model-cache/body-panels.mjs',stripTypeScriptTypes(bodyCode));
const {rebuildBodyPanel}=await import(pathToFileURL(path.resolve('model-cache/body-panels.mjs')).href);
const definitions=JSON.parse(await fs.readFile('src/body-surfaces.json','utf8')),surfaceStats=[],buffer=doc.getRoot().listBuffers()[0];
for(const n of doc.getRoot().listNodes())if(definitions[n.getName()])for(const p of n.getMesh()?.listPrimitives()??[]){
 if(p.getMaterial()?.getName()!=='pab_e39_paint')continue;
 const source=new T.BufferGeometry();for(const [semantic,key]of [['POSITION','position'],['NORMAL','normal']])source.setAttribute(key,new T.Float32BufferAttribute(p.getAttribute(semantic).getArray(),3));
 if(p.getIndices())source.setIndex(Array.from(p.getIndices().getArray()));
 const geometry=rebuildBodyPanel(source,n.getName());
 p.setIndices(null);for(const semantic of p.listSemantics())p.setAttribute(semantic,null);
 for(const [semantic,key]of [['POSITION','position'],['NORMAL','normal']])p.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.getAttribute(key).array)).setBuffer(buffer));
 surfaceStats.push({name:n.getName(),...geometry.userData.bodyRebuild});n.setExtras({...n.getExtras(),surfaceRevision:'0.10'});source.dispose();geometry.dispose();
}
const scene=doc.getRoot().listScenes()[0],assemblies=[];
for(const file of ['e39-rear-7e3086f66be0.glb','e39-details-46325a505e03.glb']){
 const bytes=await fs.readFile('assets/source/'+file),part=await io.readBinary(bytes),nodes=[...part.getRoot().listNodes()];
 const map=mergeDocuments(doc,part);
 for(const source of nodes){const n=map.get(source);scene.addChild(n);}
 for(const s of [...doc.getRoot().listScenes()])if(s!==scene)s.dispose();
 assemblies.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),nodes:nodes.map(n=>n.getName())});
}
await fs.writeFile('model-cache/engine-parts.mjs',stripTypeScriptTypes(await fs.readFile('src/engine-parts.ts','utf8')));
const {enginePartAt}=await import(pathToFileURL(path.resolve('model-cache/engine-parts.mjs')).href),engineStats=[];
// Restore the detailed, texture-free inline-six reference and turn the existing
// bay fittings into the same selectable assembly, avoiding the old box overlay.
for(const n of [...doc.getRoot().listNodes()])if(/^pab_e39_(engine_(?:block_)?m52|engbaycrap(?:\.001)?)$/.test(n.getName())){
 for(const p of n.getMesh()?.listPrimitives()??[]){
  const a=p.getAttribute('POSITION').getArray(),norm=p.getAttribute('NORMAL')?.getArray(),ix=p.getIndices()?.getArray()??Array.from({length:a.length/3},(_,i)=>i),parts=new Map();
  for(let i=0;i<ix.length;i+=3){
   const c=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)c[k]+=a[ix[i+j]*3+k]/3;
   const id=enginePartAt(...c),key=id==='oil-filter'?(c[1]>.721?'oil-filter-cap':'oil-filter-housing'):id,part=parts.get(key)??{id,positions:[],normals:[]};
   for(let j=0;j<3;j++)for(let k=0;k<3;k++){part.positions.push(a[ix[i+j]*3+k]);part.normals.push(norm?.[ix[i+j]*3+k]??(k===1?1:0));}
   parts.set(key,part);
  }
  for(const [key,part]of parts){
   const primitive=doc.createPrimitive().setMaterial(p.getMaterial());
   for(const [semantic,array]of [['POSITION',part.positions],['NORMAL',part.normals]])primitive.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(array)).setBuffer(buffer));
   const node=doc.createNode('E39_engine_'+key.replaceAll('-','_')).setMesh(doc.createMesh().addPrimitive(primitive)).setExtras({component:part.id,engineAssembly:true,explodeCap:key==='oil-filter-cap',reference:'visual inline-six assembly; source M52, not exact M54 CAD'});
   scene.addChild(node);engineStats.push({part:key,triangles:part.positions.length/9,source:n.getName()});
  }
 }
 n.dispose();
}
await doc.transform(prune(),unpartition());
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex'),file='e39-vehicle-'+sha256.slice(0,12)+'.glb';
await fs.writeFile('public/models/'+file,bytes);
await fs.writeFile('src/model-version.ts',`export const MODEL_URL='/models/${file}';\n`);
await fs.mkdir('model-cache',{recursive:true});
await fs.writeFile('model-cache/vehicle-proof.json',JSON.stringify({base,file,sha256,bytes:bytes.length,assemblies,surfaceStats,engineStats},null,2));
console.log(JSON.stringify({file,bytes:bytes.length,assemblies,surfaceStats,engineTriangles:engineStats.reduce((s,p)=>s+p.triangles,0)}));
