import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';

const output='proofs/feedback-runde-2',runtime=output+'/authoring-runtime';
await fs.mkdir(runtime,{recursive:true});
await fs.writeFile(runtime+'/mesh-subdivision.mjs',stripTypeScriptTypes(await fs.readFile('src/mesh-subdivision.ts','utf8')));
let code=await fs.readFile('src/continuous-panels.ts','utf8');
code=code.replace("'./mesh-subdivision'","'./mesh-subdivision.mjs'")
 .replace("import frontDefinitions from './front-surfaces.json';",'const frontDefinitions='+await fs.readFile('src/front-surfaces.json','utf8')+';')
 .replace("import shoulderDefinition from './shoulder-surface.json';",'const shoulderDefinition='+await fs.readFile('src/shoulder-surface.json','utf8')+';');
await fs.writeFile(runtime+'/continuous-panels.mjs',stripTypeScriptTypes(code));
const {reconstructContinuousPanel}=await import(pathToFileURL(path.resolve(runtime+'/continuous-panels.mjs')).href);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),source='public/models/e39-continuous-8921c0c566ef.glb';
const doc=await io.read(source),reference=await io.read('public/models/e39-b0aae9fcac8c.glb'),buffer=doc.getRoot().listBuffers()[0];
const target=(node,p)=>/^pab_e39_fender_[LR]$/.test(node.getName())&&p.getMaterial()?.getName()==='pab_e39_paint';
function preserved(document){
 const hash=createHash('sha256');
 for(const node of document.getRoot().listNodes()){
  hash.update(JSON.stringify([node.getName(),node.getTranslation(),node.getRotation(),node.getScale()]));
  for(const p of node.getMesh()?.listPrimitives()??[]){if(target(node,p))continue;
   hash.update(JSON.stringify([p.getMaterial()?.getName(),p.getExtras(),p.getMode()]));
   for(const semantic of p.listSemantics()){hash.update(semantic);const a=p.getAttribute(semantic).getArray();hash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}
   const a=p.getIndices()?.getArray();if(a)hash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
  }
 }
 return hash.digest('hex');
}
const beforePreserved=preserved(doc),stats=[];
for(const node of doc.getRoot().listNodes()){
 if(!/^pab_e39_fender_[LR]$/.test(node.getName()))continue;
 const original=reference.getRoot().listNodes().find(n=>n.getName()===node.getName()).getMesh().listPrimitives().find(p=>p.getMaterial()?.getName()==='pab_e39_paint');
 const current=node.getMesh().listPrimitives().find(p=>target(node,p));
 const beforeTriangles=(current.getIndices()?.getCount()??current.getAttribute('POSITION').getCount())/3;
 const geometry=new T.BufferGeometry();
 for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])geometry.setAttribute(key,new T.Float32BufferAttribute(original.getAttribute(semantic).getArray(),3));
 if(original.getIndices())geometry.setIndex(Array.from(original.getIndices().getArray()));
 const next=reconstructContinuousPanel(geometry,node.getName().endsWith('_L')?'fender-L':'fender-R');
 const pa=next.getAttribute('position'),na=next.getAttribute('normal');
 assert(Array.from(pa.array).every(Number.isFinite));assert(Array.from(na.array).every(Number.isFinite));
 let maxNormalLengthError=0,degenerate=0;
 for(let i=0;i<na.count;i++)maxNormalLengthError=Math.max(maxNormalLengthError,Math.abs(Math.hypot(na.getX(i),na.getY(i),na.getZ(i))-1));
 for(let i=0;i<pa.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pa,i),b=new T.Vector3().fromBufferAttribute(pa,i+1),c=new T.Vector3().fromBufferAttribute(pa,i+2);if(b.sub(a).cross(c.sub(a)).length()<1e-10)degenerate++;}
 assert(maxNormalLengthError<1e-5);assert.equal(degenerate,0);assert(pa.count/3>beforeTriangles*4);
 current.setIndices(null);for(const semantic of current.listSemantics())current.setAttribute(semantic,null);
 for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])current.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(next.getAttribute(key).array)).setBuffer(buffer));
 current.setExtras({...current.getExtras(),...next.userData});node.setExtras({...node.getExtras(),continuousPanel:true,authoredPanelNormals:true,surfaceRevision:'0.12-fender-closeup'});
 stats.push({node:node.getName(),beforeTriangles,afterTriangles:pa.count/3,maxNormalLengthError,degenerate,...next.userData.reconstruction});
 geometry.dispose();next.dispose();
}
assert.equal(preserved(doc),beforePreserved);
for(const a of doc.getRoot().listAccessors())if(a.listParents().length===1)a.dispose();
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex'),file='e39-fenders-'+sha256.slice(0,12)+'.glb';
await fs.writeFile('public/models/'+file,bytes);
assert.equal(preserved(await io.read('public/models/'+file)),beforePreserved);
const proof={source,file,sha256,bytes:bytes.length,stats,nonFenderGeometryAndTransformsUnchanged:true,untouchedDigest:beforePreserved,changes:'Only front fender paint primitives replaced. Hood, all other geometry and transforms retained; materials and lights not edited.'};
await fs.writeFile(output+'/reconstruction.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
