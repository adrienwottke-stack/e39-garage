// Extract only the texture-free sedan M-Technik rear assembly from the locally
// supplied Merc_TV source. Run from the repository with a source GLB argument.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';

const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/extract-rear.mjs <source.glb>');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(source),root=doc.getRoot();
const keep=root.listNodes().find(n=>n.getName()==='pab_e39_bumper_R_m-tech');
if(!keep)throw new Error('Sedan M-Technik rear bumper is missing');
// The smaller historical app model omitted these red cover skins completely.
// Retain their fitted contours as compact geometry data, without any textures.
const lensNames=['pab_e39_taillightglass_L.002','pab_e39_taillightglass_L.003','pab_e39_taillightglass_R.001','pab_e39_taillightglass_R.002'];
const lenses=lensNames.map(name=>{
  const node=root.listNodes().find(n=>n.getName()===name);
  if(!node)throw new Error(`Missing fitted red cover ${name}`);
  const primitive=node.getMesh().listPrimitives()[0];
  return {name,position:Array.from(primitive.getAttribute('POSITION').getArray()),normal:Array.from(primitive.getAttribute('NORMAL').getArray()),index:Array.from(primitive.getIndices().getArray())};
});
await fs.writeFile('src/rear-geometry-lenses.json',JSON.stringify({source:'Merc_TV BMW 5 Series E39 MK4, CC-BY-4.0; fitted red tail lamp skins omitted from historical adaptation',lenses})+'\n');
const sourceTranslation=keep.getTranslation();
for(const node of [...root.listNodes()])if(node!==keep)node.dispose();
root.listScenes()[0].addChild(keep);
keep.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
keep.setExtras({component:'body',rearRevision:'0.10',assembly:'rear-bumper-m-tech',source:'https://sketchfab.com/3d-models/bmw-5-series-e39-mk4-1995-2003-a6a2a783c59b47e1b9d56e08bebcdfc9',author:'Merc_TV (szymonpasterczyk)',license:'CC-BY-4.0',modifications:'Selected sedan M-Technik rear bumper only, texture-free plain PBR, original metre coordinates. Additional photo-derived diffuser and exhaust are separate app geometry.'});
for(const primitive of keep.getMesh().listPrimitives()) {
  const name=primitive.getMaterial()?.getName()||'pab_e39_black_rough';
  const material=doc.createMaterial(name).setDoubleSided(true);
  if(name==='pab_e39_paint')material.setBaseColorFactor([.022,.07,.24,1]).setMetallicFactor(.5).setRoughnessFactor(.31);
  else material.setBaseColorFactor([.018,.022,.026,1]).setMetallicFactor(.02).setRoughnessFactor(.65);
  primitive.setMaterial(material);
  for(const semantic of primitive.listSemantics())if(!['POSITION','NORMAL'].includes(semantic))primitive.setAttribute(semantic,null);
}
await doc.transform(prune());
const bytes=await io.writeBinary(doc),sha256=createHash('sha256').update(bytes).digest('hex');
const file=`assets/source/e39-rear-${sha256.slice(0,12)}.glb`;
await fs.writeFile(file,bytes);
const proof={file,sha256,bytes:bytes.length,sourceSha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),sourceTranslation,targetTranslation:keep.getTranslation(),nodes:root.listNodes().length,textures:root.listTextures().length,triangles:keep.getMesh().listPrimitives().reduce((sum,p)=>sum+p.getIndices().getCount()/3,0),redLensSkins:lenses.map(l=>({name:l.name,vertices:l.position.length/3,triangles:l.index.length/3})),primitives:keep.getMesh().listPrimitives().map(p=>({material:p.getMaterial().getName(),vertices:p.getAttribute('POSITION').getCount(),triangles:p.getIndices().getCount()/3}))};
await fs.writeFile('assets/source/e39-rear-proof.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
