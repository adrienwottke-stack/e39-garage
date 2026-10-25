import {describe, it, expect} from 'vitest';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
import {
  createHeadlightCorner, createHeadlightCornerRibs, createHeadlightInsert,
  createHeadlightReflector, headlightCoverDepth, headlightOptics, headlightOpticSetback,
  createHeadlightHousing,createProjectorShroud,createProjectorLens,
} from './headlight-geometry';
import {createVehicleGlassMaterial, vehicleGlassKind} from './vehicle-glass';
import {createHeadlightMaterials} from './headlight-materials';

describe('headlights fitted to the actual 0.8 cover', () => {
  it('has finite, bounded surfaces and a genuinely recessed open reflector', () => {
    for (const build of [createHeadlightInsert, createHeadlightCorner, createHeadlightCornerRibs, createHeadlightReflector]) {
      const g = build(), p = g.getAttribute('position'), n = g.getAttribute('normal');
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
      expect(g.index!.count).toBeLessThan(6000);
      if (build === createHeadlightReflector) {
        expect(g.boundingBox!.min.z).toBeLessThan(-.04);
        expect(g.boundingBox!.max.z).toBeLessThan(.001);
        // No closed disc across the mouth or the bulb opening.
        for (let i = 0; i < p.count; i++) expect(Math.hypot(p.getX(i), p.getY(i))).toBeGreaterThan(.0129);
        expect(n.getZ(Math.floor(p.count / 2))).toBeGreaterThan(.3);
      }
      g.dispose();
    }
    for (const x of [.28, .4, .6, .8]) expect(headlightCoverDepth(-x)).toBe(headlightCoverDepth(x));
  });

  it('keeps both optical rims behind the actual cover at sampled angles', async () => {
    const doc = await new NodeIO().read('public/models/e39-body-9651faf179e2.glb');
    const node = doc.getRoot().listNodes().find(n => n.getName() === 'pab_e39_headlightglass_L')!;
    const primitive = node.getMesh()!.listPrimitives()[0];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(Array.from(primitive.getAttribute('POSITION')!.getArray()!), 3));
    g.setIndex(Array.from(primitive.getIndices()!.getArray()!));
    const cover = new T.Mesh(g, new T.MeshBasicMaterial({side: T.DoubleSide}));
    cover.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
    cover.updateMatrixWorld(true);
    const ray = new T.Raycaster(), rotation = new T.Euler(0, .20, 0);
    for (const optic of headlightOptics) for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const rim = new T.Vector3(.060 * Math.cos(a), .060 * Math.sin(a), .004).applyEuler(rotation)
        .add(new T.Vector3(optic.x, optic.y, headlightCoverDepth(optic.x) - headlightOpticSetback));
      ray.set(new T.Vector3(rim.x, rim.y, 3), new T.Vector3(0, 0, -1));
      const hit = ray.intersectObject(cover)[0];
      expect(hit, `cover at optic ${optic.x}, angle ${i}`).toBeDefined();
      expect(hit.point.z - rim.z).toBeGreaterThan(.004);
      expect(hit.point.z - rim.z).toBeLessThan(.050);
    }
    cover.material.dispose(); g.dispose();
  });

  it('closes the optical housing and convex lens, while retaining a recessed open mouth',()=>{
    for(const build of [createHeadlightHousing,createProjectorShroud,createProjectorLens]) {
      const g=build(),p=g.getAttribute('position'),ix=g.getIndex()!,edges=new Map<string,number>();
      const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e7)).join(':');
      for(let i=0;i<ix.count;i+=3) {
        const triangle=[key(ix.getX(i)),key(ix.getX(i+1)),key(ix.getX(i+2))];
        if(new Set(triangle).size<3)continue;
        for(let j=0;j<3;j++){const edge=[triangle[j],triangle[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}
      }
      expect([...edges.values()].every(count=>count===2),build.name).toBe(true);
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      if(build===createHeadlightHousing) {
        const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
        const hits=new T.Raycaster(new T.Vector3(0,0,.1),new T.Vector3(0,0,-1)).intersectObject(mesh);
        expect(hits[0].point.z).toBeLessThan(-.07); // real empty mouth, closed rear
        mesh.material.dispose();
      }
      if(build===createProjectorLens) {expect(g.boundingBox!.max.z).toBeCloseTo(.002,6);expect(g.boundingBox!.min.z).toBeCloseTo(-.018,6);}
      g.dispose();
    }
  });
});

describe('separate clear window and lamp materials', () => {
  it('preserves dielectric transmission and differentiates exported material identities', () => {
    const panes = ['pab_e39_windshield', 'pab_e39_headlightglass_L', 'pab_e39_taillightglass_R'];
    const materials = panes.map(name => createVehicleGlassMaterial(vehicleGlassKind(name)));
    expect(new Set(materials.map(m => m.name)).size).toBe(3);
    for (const m of materials) {
      expect(m.transmission).toBeGreaterThan(.95);
      expect(m.opacity).toBe(1);
      expect(m.metalness).toBe(0);
      expect(m.clearcoat).toBe(0);
      expect(m.side).toBe(T.FrontSide);
      expect(m.thickness).toBe(0);
      m.dispose();
    }
  });
  it('keeps unlit guides dark and uses a backed inner lens visible beneath the transmitting outer cover',()=>{
    const off=createHeadlightMaterials(false),on=createHeadlightMaterials(true);
    for(const m of Object.values(off))expect(m.emissiveIntensity===0||m.emissive.equals(new T.Color('#000000'))).toBe(true);
    expect(off.guide.color.getHSL({h:0,s:0,l:0}).l).toBeLessThan(.2);
    expect(off.lens.transmission).toBe(0);
    expect(off.lens.roughness).toBeLessThan(.06);
    expect(on.guide.emissiveIntensity).toBeLessThan(1.2);
    expect(on.bulb.emissiveIntensity).toBeLessThan(1.6);
    Object.values(off).forEach(m=>m.dispose());Object.values(on).forEach(m=>m.dispose());
  });
});
