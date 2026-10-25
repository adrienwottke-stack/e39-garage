import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {mergeDocuments,unpartition} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
await fs.mkdir('model-cache',{recursive:true});
await fs.writeFile('model-cache/panel-normals.mjs',stripTypeScriptTypes(await fs.readFile('src/panel-normals.ts','utf8')));
let code=await fs.readFile('src/shoulder-panels.ts','utf8');
code=code.replace("import definition from './shoulder-surface.json';",'const definition='+await fs.readFile('src/shoulder-surface.json','utf8')+';').replace("'./panel-normals'","'./panel-normals.mjs'");
await fs.writeFile('model-cache/shoulder-panels.mjs',stripTypeScriptTypes(code));
const {rebuildShoulder}=await import(pathToFileURL(path.resolve('model-cache/shoulder-panels.mjs')).href);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read('public/models/e39-front-492b973651b6.glb'),buffer=doc.getRoot().listBuffers()[0],stats=[];
for(const node of doc.getRoot().listNodes()) {
 if(!/^pab_e39_fender_[LR]$/.test(node.getName()))continue;
 for(const primitive of node.getMesh()?.listPrimitives()??[]) {
  if(primitive.getMaterial()?.getName()!=='pab_e39_paint')continue;
  const g=new T.BufferGeometry();
  for(const [semantic,key]of [['POSITION','position'],['NORMAL','normal']])g.setAttribute(key,new T.Float32BufferAttribute(primitive.getAttribute(semantic).getArray(),3));
  if(primitive.getIndices())g.setIndex(Array.from(primitive.getIndices().getArray()));
  const next=rebuildShoulder(g,node.getName().endsWith('_L')?1:-1);
  primitive.setIndices(null);
  for(const semantic of primitive.listSemantics())primitive.setAttribute(semantic,null);
  for(const [semantic,key]of [['POSITION','position'],['NORMAL','normal']])primitive.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(next.getAttribute(key).array)).setBuffer(buffer));
  node.setExtras({...node.getExtras(),frontRevision:'0.9'});
  stats.push({name:node.getName(),vertices:next.getAttribute('position').count,...next.userData.shoulderRebuild});g.dispose();next.dispose();
 }
}
// Only this separated, texture-free M-Technik part is imported, never the
// unrelated variants, plates or complete 51 MB source scene.
const mtech=await io.read('assets/source/e39-mtech-f6d2fb17641e.glb');
const sourceNode=mtech.getRoot().listNodes()[0];
const map=mergeDocuments(doc,mtech),node=map.get(sourceNode);
for(const scene of [...doc.getRoot().listScenes()])if(scene!==doc.getRoot().listScenes()[0])scene.dispose();
node.setExtras({...node.getExtras(),component:'body',frontRevision:'0.9',sourceAssembly:'M-Technik front'});
doc.getRoot().listScenes()[0].addChild(node);
for(const a of doc.getRoot().listAccessors())if(a.listParents().length===1)a.dispose();
await doc.transform(unpartition());
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex'),file=`e39-body-${sha256.slice(0,12)}.glb`;
await fs.writeFile('public/models/'+file,bytes);
await fs.writeFile('src/model-version.ts',`export const MODEL_URL='/models/${file}';\n`);
await fs.writeFile('model-cache/body-proof.json',JSON.stringify({source:'e39-front-492b973651b6.glb',file,sha256,bytes:bytes.length,stats},null,2));
console.log(JSON.stringify({file,bytes:bytes.length,stats}));
