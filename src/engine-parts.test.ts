import {beforeAll,describe,expect,it} from 'vitest';
import {NodeIO,type Document,type Primitive} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

let current:Document,base:Document,detail:Document;
function triangleKeys(primitive:Primitive){
 const p=primitive.getAttribute('POSITION')!.getArray()!,ix=primitive.getIndices()?.getArray(),count=ix?.length??p.length/3,keys:string[]=[];
 for(let i=0;i<count;i+=3){const values:number[]=[];for(let j=0;j<3;j++)for(let k=0;k<3;k++)values.push(p[(ix?.[i+j]??i+j)*3+k]);keys.push(values.join(','));}return keys;
}
const engineNodes=(doc:Document)=>doc.getRoot().listNodes().filter(n=>n.getExtras().engineAssembly===true);

// This suite preserves the rejected experiment for reference. The active 0.9
// engine is procedural and is checked in the actual app, not in this GLB.
describe('archived 0.10 engine reference',()=>{
 beforeAll(async()=>{
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  [current,base,detail]=await Promise.all([io.read('public/models/e39-vehicle-bd63dcca731a.glb'),io.read('public/models/e39-body-9651faf179e2.glb'),io.read('assets/source/e39-details-46325a505e03.glb')]);
 });
 it('contains all eight selectable zones once in the scene and no leftover overlapping engine source',()=>{
  const nodes=engineNodes(current),scene=current.getRoot().listScenes()[0];
  expect([...new Set(nodes.map(n=>n.getExtras().component))].sort()).toEqual(['air-filter','belt','expansion-tank','fan','intake','oil-filter','radiator','valve-cover']);
  const seen=new Set();scene.traverse(n=>{expect(seen.has(n)).toBe(false);seen.add(n);});
  for(const n of nodes){
   expect(seen.has(n)).toBe(true);expect(n.getTranslation()).toEqual([0,0,0]);expect(n.getScale()).toEqual([1,1,1]);
   expect(n.getMesh()!.listPrimitives()).toHaveLength(1);
   expect(n.getExtras().reference).toContain('not exact M54 CAD');
  }
  expect(current.getRoot().listNodes().filter(n=>/^pab_e39_(?:engine_(?:block_)?m52|engbaycrap(?:\.001)?)$/.test(n.getName()))).toHaveLength(0);
  const caps=nodes.filter(n=>n.getExtras().explodeCap===true);expect(caps.length).toBeGreaterThan(0);
  expect(caps.every(n=>n.getExtras().component==='oil-filter')).toBe(true);
 });
 it('preserves every original engine and bay triangle exactly once when partitioning selectable regions',()=>{
  const sourceNodes=[
   ...base.getRoot().listNodes().filter(n=>/^pab_e39_engbaycrap(?:\.001)?$/.test(n.getName())),
   ...detail.getRoot().listNodes().filter(n=>/^pab_e39_engine_(?:block_)?m52$/.test(n.getName())),
  ];
  const source=new Map<string,number>();let sourceTriangles=0,targetTriangles=0;
  for(const n of sourceNodes)for(const p of n.getMesh()!.listPrimitives())for(const key of triangleKeys(p)){source.set(key,(source.get(key)??0)+1);sourceTriangles++;}
  for(const n of engineNodes(current))for(const p of n.getMesh()!.listPrimitives())for(const key of triangleKeys(p)){
   const remaining=source.get(key)??0;expect(remaining,'triangle must come from the source once').toBeGreaterThan(0);source.set(key,remaining-1);targetTriangles++;
  }
  expect(targetTriangles).toBe(sourceTriangles);expect(sourceTriangles).toBeGreaterThan(30000);
  expect([...source.values()].every(count=>count===0)).toBe(true);
 });
});
