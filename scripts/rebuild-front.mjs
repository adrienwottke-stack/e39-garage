import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';

// Compile the authoring function locally. Browser clients load the finished
// mesh; fitting/tessellation never runs on the user's phone.
await fs.mkdir('model-cache',{recursive:true});
const source=(await fs.readFile('src/front-panels.ts','utf8')).replace("import surfaces from './front-surfaces.json';",'const surfaces='+await fs.readFile('src/front-surfaces.json','utf8')+';');
const compiled=stripTypeScriptTypes(source);
await fs.writeFile('model-cache/front-panels.mjs',compiled);
const {rebuildFrontPanel}=await import(pathToFileURL(path.resolve('model-cache/front-panels.mjs')).href);
const io=new NodeIO(),doc=await io.read('public/models/e39-b0aae9fcac8c.glb'),buffer=doc.getRoot().listBuffers()[0],stats=[];
for(const node of doc.getRoot().listNodes()) {
  if(!/^pab_e39_(hood|fender_[LR])$/.test(node.getName()))continue;
  for(const primitive of node.getMesh()?.listPrimitives()??[]) {
    if(primitive.getMaterial()?.getName()!=='pab_e39_paint')continue;
    const geometry=new T.BufferGeometry();
    for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])geometry.setAttribute(key,new T.Float32BufferAttribute(Array.from(primitive.getAttribute(semantic).getArray()),3));
    geometry.setIndex(Array.from(primitive.getIndices().getArray()));
    const next=rebuildFrontPanel(geometry,node.getName());
    primitive.setIndices(null);
    for(const semantic of primitive.listSemantics())primitive.setAttribute(semantic,null);
    for(const [semantic,key]of [['POSITION','position'],['NORMAL','normal']])primitive.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(next.getAttribute(key).array)).setBuffer(buffer));
    node.setExtras({...node.getExtras(),frontRevision:'0.8'});
    stats.push({name:node.getName(),vertices:next.getAttribute('position').count,...next.userData.frontRebuild});
    geometry.dispose();next.dispose();
  }
}
// Prune only orphaned accessors; all other geometry/materials remain unchanged.
for(const a of doc.getRoot().listAccessors())if(a.listParents().length===1)a.dispose();
const bytes=await io.writeBinary(doc),hash=createHash('sha256').update(bytes).digest('hex');
const file=`e39-front-${hash.slice(0,12)}.glb`;
await fs.writeFile('public/models/'+file,bytes);
await fs.writeFile('src/model-version.ts',`export const MODEL_URL='/models/${file}';\n`);
await fs.writeFile('model-cache/front-proof.json',JSON.stringify({source:'e39-b0aae9fcac8c.glb',file,sha256:hash,bytes:bytes.length,stats},null,2));
console.log(JSON.stringify({file,bytes:bytes.length,stats}));
