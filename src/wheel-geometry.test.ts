import { describe,it,expect } from 'vitest';
import * as T from 'three';
import { createWheelAssembly, disposeWheelAssembly } from './wheel-assembly';
import { photoSpokeGeometry,tireProfile,tireGeometry,visualTireRadius } from './wheel-geometry';
describe('Foto-Felge und optische Größenwechsel',()=>{
  it('bleibt in allen Entwurfsgrößen endlich und innerhalb des Reifens, mit räumlich vertieftem Zentrum',()=>{
    for(const size of [17,18,19]){
      const radius=size*0.0254/2,g=photoSpokeGeometry(radius),p=g.getAttribute('position'),n=g.getAttribute('normal');
      let inner=-Infinity,outer=-Infinity;
      for(let i=0;i<p.count;i++){
        const r=Math.hypot(p.getX(i),p.getY(i));
        expect(r).toBeLessThan(visualTireRadius);
        expect([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
        if(r<0.065)inner=Math.max(inner,p.getZ(i));
        if(r>radius*0.85)outer=Math.max(outer,p.getZ(i));
      }
      expect(outer-inner).toBeGreaterThan(0.025);
      expect(Math.max(...tireProfile(radius).map(p=>p.x))).toBe(visualTireRadius);
      expect(tireProfile(radius).every(p=>p.x>0&&Number.isFinite(p.y))).toBe(true);
      g.dispose();
    }
  });
  it('forms a closed tire with recessed grooves, outward normals and the same ground contact in all sizes',()=>{
    for(const size of [17,18,19]){
      const radius=size*0.0254/2,g=tireGeometry(radius),p=g.getAttribute('position'),n=g.getAttribute('normal');
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeCloseTo(-visualTireRadius,4);
      expect(g.boundingBox!.max.y).toBeCloseTo(visualTireRadius,4);
      const indices=g.getIndex()!,edges=new Map<string,number>();
      const keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e7)).join(':'));
      let grooveMin=Infinity,treadMax=0,maxRadius=0,minNormalDot=Infinity,nondegenerate=true;
      for(let i=0;i<p.count;i++){
        const r=Math.hypot(p.getX(i),p.getY(i));
        maxRadius=Math.max(maxRadius,r);
        if(Math.abs(p.getZ(i))<0.06){
          minNormalDot=Math.min(minNormalDot,p.getX(i)*n.getX(i)+p.getY(i)*n.getY(i));
          grooveMin=Math.min(grooveMin,r);treadMax=Math.max(treadMax,r);
        }
      }
      expect(treadMax-grooveMin).toBeGreaterThan(0.004);
      expect(maxRadius).toBeLessThanOrEqual(visualTireRadius+1e-7);
      expect(minNormalDot).toBeGreaterThan(0);
      for(let i=0;i<indices.count;i+=3){
        const triangle=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)].map(i=>keys[i]);
        if(new Set(triangle).size!==3)nondegenerate=false;
        for(let j=0;j<3;j++){
          const edge=[triangle[j],triangle[(j+1)%3]].sort().join('|');
          edges.set(edge,(edges.get(edge)??0)+1);
        }
      }
      expect(nondegenerate).toBe(true);
      expect([...edges.values()].every(count=>count===2)).toBe(true);
      g.dispose();
    }
  });
  it('keeps warped spoke surfaces closed across every subdivided edge',()=>{
    const g=photoSpokeGeometry(17*0.0254/2),p=g.getAttribute('position');
    const keys=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e7)).join(':'));
    const edges=new Map<string,number>();
    for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
      const edge=[keys[i+j],keys[i+(j+1)%3]].sort().join('|');
      edges.set(edge,(edges.get(edge)??0)+1);
    }
    expect([...edges.values()].filter(count=>count!==2)).toHaveLength(0);
    g.dispose();
  });
  it('retains every style, finish and caliper option as ordinary exportable geometry',()=>{
    for(const wheelStyle of ['photo','double-five','radial','mesh','reference'] as const){
      const group=createWheelAssembly({wheelStyle,wheelSize:17,wheelFinish:'silver',caliper:'blue'});
      let meshes=0,triangles=0;
      group.traverse(o=>{
        if(o instanceof T.Mesh){
          meshes++;triangles+=(o.geometry.getIndex()?.count??o.geometry.getAttribute('position').count)/3;
          expect(o).not.toBeInstanceOf(T.InstancedMesh);
          for(const m of Array.isArray(o.material)?o.material:[o.material])expect(m).toBeInstanceOf(T.MeshStandardMaterial);
        }
      });
      expect(group.getObjectByName('E39_010_Valve_Assembly')).toBeDefined();
      expect(group.getObjectByName('E39_010_Rim_Hub_With_Open_Lug_Bores')).toBeDefined();
      expect(group.getObjectByName('E39_010_Caliper_Cast_Housing')).toHaveProperty('material.name','E39_010_Caliper_blue');
      expect(meshes).toBeGreaterThan(25);
      expect(triangles).toBeLessThanOrEqual(60000);
      disposeWheelAssembly(group);
    }
    for(const wheelFinish of ['silver','graphite','bronze'] as const){
      const group=createWheelAssembly({wheelStyle:'photo',wheelSize:19,wheelFinish,caliper:'red'},undefined,false);
      expect(group.getObjectByName('E39_010_Rim_Hub_With_Open_Lug_Bores')).toHaveProperty('material.name',`E39_010_Rim_${wheelFinish}`);
      expect(group.getObjectByName('E39_010_Caliper_Cast_Housing')).toHaveProperty('material.name','E39_010_Caliper_red');
      disposeWheelAssembly(group);
    }
  });
  it('stays below the mobile geometry budget for every design, diameter and axle',()=>{
    for(const wheelStyle of ['photo','double-five','radial','mesh','reference'] as const)
      for(const wheelSize of [17,18,19] as const)for(const front of [true,false]){
        const group=createWheelAssembly({wheelStyle,wheelSize,wheelFinish:'silver',caliper:'graphite'},undefined,front);
        let triangles=0;
        group.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.getIndex()?.count??o.geometry.getAttribute('position').count)/3;});
        expect(triangles).toBeGreaterThan(25000);
        expect(triangles).toBeLessThanOrEqual(60000);
        disposeWheelAssembly(group);
      }
  });
});
