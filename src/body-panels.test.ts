import {beforeAll,describe,expect,it} from 'vitest';
import {NodeIO,type Document,type Primitive,type Accessor} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
import {MODEL_URL} from './model-version';

const panelNames=['pab_e39_roof','pab_e39_trunk','pab_e39_door_RL','pab_e39_door_RR','pab_e39_door_FL.032','pab_e39_door_FR.030'];
let before:Document,after:Document,active:Document;
const node=(doc:Document,name:string)=>doc.getRoot().listNodes().find(n=>n.getName()===name)!;
const paint=(doc:Document,name:string)=>node(doc,name).getMesh()!.listPrimitives().find(p=>p.getMaterial()?.getName()==='pab_e39_paint')!;
function geometry(primitive:Primitive){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(primitive.getAttribute('POSITION')!.getArray()!,3));
 if(primitive.getIndices())g.setIndex(Array.from(primitive.getIndices()!.getArray()!));
 return g;
}
const positionKey=(x:number,y:number,z:number)=>[x,y,z].map(n=>Math.round(n*1e6)).join(',');
function vectors(p:Primitive,semantic:string){
 const source=p.getAttribute(semantic)!,a=source.getArray()!;
 return {getCount:()=>source.getCount(),getX:(i:number)=>a[i*3],getY:(i:number)=>a[i*3+1],getZ:(i:number)=>a[i*3+2]};
}
function identicalAccessor(a:Accessor|null,b:Accessor|null){
 if(!a||!b)return a===b;
 const x=a.getArray(),y=b.getArray();if(!x||!y)return x===y;
 return a.getType()===b.getType()&&x.constructor===y.constructor&&Buffer.from(x.buffer,x.byteOffset,x.byteLength).equals(Buffer.from(y.buffer,y.byteOffset,y.byteLength));
}

describe('archived 0.10 experiment and accepted continuous front integration',()=>{
 beforeAll(async()=>{
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  [before,after,active]=await Promise.all([io.read('public/models/e39-body-9651faf179e2.glb'),io.read('public/models/e39-vehicle-bd63dcca731a.glb'),io.read('public'+MODEL_URL)]);
 });
 it('changes only the accepted hood and fender paint skins while preserving other exterior primitives and transforms',()=>{
  const names=before.getRoot().listNodes().map(n=>n.getName()).filter(name=>panelNames.includes(name)||/^pab_e39_(?:hood|grille|fender_[LR]|headlight.*|bumper_[FR].*|taillight.*)$/.test(name));
  expect(names.length).toBeGreaterThan(25);
  const revised:string[]=[];
  for(const name of names){
   const old=node(before,name),current=node(active,name);expect(current,name).toBeDefined();
   expect(current.getTranslation()).toEqual(old.getTranslation());expect(current.getRotation()).toEqual(old.getRotation());expect(current.getScale()).toEqual(old.getScale());
   const oldPrimitives=old.getMesh()?.listPrimitives()??[],newPrimitives=current.getMesh()?.listPrimitives()??[];expect(newPrimitives).toHaveLength(oldPrimitives.length);
   for(let i=0;i<oldPrimitives.length;i++){
    const currentPrimitive=newPrimitives[i],oldPrimitive=oldPrimitives[i];
    const acceptedSkin=/^pab_e39_(?:hood|fender_[LR])$/.test(name)&&oldPrimitive.getMaterial()?.getName()==='pab_e39_paint';
    if(acceptedSkin){
     revised.push(name);
     expect(currentPrimitive.getExtras().continuousPanel,name+' connected skin').toBe(true);
     expect(currentPrimitive.getExtras().authoredPanelNormals,name+' authored normals').toBe(true);
     expect(identicalAccessor(currentPrimitive.getAttribute('POSITION'),oldPrimitive.getAttribute('POSITION')),name+' accepted replacement').toBe(false);
     const p=currentPrimitive.getAttribute('POSITION')!,n=currentPrimitive.getAttribute('NORMAL')!;
     expect(p.getCount()).toBe(n.getCount());
     expect((currentPrimitive.getIndices()?.getCount()??p.getCount())/3).toBeGreaterThan(name.includes('fender')?90000:10000);
     const normal=n.getArray()!;
     expect(Array.from(p.getArray()!).every(Number.isFinite)).toBe(true);
     for(let j=0;j<normal.length;j+=3)expect(Math.hypot(normal[j],normal[j+1],normal[j+2])).toBeCloseTo(1,4);
     continue;
    }
    expect(identicalAccessor(currentPrimitive.getIndices(),oldPrimitive.getIndices()),name+' indices').toBe(true);
    for(const semantic of ['POSITION','NORMAL'])expect(identicalAccessor(currentPrimitive.getAttribute(semantic),oldPrimitive.getAttribute(semantic)),name+' '+semantic).toBe(true);
   }
  }
  expect(revised.sort()).toEqual(['pab_e39_fender_L','pab_e39_fender_R','pab_e39_hood']);
  expect(active.getRoot().listNodes().some(n=>n.getName()==='pab_e39_bumper_R_m-tech')).toBe(false);
 });
 it('retains the actual approved 0.9 front geometry and normals without reauthoring it',()=>{
  const names=before.getRoot().listNodes().map(n=>n.getName()).filter(name=>/^pab_e39_(?:hood|grille|fender_[LR]|headlight.*|bumper_F.*)$/.test(name));
  expect(names.length).toBeGreaterThan(10);
  for(const name of names){
   const old=node(before,name),current=node(after,name);
   expect(current,`${name} present`).toBeDefined();
   expect(current.getTranslation()).toEqual(old.getTranslation());
   expect(current.getRotation()).toEqual(old.getRotation());
   const oldPrimitives=old.getMesh()?.listPrimitives()??[],newPrimitives=current.getMesh()?.listPrimitives()??[];
   expect(newPrimitives).toHaveLength(oldPrimitives.length);
   for(let i=0;i<oldPrimitives.length;i++){
    expect(identicalAccessor(newPrimitives[i].getIndices(),oldPrimitives[i].getIndices()),`${name} triangle indices`).toBe(true);
    for(const semantic of ['POSITION','NORMAL'])expect(identicalAccessor(newPrimitives[i].getAttribute(semantic),oldPrimitives[i].getAttribute(semantic)),`${name} ${semantic}`).toBe(true);
   }
  }
 });
 it('keeps real hems, folds and moulding interfaces fixed in all six rebuilt panels',()=>{
  let protectedVertices=0;
  for(const name of panelNames){
   const old=paint(before,name),current=paint(after,name),p=vectors(old,'POSITION'),normal=vectors(old,'NORMAL'),final=vectors(current,'POSITION');
   const points=new Set<string>();for(let i=0;i<final.getCount();i++)points.add(positionKey(final.getX(i),final.getY(i),final.getZ(i)));
   for(let i=0;i<p.getCount();i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const protectedPoint=name.endsWith('roof')?(y<=1.33||Math.abs(x)>=.54||z<=-1.3||z>=.10):name.endsWith('trunk')?(y<=1.0||Math.abs(x)>=.61||z<=-2.45||z>=-1.91):(y<=.33||y>=.77||Math.abs(x)<=.83||Math.abs(normal.getX(i))<=.91||(y>=.477&&y<=.53));
    if(!protectedPoint)continue;protectedVertices++;
    expect(points.has(positionKey(x,y,z)),`${name} protected ${i}`).toBe(true);
   }
  }
  expect(protectedVertices).toBeGreaterThan(4000);
 });
 it('bounds each delivered broad skin against its original triangles and supplies finite unit normals',()=>{
  let checked=0;
  const direction=new T.Vector3(),origin=new T.Vector3(),ray=new T.Raycaster();
  const material=new T.MeshBasicMaterial({side:T.DoubleSide});
  for(const name of panelNames){
   const axis=name.includes('door_')?0:1,current=paint(after,name),g=geometry(paint(before,name)),mesh=new T.Mesh(g,material);
   const sourcePosition=g.getAttribute('position'),sourceIndex=g.getIndex(),triangles:T.Triangle[]=[];
   for(let i=0;i<(sourceIndex?.count??sourcePosition.count);i+=3)triangles.push(new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(sourcePosition,sourceIndex?.getX(i+j)??i+j)) as [T.Vector3,T.Vector3,T.Vector3]));
   mesh.updateMatrixWorld(true);
   const p=vectors(current,'POSITION'),n=vectors(current,'NORMAL');
   direction.set(0,0,0).setComponent(axis,-1);
   for(let i=0;i<p.getCount();i+=37){
    const point=new T.Vector3(p.getX(i),p.getY(i),p.getZ(i));
    expect(point.toArray().every(Number.isFinite)).toBe(true);
    expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,4);
    origin.copy(point).setComponent(axis,point.getComponent(axis)+.05);ray.set(origin,direction);ray.near=0;ray.far=.1;
    const hits=ray.intersectObject(mesh,false);
    // A ray can graze a crease/outline. Fall back to the closest point on all
    // actual source triangles instead of treating a different inner return as
    // the original surface. No fitted polynomial is consulted by this check.
    let distance=hits.length?Math.min(...hits.map(h=>Math.abs(h.distance-.05))):Infinity;
    if(distance>.003002){const closest=new T.Vector3();for(const triangle of triangles)distance=Math.min(distance,triangle.closestPointToPoint(point,closest).distanceTo(point));}
    expect(distance,`${name} source surface distance at ${i}`).toBeLessThanOrEqual(.003002);checked++;
   }
   g.dispose();
  }
  material.dispose();expect(checked).toBeGreaterThan(800);
 },20000);
 it('does not open new unpaired edges across the previously continuous roof and door skins',()=>{
  function openInteriorEdges(primitive:Primitive,name:string){
   const p=primitive.getAttribute('POSITION')!.getArray()!,ix=primitive.getIndices()?.getArray(),count=ix?.length??p.length/3;
   const edges=new Map<string,{count:number;mid:number[]}>();
   const vertexKey=(i:number)=>positionKey(p[i*3],p[i*3+1],p[i*3+2]);
   for(let i=0;i<count;i+=3)for(let j=0;j<3;j++){
    const a=ix?.[i+j]??i+j,b=ix?.[i+(j+1)%3]??i+(j+1)%3,ka=vertexKey(a),kb=vertexKey(b);
    if(ka===kb)continue;
    const key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`,edge=edges.get(key)??{count:0,mid:[0,1,2].map(k=>(p[a*3+k]+p[b*3+k])/2)};
    edge.count++;edges.set(key,edge);
   }
   return [...edges.values()].filter(edge=>{
    if(edge.count!==1)return false;
    const [x,y,z]=edge.mid;
    // These clear outer-skin windows contain no handle aperture, hem or crease
    // in the original asset. A new free edge here indicates a topology crack.
    if(name.endsWith('roof'))return Math.abs(x)<.45&&z>-1.2&&z<0&&y>1.36;
    return Math.abs(x)>.86&&y>.35&&y<.45&&(name.includes('door_R')?z>-1.2&&z<-.5:z>-.24&&z<.6);
   }).length;
  }
  for(const name of panelNames.filter(name=>!name.endsWith('trunk'))){
   expect(openInteriorEdges(paint(before,name),name),`${name} original continuity`).toBe(0);
   expect(openInteriorEdges(paint(after,name),name),`${name} delivered continuity`).toBe(0);
  }
 },20000);
});
