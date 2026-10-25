import {NodeIO} from '@gltf-transform/core';
import {dedup,prune,weld} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const io=new NodeIO();
const doc=await io.read('../model-source/source/BMW1.glb');
const root=doc.getRoot(), nodes=[...root.listNodes()], scene=root.listScenes()[0];
// This asset contains alternative cars laid out beside one another. Flatten,
// select one sedan configuration, and remove their layout offsets.
for(const n of nodes){for(const child of [...n.listChildren()])n.removeChild(child);scene.addChild(n);}
const keep=new Set([43,55,57,59,71,87,88,91,95,96,97,98,99,100,101,102,103,104,106,109,111,112,114,115,117,118,120,122,123,124,125,126,127,129,131,132,133,138,139,140,141,142,143,144,145,146,147,148,149,220,224,225,226,227,228,229,231,232,233,234,236,239,243,245,247,248,250,251,253,254,256,258,259,261,262,265,266,267,268,269,270,271,272,273,274,275,277,278,279,280,281,282,285,288,289,290,292,295,296,297,298]);
keep.add(89); keep.add(90);
keep.delete(268); // Detached gauge faces in the source asset float above the roof.
for(let i=151;i<=219;i++)if(![153,155,186,189,191,219].includes(i))keep.add(i);
const rim=nodes[299], tire=nodes[306];
for(const n of nodes){const i=nodes.indexOf(n);if(!keep.has(i)&&i!==299&&i!==306){n.dispose();continue;}const t=n.getTranslation();t[0]-=Math.round(t[0]/2)*2;n.setTranslation(t);n.setExtras({component:/brake|caliper/.test(n.getName())?'brakes':/arm|strut|sway|subframe|coilover|tierod|hub/.test(n.getName())?'suspension':/exhaust|header/.test(n.getName())?'exhaust':'body'});}
for(const x of[-.79,.79])for(const z of[-1.495,1.35]){for(const source of[rim,tire]){const n=doc.createNode(source===rim?'wheel-rim':'wheel-tire').setMesh(source.getMesh()).setTranslation([x,.292,z]).setExtras({component:'wheels'});if(x<0)n.setRotation([0,1,0,0]);scene.addChild(n);}}
rim.dispose();tire.dispose();
for(const m of root.listMaterials()){
 const name=m.getName();m.setDoubleSided(true);
 if(/^pab_e39_paint$/.test(name))m.setBaseColorFactor([.055,.16,.25,1]).setMetallicFactor(.78).setRoughnessFactor(.23);
 else if(/int_trim/.test(name))m.setBaseColorFactor([.52,.56,.59,1]).setMetallicFactor(.81).setRoughnessFactor(.31);
 else if(/alcantara/.test(name))m.setBaseColorFactor([.035,.038,.043,1]).setMetallicFactor(0).setRoughnessFactor(.94);
 else if(/cloth07/.test(name))m.setBaseColorFactor([.044,.046,.049,1]).setMetallicFactor(0).setRoughnessFactor(.97);
 else if(/leather2/.test(name))m.setBaseColorFactor([.021,.023,.027,1]).setMetallicFactor(.01).setRoughnessFactor(.67);
 else if(/stitches/.test(name))m.setBaseColorFactor([.13,.14,.15,1]).setMetallicFactor(0).setRoughnessFactor(.85);
 else if(/glass|invisible/.test(name))m.setBaseColorFactor([.075,.12,.15,.38]).setAlphaMode('BLEND').setMetallicFactor(.1).setRoughnessFactor(.1);
 else if(/chrome|silver|bmw_wheels|wheel$/.test(name))m.setBaseColorFactor([.48,.53,.57,1]).setMetallicFactor(.88).setRoughnessFactor(.26);
 else if(/reverse_new|signal_[LR]_new/.test(name))m.setBaseColorFactor([.65,.68,.69,1]).setEmissiveFactor([0,0,0]).setMetallicFactor(.15).setRoughnessFactor(.27);
 else if(/signal/.test(name))m.setBaseColorFactor([.9,.3,.025,1]).setEmissiveFactor([.12,.025,0]);
 else if(/brake_new|taillight|lowhi|red$/.test(name))m.setBaseColorFactor([.48,.012,.018,1]).setRoughnessFactor(.25);
 else if(/highbeam|lowbeam|running|fog1|lights_lod/.test(name))m.setBaseColorFactor([.8,.82,.74,1]).setEmissiveFactor([.3,.29,.2]).setMetallicFactor(.6).setRoughnessFactor(.22);
 else if(/metal|bottom/.test(name))m.setBaseColorFactor([.13,.15,.16,1]).setMetallicFactor(.7).setRoughnessFactor(.55);
 else if(/logo/.test(name))m.setBaseColorFactor([.65,.75,.8,1]).setMetallicFactor(.5);
 else m.setBaseColorFactor([.025,.031,.037,1]).setMetallicFactor(.05).setRoughnessFactor(.7);
}
await doc.transform(weld(),dedup(),prune());
await fs.mkdir('public/models',{recursive:true});
const bytes=await io.writeBinary(doc);const digest=createHash('sha256').update(bytes).digest('hex').slice(0,12);
const file='e39-'+digest+'.glb';await fs.writeFile('public/models/'+file,bytes);
await fs.writeFile('src/model-version.ts',`export const MODEL_URL='/models/${file}';\n`);
const stat=await fs.stat('public/models/'+file);
console.log(JSON.stringify({bytes:stat.size,nodes:root.listNodes().length,meshes:root.listMeshes().length}));
