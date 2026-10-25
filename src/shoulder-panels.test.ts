import {describe,it,expect} from 'vitest';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
import {rebuildShoulder,shoulderPoint} from './shoulder-panels';
import {MODEL_URL} from './model-version';

describe('0.9 actual vehicle source',()=>{
 it('preserves lower interfaces while reconstructing finite shoulders with bounded displacement',async()=>{
  const doc=await new NodeIO().read('public/models/e39-front-492b973651b6.glb');
  const node=doc.getRoot().listNodes().find(n=>n.getName()==='pab_e39_fender_L')!;
  const prim=node.getMesh()!.listPrimitives().find(p=>p.getMaterial()?.getName()==='pab_e39_paint')!;
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(Array.from(prim.getAttribute('POSITION')!.getArray()!),3));
  g.setAttribute('normal',new T.Float32BufferAttribute(Array.from(prim.getAttribute('NORMAL')!.getArray()!),3));
  const next=rebuildShoulder(g,1),p=next.getAttribute('position'),n=next.getAttribute('normal'),old=g.getAttribute('position');
  expect(p.count).toBe(old.count);expect(next.userData.shoulderRebuild.changed).toBeGreaterThan(2000);
  for(let i=0;i<p.count;i++){
   const a=new T.Vector3().fromBufferAttribute(old,i),b=new T.Vector3().fromBufferAttribute(p,i);
   expect(b.toArray().every(Number.isFinite)).toBe(true);
   expect(a.distanceTo(b)).toBeLessThanOrEqual(.026001);
   if(a.y<.57||a.z<.76||a.z>1.96)expect(b.distanceTo(a)).toBeLessThan(1e-7);
   expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,4);
  }
  for(const z of [.9,1.2,1.5,1.8]) {
   const a=shoulderPoint(new T.Vector3(.83,.77,z),1),b=shoulderPoint(new T.Vector3(-.83,.77,z),-1);
   expect(a.y).toBeCloseTo(b.y,10);expect(a.x).toBeCloseTo(-b.x,10);
  }
  g.dispose();next.dispose();
 },30000);
 it('actually ships the separately selectable texture-free M-Technik source in the active GLB',async()=>{
  const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('public'+MODEL_URL);
  const node=doc.getRoot().listNodes().find(n=>n.getName()==='pab_e39_bumper_F_m-tech')!;
  expect(node).toBeDefined();expect(node.getTranslation()).toEqual([0,0,0]);
  expect(node.getMesh()!.listPrimitives()).toHaveLength(6);
  expect(node.getExtras().frontRevision).toBe('0.9');
  const source=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('assets/source/e39-mtech-f6d2fb17641e.glb');
  expect(source.getRoot().listTextures()).toHaveLength(0);
 });
});
