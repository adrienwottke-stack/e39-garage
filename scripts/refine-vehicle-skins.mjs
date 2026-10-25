import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';

const output='proofs/2026-10-24/fidelity',runtime=output+'/authoring-runtime';
await fs.mkdir(runtime,{recursive:true});
await fs.writeFile(runtime+'/mesh-subdivision.mjs',stripTypeScriptTypes(await fs.readFile('src/mesh-subdivision.ts','utf8')));
let code=await fs.readFile('src/continuous-panels.ts','utf8');
code=code.replace("'./mesh-subdivision'","'./mesh-subdivision.mjs'")
 .replace("import frontDefinitions from './front-surfaces.json';",'const frontDefinitions='+await fs.readFile('src/front-surfaces.json','utf8')+';')
 .replace("import shoulderDefinition from './shoulder-surface.json';",'const shoulderDefinition='+await fs.readFile('src/shoulder-surface.json','utf8')+';');
await fs.writeFile(runtime+'/continuous-panels.mjs',stripTypeScriptTypes(code));
const {reconstructContinuousPanel}=await import(pathToFileURL(path.resolve(runtime+'/continuous-panels.mjs')).href);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),active='public/models/e39-body-9651faf179e2.glb',reference='public/models/e39-b0aae9fcac8c.glb';
const doc=await io.read(active),base=await io.read(reference),buffer=doc.getRoot().listBuffers()[0],stats=[];
for(const node of doc.getRoot().listNodes()){
 if(!/^pab_e39_(hood|fender_[LR])$/.test(node.getName()))continue;
 const sourceNode=base.getRoot().listNodes().find(n=>n.getName()===node.getName());
 const original=sourceNode.getMesh().listPrimitives().find(p=>p.getMaterial()?.getName()==='pab_e39_paint');
 const current=node.getMesh().listPrimitives().find(p=>p.getMaterial()?.getName()==='pab_e39_paint');
 const geometry=new T.BufferGeometry();
 for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])geometry.setAttribute(key,new T.Float32BufferAttribute(original.getAttribute(semantic).getArray(),3));
 if(original.getIndices())geometry.setIndex(Array.from(original.getIndices().getArray()));
 const panel=node.getName().endsWith('hood')?'hood':node.getName().endsWith('_L')?'fender-L':'fender-R';
 const next=reconstructContinuousPanel(geometry,panel);
 current.setIndices(null);for(const semantic of current.listSemantics())current.setAttribute(semantic,null);
 for(const [semantic,key] of [['POSITION','position'],['NORMAL','normal']])current.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(new Float32Array(next.getAttribute(key).array)).setBuffer(buffer));
 current.setExtras({...current.getExtras(),...next.userData});node.setExtras({...node.getExtras(),continuousPanel:true,authoredPanelNormals:true,surfaceRevision:'0.12'});
 stats.push({node:node.getName(),...next.userData.reconstruction});geometry.dispose();next.dispose();
}
for(const accessor of doc.getRoot().listAccessors())if(accessor.listParents().length===1)accessor.dispose();
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex'),file='e39-continuous-'+sha256.slice(0,12)+'.glb';
await fs.writeFile('public/models/'+file,bytes);
const proof={source:active,reference,file,sha256,bytes:bytes.length,stats,unchanged:'All non-paint primitives and all nodes outside hood/fender L/fender R preserved from active document',runtimeContract:'Primitive geometry.userData and parent node.userData: continuousPanel=true, authoredPanelNormals=true, surfaceRevision=0.12; skip runtime fairing and normal recomputation'};
await fs.writeFile(output+'/reconstruction.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
