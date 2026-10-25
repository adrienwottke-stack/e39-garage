import {describe,it,expect} from 'vitest';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
import {rebuildFrontPanel,frontSurfacePoint} from './front-panels';

describe('front skin reconstructed from the actual model',()=>{
  it('keeps finite outward surfaces, bounded displacement and untouched underside',async()=>{
    const doc=await new NodeIO().read('public/models/e39-b0aae9fcac8c.glb');
    let count=0;
    for(const node of doc.getRoot().listNodes()) {
      if(!/^pab_e39_(hood|fender_[LR])$/.test(node.getName()))continue;
      for(const primitive of node.getMesh()?.listPrimitives()??[]) {
        if(primitive.getMaterial()?.getName()!=='pab_e39_paint')continue;
        const source=new T.BufferGeometry();
        for(const [key,accessor] of primitive.listSemantics().map(key=>[key,primitive.getAttribute(key)] as const)) {
          if(key==='POSITION'||key==='NORMAL')source.setAttribute(key==='POSITION'?'position':'normal',new T.Float32BufferAttribute(Array.from(accessor!.getArray()!),3));
        }
        source.setIndex(Array.from(primitive.getIndices()!.getArray()!));
        const result=rebuildFrontPanel(source,node.getName());
        expect(result.userData.frontRebuild.changed).toBeGreaterThan(100);
        expect(result.userData.frontRebuild.maxDisplacement).toBeLessThanOrEqual(.025001);
        expect(result.getAttribute('position').count).toBeLessThan(180000);
        for(const key of ['position','normal'])expect(Array.from(result.getAttribute(key).array).every(Number.isFinite)).toBe(true);
        const normal=result.getAttribute('normal');
        for(let i=0;i<normal.count;i+=31)expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,2);
        source.computeBoundingBox();
        expect(result.boundingBox!.min.y).toBeCloseTo(source.boundingBox!.min.y,5);
        source.dispose();result.dispose();count++;
      }
    }
    expect(count).toBe(3);
  },60000);
  it('uses a continuous symmetric hood surface rather than triangle-specific normals',()=>{
    for(const z of [.95,1.25,1.6,1.9])for(const x of [.1,.35,.6]) {
      const a=frontSurfacePoint('pab_e39_hood',new T.Vector3(x,.85,z));
      const b=frontSurfacePoint('pab_e39_hood',new T.Vector3(-x,.85,z));
      expect(a.y).toBeCloseTo(b.y,10);
      expect(a.y).toBeGreaterThan(.65);expect(a.y).toBeLessThan(1.01);
    }
  });
});
