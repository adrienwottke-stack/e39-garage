import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFile} from 'node:fs/promises';
import {createExhaustTip,createRearDiffuserFin,createRearDiffuserInsert,rearInsertSource,rearInsert,createTailLampAssembly,createTailLampRibs,createTailReflectorFacets,rearExhaust,rearPlate,tailSurfaceDepth} from './rear-geometry';

describe('fitted rear details',()=>{
  let insertSource:T.BufferGeometry;
  beforeAll(async()=>{
    const bytes=await readFile('assets/source/e39-rear-7e3086f66be0.glb');
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    insertSource=rearInsertSource(gltf.scene);
  });
  afterAll(()=>insertSource.dispose());
  it('keeps both hollow tips on the left, recessed toward the car, with no cap at the mouth',()=>{
    const g=createExhaustTip(),p=g.getAttribute('position');
    expect(g.boundingBox!.min.z).toBeCloseTo(0,5);
    expect(g.boundingBox!.max.z).toBeCloseTo(rearExhaust.length,5);
    for(let i=0;i<p.count;i++)expect(Math.hypot(p.getX(i),p.getY(i))).toBeGreaterThan(rearExhaust.innerRadius-.000001);
    expect(rearExhaust.centres[0]-rearExhaust.outerRadius).toBeGreaterThan(.4);
    expect(rearExhaust.centres[1]+rearExhaust.outerRadius).toBeLessThan(.65);
    expect(rearExhaust.centres[1]-rearExhaust.centres[0]).toBeGreaterThan(rearExhaust.outerRadius*2);
    g.dispose();
  });

  it('fits a closed moulded insert directly to the actual lower source skin',()=>{
    const g=createRearDiffuserInsert(insertSource),p=g.getAttribute('position'),ix=g.getIndex()!,edges=new Map<string,number>();
    expect(g.boundingBox!.min.y).toBeCloseTo(rearInsert.bottomY,5);
    expect(g.boundingBox!.max.y).toBeCloseTo(rearInsert.topY,5);
    const layer=p.count/2;
    for(let i=0;i<layer;i++){
      const z=tailSurfaceDepth(insertSource,p.getX(i),p.getY(i));expect(z).not.toBeNull();
      expect(z!-p.getZ(i)).toBeCloseTo(rearInsert.skinOffset,5);
      expect(p.getZ(i+layer)-p.getZ(i)).toBeCloseTo(rearInsert.thickness,5);
    }
    for(let i=0;i<ix.count;i+=3)for(let j=0;j<3;j++){
      const a=ix.getX(i+j),b=ix.getX(i+(j+1)%3),key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)??0)+1);
    }
    expect([...edges.values()].every(count=>count===2)).toBe(true);
    expect(Array.from(g.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    g.dispose();
  });

  it('joins short fins to the real backing and keeps projection below 40 mm',()=>{
    for(const x of [-.39,-.16,.07,.3]) {
      const g=createRearDiffuserFin(x,insertSource),p=g.getAttribute('position'),n=g.getAttribute('normal');let roots=0,caps=0;
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
      expect(g.boundingBox!.min.y).toBeGreaterThan(.22);
      expect(g.boundingBox!.max.y).toBeLessThan(.34);
      expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeLessThan(.012);
      for(let i=0;i<p.count;i++){
        const y=T.MathUtils.clamp(p.getY(i),rearInsert.finLowY,rearInsert.finHighY),z=tailSurfaceDepth(insertSource,p.getX(i),y);
        expect(z).not.toBeNull();expect(z!-p.getZ(i)).toBeLessThan(.040001);
        if(p.getY(i)>=rearInsert.finLowY&&p.getY(i)<=rearInsert.finHighY&&p.getZ(i)>z!-rearInsert.skinOffset&&p.getZ(i)<z!+rearInsert.thickness-rearInsert.skinOffset)roots++;
        if(Math.abs(n.getX(i))>.99){expect(Math.sign(p.getX(i)-x)*n.getX(i)).toBeGreaterThan(.99);caps++;}
      }
      expect(roots).toBeGreaterThan(20);expect(caps).toBeGreaterThan(10);
      g.dispose();
    }
  });

  it('builds prism ribs and reflector facets inside the actual optical footprints',async()=>{
    const doc=await new NodeIO().read('public/models/e39-body-9651faf179e2.glb');
    const node=doc.getRoot().listNodes().find(n=>n.getName()==='pab_e39_taillight_L')!;
    for(const primitive of node.getMesh()!.listPrimitives()) {
      const source=new T.BufferGeometry();
      source.setAttribute('position',new T.Float32BufferAttribute(Array.from(primitive.getAttribute('POSITION')!.getArray()!),3));
      source.setIndex(Array.from(primitive.getIndices()!.getArray()!));source.computeBoundingBox();
      for(const build of [createTailLampRibs,createTailReflectorFacets]) {
        const g=build(source),p=g.getAttribute('position'),n=g.getAttribute('normal');
        expect(p.count).toBeGreaterThan(12);
        expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
        expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
        expect(g.boundingBox!.min.x).toBeGreaterThan(source.boundingBox!.min.x-.002);
        expect(g.boundingBox!.max.x).toBeLessThan(source.boundingBox!.max.x+.002);
        expect(g.boundingBox!.min.y).toBeGreaterThan(source.boundingBox!.min.y-.002);
        expect(g.boundingBox!.max.y).toBeLessThan(source.boundingBox!.max.y+.002);
        g.dispose();
      }
      const b=source.boundingBox!;
      expect(tailSurfaceDepth(source,b.max.x+.02,b.max.y+.02)).toBeNull();
      source.dispose();
    }
  });

  it('restores all four missing red skins in front of their reflectors and separates the upper clear frame',async()=>{
    const bytes=await readFile('public/models/e39-body-9651faf179e2.glb');
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const patches=createTailLampAssembly(gltf.scene),covers=patches.filter(p=>p.name.startsWith('E39_FITTED_RED_COVER_'));
    expect(covers).toHaveLength(4);
    for(const side of [-1,1])for(const [x,y] of [[.56,.788],[.68,.725]]) {
      const front=covers.map(p=>tailSurfaceDepth(p.geometry,x*side,y)).filter((z):z is number=>z!==null);
      expect(front.length).toBeGreaterThan(0);
      const behind=patches.filter(p=>p.name.endsWith('_red_reflector')).map(p=>tailSurfaceDepth(p.geometry,x*side,y)).filter((z):z is number=>z!==null);
      expect(behind.length).toBeGreaterThan(0);
      expect(Math.min(...behind)-Math.min(...front)).toBeGreaterThan(.001);
      // The authored bowls are up to about 41 mm deep at these samples.
      expect(Math.min(...behind)-Math.min(...front)).toBeLessThan(.055);
    }
    const upper=patches.filter(p=>p.name.endsWith('_clear_upper_frame'));
    expect(upper).toHaveLength(2);
    for(const p of upper)expect(p.geometry.boundingBox!.min.y).toBeCloseTo(.818,5);
    for(const p of patches){expect(p.geometry.getAttribute('position').count).toBeGreaterThan(0);p.geometry.dispose();p.material.dispose();}
  });

  it('fits the rear plate to the actual sloped recess with a small mounting gap',async()=>{
    const doc=await new NodeIO().read('public/models/e39-body-9651faf179e2.glb');
    const primitive=doc.getRoot().listNodes().find(n=>n.getName()==='pab_e39_trunk')!.getMesh()!.listPrimitives().find(p=>p.getMaterial()!.getName()==='pab_e39_paint')!;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array.from(primitive.getAttribute('POSITION')!.getArray()!),3));g.setIndex(Array.from(primitive.getIndices()!.getArray()!));
    for(const x of [-.23,0,.23])for(const localY of [-.05,0,.05]) {
      const y=rearPlate.y+Math.cos(rearPlate.pitch)*localY,z=rearPlate.faceZ+Math.sin(rearPlate.pitch)*localY;
      const bodyZ=tailSurfaceDepth(g,x,y);expect(bodyZ).not.toBeNull();
      expect(bodyZ!-z).toBeGreaterThan(.006);
      expect(bodyZ!-z).toBeLessThan(.032);
    }
    g.dispose();
  });
});
