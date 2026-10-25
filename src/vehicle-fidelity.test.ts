import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {createHeadliner,fairVehicleSkin,vehicleBodyOffset} from './vehicle-panels';
import {updateVehicleCabin} from './vehicle-cabin';
import {photoLook} from './studio-domain';

describe('integrated vehicle fidelity',()=>{
  it('keeps front panel corrections within millimetres and leaves panel interfaces fixed',async()=>{
    const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('public/models/e39-body-9651faf179e2.glb');
    for(const [name,kind,bound] of [['pab_e39_hood','hood',.0018],['pab_e39_fender_L','fender',.0012]] as const) {
      const node=doc.getRoot().listNodes().find(n=>n.getName()===name)!;
      const primitive=node.getMesh()!.listPrimitives().find(p=>p.getMaterial()!.getName()==='pab_e39_paint')!;
      const source=new T.BufferGeometry();
      source.setAttribute('position',new T.Float32BufferAttribute(Array.from(primitive.getAttribute('POSITION')!.getArray()!),3));
      source.setAttribute('normal',new T.Float32BufferAttribute(Array.from(primitive.getAttribute('NORMAL')!.getArray()!),3));
      const indices=primitive.getIndices();if(indices)source.setIndex(Array.from(indices.getArray()!));
      const baseline=source.index?source.toNonIndexed():source.clone(),refined=fairVehicleSkin(source,kind),p=refined.getAttribute('position'),old=baseline.getAttribute('position'),normals=refined.getAttribute('normal');
      let changed=0;
      for(let i=0;i<p.count;i++) {
        const before=new T.Vector3().fromBufferAttribute(old,i),after=new T.Vector3().fromBufferAttribute(p,i);
        const delta=before.distanceTo(after);
        expect(delta).toBeLessThanOrEqual(bound+1e-6);
        if(kind==='hood'&&(Math.abs(before.x)>.73||before.z<.86||before.z>1.99))expect(delta).toBe(0);
        if(delta>1e-7)changed++;
        expect(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))).toBeCloseTo(1,4);
      }
      expect(changed).toBeGreaterThan(0);
      // Source assets are never mutated by runtime fairing.
      expect(Array.from(source.getAttribute('position').array)).toEqual(Array.from(primitive.getAttribute('POSITION')!.getArray()!));
      refined.dispose();baseline.dispose();source.dispose();
    }
  });

  it('provides a continuous two-sided roof above the cockpit without a central bar',()=>{
    const geometry=createHeadliner(),material=new T.MeshBasicMaterial({side:T.DoubleSide}),mesh=new T.Mesh(geometry,material);
    mesh.updateMatrixWorld();
    for(const x of [-.4,0,.4])for(const z of [-1.2,-.7,-.2]){
      const hits=new T.Raycaster(new T.Vector3(x,1.05,z),new T.Vector3(0,1,0)).intersectObject(mesh);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeGreaterThan(1.32);
      expect(hits[0].point.y).toBeLessThan(1.40);
    }
    geometry.dispose();material.dispose();
  });

  it('keeps the actual lowering value and new material variants independent of seat-belt webbing',()=>{
    expect(vehicleBodyOffset(0)).toBeCloseTo(0);
    expect(vehicleBodyOffset(25)).toBe(-.025);
    expect(vehicleBodyOffset(55)).toBe(-.055);
    const leather=new T.MeshStandardMaterial(),belt=new T.MeshStandardMaterial(),trim=new T.MeshStandardMaterial();
    leather.userData.cabinKind='leather';belt.userData.cabinKind='belt';trim.userData.cabinKind='trim';
    const colors=new Set<string>();
    for(const upholstery of ['anthracite','cognac','ivory','burgundy','alcantara','tartan'] as const){
      const look={...photoLook(),upholstery};updateVehicleCabin(leather,'pab_e39_seat_FL',look);updateVehicleCabin(belt,'pab_e39_seat_FL',look);
      colors.add(leather.color.getHexString());expect(belt.color.getHexString()).toBe('1e2023');
    }
    expect(colors.size).toBe(6);
    updateVehicleCabin(trim,'pab_e39_doorpanel_FL',{...photoLook(),interiorTrim:'walnut'});
    expect(trim.metalness).toBe(.08);expect(trim.roughness).toBe(.29);
    leather.dispose();belt.dispose();trim.dispose();
  });
});
