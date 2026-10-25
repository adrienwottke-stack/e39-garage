import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
const round=process.argv[2]??'feedback-runde-3';
assert(/^feedback-runde-\d+$/.test(round));
const out='proofs/'+round,runtime=out+'/authoring-runtime';
await fs.mkdir(runtime,{recursive:true});
await fs.writeFile(runtime+'/mesh-subdivision.mjs',stripTypeScriptTypes(await fs.readFile('src/mesh-subdivision.ts','utf8')));
const code=(await fs.readFile('src/photo-rear-diffuser.ts','utf8')).replace("'./mesh-subdivision'","'./mesh-subdivision.mjs'");
await fs.writeFile(runtime+'/photo-rear-diffuser.mjs',stripTypeScriptTypes(code));
const m=await import(pathToFileURL(path.resolve(runtime+'/photo-rear-diffuser.mjs')).href);
const shapes=m.photoDiffuserShapes();
const outline=shapes.surround.getPoints(48);
function inside(point){let result=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){
 const a=outline[i],b=outline[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
}return result;}
for(const hole of shapes.surround.holes)assert(hole.getPoints(48).every(inside),'Channel opening must remain inside its surround');
const parts=[['surround',m.createPhotoDiffuserPanel(shapes.surround,.014)],['channel',m.createPhotoDiffuserPanel(shapes.channel,.008,.020)],['ridge',m.createPhotoDiffuserPanel(shapes.upperRidge,.008,-.004)],...m.photoRearDiffuser.finXs.map(x=>['fin-'+x,m.createPhotoDiffuserFin(x)]),['exhaust',m.createPhotoRearExhaust()]];
const stats=[];
for(const [name,g] of parts){const p=g.getAttribute('position'),n=g.getAttribute('normal');
 assert(Array.from(p.array).every(Number.isFinite));assert(Array.from(n.array).every(Number.isFinite));
 let normalError=0;for(let i=0;i<n.count;i++)normalError=Math.max(normalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));assert(normalError<1e-5);
 g.computeBoundingBox();stats.push({name,triangles:(g.index?.count??p.count)/3,normalError,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});
 if(name!=='exhaust')assert(g.boundingBox.min.y>0);
}
// The channel must be a real opening in the surround, backed by recessed skin.
for(const x of [-.3,0,.3]){
 const mesh=new T.Mesh(parts[0][1],new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 assert.equal(new T.Raycaster(new T.Vector3(x,.252,-3),new T.Vector3(0,0,1)).intersectObject(mesh).length,0);
 mesh.material.dispose();
 const back=new T.Mesh(parts[1][1],new T.MeshBasicMaterial({side:T.DoubleSide}));back.updateMatrixWorld();
 assert(new T.Raycaster(new T.Vector3(x,.252,-3),new T.Vector3(0,0,1)).intersectObject(back).length>0);back.material.dispose();
}
// Twin tips clear one another and fit the open-bottom notch in the surround.
const {exhaustXs,exhaustOuterRadius:r}=m.photoRearDiffuser;
assert(exhaustXs[1]-exhaustXs[0]>2*r);
assert(exhaustXs[0]-r>.420);assert(exhaustXs[1]+r<.652);assert(m.photoRearDiffuser.exhaustY+r<.294);
const modelHash=createHash('sha256').update(await fs.readFile('public/models/e39-fenders-57c696004fa4.glb')).digest('hex');
assert.equal(modelHash,'57c696004fa482c656b86893b212cac48d7b9844aad0fb6874dba04268444250');
const proof={stats,channelIsOpen:true,channelOpeningInsideSurround:true,channelHasRecessedBacking:true,twinTipsClearNotch:true,acceptedFenderModelUnchanged:true,modelHash,reference:'Private rear photographs 2026-10-14, particularly 15.49.31 (3) and (4). Geometry is a visual approximation in existing model coordinates.'};
await fs.writeFile(out+'/geometry-check.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));parts.forEach(([,g])=>g.dispose());
