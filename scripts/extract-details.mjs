// Isolate only untextured geometry from the already audited Merc_TV source.
// Source attribution and unresolved upstream provenance: assets/source/README.md.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,unpartition} from '@gltf-transform/functions';
const source=process.argv[2]??'C:/Users/demo/Documents/Codex/2026-10-18/verwe/work/asset-audit/merc-tv-mk4/source/BMW 5 Series E39 MK4 1995-2003.glb';
const bytes=await fs.readFile(source),io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(bytes);
const chosen=new Set(['pab_e39_mirror_L.001','pab_e39_mirror_R.001','pab_e39_intmirror.001','pab_e39_engine_block_m52','pab_e39_engine_m52']);
const scene=doc.createScene('E39 selected detail reference');
for(const n of [...doc.getRoot().listNodes()]){
 if(!chosen.has(n.getName())){n.dispose();continue;}
 n.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
 n.setExtras({component:/engine/.test(n.getName())?'valve-cover':'body',detailRevision:'0.10',sourceAssembly:/engine/.test(n.getName())?'M52 inline-six reference, not exact M54 CAD':'matching LHD mirror glass'});
 scene.addChild(n);
}
for(const s of [...doc.getRoot().listScenes()])if(s!==scene)s.dispose();
doc.getRoot().setDefaultScene(scene);
for(const m of doc.getRoot().listMaterials()){
 for(const key of ['BaseColor','MetallicRoughness','Normal','Occlusion','Emissive'])m['set'+key+'Texture'](null);
 for(const ext of m.listExtensions())ext.dispose();
 if(m.getName()==='mirror')m.setName('E39_mirror_silver').setBaseColorFactor([.67,.72,.73,1]).setMetallicFactor(1).setRoughnessFactor(.045);
 else if(/simboliai|engine$/.test(m.getName()))m.setBaseColorFactor([.23,.24,.25,1]).setMetallicFactor(.65).setRoughnessFactor(.42);
 else if(/black/.test(m.getName()))m.setBaseColorFactor([.024,.028,.031,1]).setMetallicFactor(.03).setRoughnessFactor(.7);
 else if(/grey/.test(m.getName()))m.setBaseColorFactor([.22,.23,.24,1]).setMetallicFactor(.28).setRoughnessFactor(.45);
}
for(const t of doc.getRoot().listTextures())t.dispose();
await doc.transform(prune(),unpartition());
const out=await io.writeBinary(doc),sha=createHash('sha256').update(out).digest('hex'),file='e39-details-'+sha.slice(0,12)+'.glb';
await fs.writeFile('assets/source/'+file,out);
await fs.writeFile('assets/source/e39-details-proof.json',JSON.stringify({file,sha256:sha,bytes:out.length,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceNodes:[...chosen],textures:doc.getRoot().listTextures().length,engineIdentity:'M52 reference geometry only; not a claim of exact M54 geometry'},null,2));
console.log(JSON.stringify({file,sha256:sha,bytes:out.length,nodes:doc.getRoot().listNodes().map(n=>n.getName())}));
