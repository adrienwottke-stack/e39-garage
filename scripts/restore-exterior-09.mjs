// 0.10.1 correction: preserve the 0.9 exterior instead of promoting the rejected
// 0.10 surface fit, mirror additions and M-Tech rear as a visual improvement.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,prune,unpartition} from '@gltf-transform/functions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const baseline='e39-body-9651faf179e2.glb',candidate='e39-vehicle-bd63dcca731a.glb';
const [source,doc]=await Promise.all([io.read('public/models/'+baseline),io.read('public/models/'+candidate)]);
const names=['pab_e39_roof','pab_e39_trunk','pab_e39_door_RL','pab_e39_door_RR','pab_e39_door_FL.032','pab_e39_door_FR.030'];
const nodes=new Map(doc.getRoot().listNodes().map(n=>[n.getName(),n]));
const old=new Map(source.getRoot().listNodes().map(n=>[n.getName(),n]));
const copies=copyToDocument(doc,source,names.map(name=>old.get(name).getMesh()));
for(const name of names){const node=nodes.get(name);node.setMesh(copies.get(old.get(name).getMesh()));const extras={...node.getExtras()};delete extras.surfaceRevision;node.setExtras(extras);}
const removed=[];
for(const node of [...doc.getRoot().listNodes()])if(/^pab_e39_bumper_R_m-tech$|^pab_e39_(?:intmirror|mirror_[LR])\.001$/.test(node.getName())){removed.push(node.getName());node.dispose();}
await doc.transform(prune(),unpartition());
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex'),file='e39-corrected-'+sha256.slice(0,12)+'.glb';
await fs.writeFile('public/models/'+file,bytes);
await fs.writeFile('src/model-version.ts',`export const MODEL_URL='/models/${file}';\n`);
const accessorEqual=(a,b)=>{if(!a||!b)return a===b;const x=a.getArray(),y=b.getArray();return a.getType()===b.getType()&&x.constructor===y.constructor&&Buffer.from(x.buffer,x.byteOffset,x.byteLength).equals(Buffer.from(y.buffer,y.byteOffset,y.byteLength));};
const output=await io.readBinary(bytes);
const verified=[];
for(const name of [...names,...old.keys()].filter((n,i,a)=>a.indexOf(n)===i&&(/^pab_e39_(?:hood|grille|fender_[LR]|headlight.*|bumper_[FR].*|taillight.*)$/.test(n)||names.includes(n)))){
 const before=old.get(name),after=output.getRoot().listNodes().find(n=>n.getName()===name);if(!after)throw Error('Missing baseline exterior: '+name);
 for(const get of ['getTranslation','getRotation','getScale'])if(JSON.stringify(before[get]())!==JSON.stringify(after[get]()))throw Error('Transform differs: '+name);
 const p=before.getMesh()?.listPrimitives()??[],q=after.getMesh()?.listPrimitives()??[];if(p.length!==q.length)throw Error('Primitive count differs: '+name);
 for(let i=0;i<p.length;i++){if(!accessorEqual(p[i].getIndices(),q[i].getIndices()))throw Error('Index differs: '+name);for(const key of ['POSITION','NORMAL'])if(!accessorEqual(p[i].getAttribute(key),q[i].getAttribute(key)))throw Error(key+' differs: '+name);}
 verified.push(name);
}
const proof={version:'0.10.1',baseline,candidate,file,sha256,bytes:bytes.length,restoredPanels:names,removed,verifiedBaselineExterior:verified,positionsNormalsIndicesAndTransformsIdentical:true,engineAssemblyPreserved:output.getRoot().listNodes().filter(n=>n.getExtras().engineAssembly).length,reason:'User rejected the overall 0.10 exterior. Restore approved exterior and evaluate future changes individually.'};
if(proof.engineAssemblyPreserved<8)throw Error('Engine selection assemblies missing');
await fs.writeFile('model-cache/exterior-09-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
