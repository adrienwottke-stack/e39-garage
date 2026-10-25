import { describe, it, expect } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import * as T from "three";
import { cabinFit, createShiftKnob, createWheelSpoke, gaugeAngle } from "./cabin-geometry";
import { cabinMaterialKind, createCabinGeometry, shouldReplaceCabinNode, updateCabinMaterial } from "./cabin-materials";

describe("cabin reconstruction fitted to the selected sedan", () => {
  it("keeps the replacement steering spokes correctly wound and the gear knob in metre dimensions", () => {
    const spokes = [-1, 0, 1].map(side => createWheelSpoke(side as -1 | 0 | 1));
    const left = spokes[0].boundingBox!, right = spokes[2].boundingBox!;
    expect(left.min.x).toBeCloseTo(-right.max.x, 6);
    expect(left.max.x).toBeCloseTo(-right.min.x, 6);
    for (const g of [...spokes, createShiftKnob()]) {
      const p = g.getAttribute("position"), n = g.getAttribute("normal");
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
      if (!g.index) for (let i = 0; i < p.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(p, i), b = new T.Vector3().fromBufferAttribute(p, i + 1), c = new T.Vector3().fromBufferAttribute(p, i + 2);
        const face = b.sub(a).cross(c.sub(a));
        if (face.lengthSq() > 1e-16) expect(face.dot(new T.Vector3().fromBufferAttribute(n, i))).toBeGreaterThanOrEqual(-1e-9);
      }
      g.dispose();
    }
    const knob = createShiftKnob();
    expect(knob.boundingBox!.max.y).toBeCloseTo(.079, 5);
    expect(knob.boundingBox!.max.x).toBeCloseTo(.023, 5);
    expect(knob.boundingBox!.min.y).toBe(0);
    knob.dispose();
  });

  it("places printed dials immediately in front of the actual source dial faces", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read("public/models/e39-body-9651faf179e2.glb");
    const dashboard = doc.getRoot().listNodes().find(n => n.getName() === "pab_e39_dash")!;
    const meshes = dashboard.getMesh()!.listPrimitives().map(primitive => {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(Array.from(primitive.getAttribute("POSITION")!.getArray()!), 3));
      g.setIndex(Array.from(primitive.getIndices()!.getArray()!));
      const mesh = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide }));
      mesh.applyMatrix4(new T.Matrix4().fromArray(dashboard.getWorldMatrix())); mesh.updateMatrixWorld(true);
      return mesh;
    });
    const ray = new T.Raycaster();
    for (const gauge of cabinFit.gauges) {
      ray.set(new T.Vector3(gauge.x, gauge.y, .46), new T.Vector3(0, 0, 1));
      const hit = ray.intersectObjects(meshes).find(hit => hit.point.z > .47);
      expect(hit, gauge.key).toBeDefined();
      expect(hit!.point.z - gauge.z, gauge.key).toBeGreaterThan(.002);
      expect(hit!.point.z - gauge.z, gauge.key).toBeLessThan(.013);
    }
    expect(Math.cos(gaugeAngle(0))).toBeLessThan(0);
    expect(Math.sin(gaugeAngle(0))).toBeLessThan(0);
    expect(Math.cos(gaugeAngle(1))).toBeGreaterThan(0);
    meshes.forEach(m => { m.geometry.dispose(); (m.material as T.Material).dispose(); });
  });

  it("isolates the cabin material choices from exterior chrome and keeps belt webbing dark", () => {
    expect(cabinMaterialKind("int004 pab_e39_seat_FL", "pab_e39_realalcantara")).toBe("cloth");
    expect(cabinMaterialKind("int004_7 pab_e39_seat_FL", "pab_e39_cloth07_black")).toBe("belt");
    expect(cabinMaterialKind("door_rf004 pab_e39_doorpanel_FL", "pab_e39_chrome")).toBe("metal");
    expect(cabinMaterialKind("pab_e39_bumper_F", "pab_e39_chrome")).toBeNull();
    const belt = new T.MeshStandardMaterial(); belt.userData.cabinKind = "belt";
    updateCabinMaterial(belt, { upholstery: "cognac", interiorTrim: "dark" });
    expect(belt.color.getHexString()).toBe("1e2023");
    const trim = new T.MeshStandardMaterial(); trim.userData.cabinKind = "trim";
    updateCabinMaterial(trim, { upholstery: "anthracite", interiorTrim: "silver" });
    expect(trim.metalness).toBe(.74);
    updateCabinMaterial(trim, { upholstery: "anthracite", interiorTrim: "dark" });
    expect(trim.color.getHexString()).toBe("24292e");
    belt.dispose(); trim.dispose();
  });

  it("removes only the replaced source controls and preserves the supporting fitted interior", () => {
    for (const name of ["pab_e39_steer", "pab_e39_dash_business", "pab_e39_needle_tacho", "pab_e39_dash_temp", "pab_e39_shifter_knob_M", "pab_e39_dash.001"]) expect(shouldReplaceCabinNode(name)).toBe(true);
    for (const name of ["pab_e39_dash", "pab_e39_int", "pab_e39_seat_FL", "pab_e39_doorpanel_FL", "pab_e39_shifter_boot_M", "pab_e39_roof"]) expect(shouldReplaceCabinNode(name)).toBe(false);
  });

  it("adds nondegenerate exportable UVs without changing or mutating source cabin positions", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read("public/models/e39-body-9651faf179e2.glb");
    for (const name of ["pab_e39_seat_FL", "pab_e39_doorpanel_FL", "pab_e39_dash"]) {
      const node = doc.getRoot().listNodes().find(node => node.getName() === name)!;
      const primitive = node.getMesh()!.listPrimitives().find(p => /alcantara|int_trim/.test(p.getMaterial()!.getName()))!;
      const source = new T.BufferGeometry();
      source.setAttribute("position", new T.Float32BufferAttribute(Array.from(primitive.getAttribute("POSITION")!.getArray()!), 3));
      const mapped = createCabinGeometry(source, `source_mesh ${name}`)!;
      expect(source.hasAttribute("uv")).toBe(false);
      expect(Array.from(mapped.getAttribute("position").array)).toEqual(Array.from(source.getAttribute("position").array));
      const uv = Array.from(mapped.getAttribute("uv").array);
      expect(uv.every(Number.isFinite)).toBe(true);
      expect(Math.max(...uv) - Math.min(...uv)).toBeGreaterThan(.1);
      expect(mapped.getAttribute("uv").count).toBe(mapped.getAttribute("position").count);
      mapped.dispose(); source.dispose();
    }
    const exterior = new T.BoxGeometry(); exterior.deleteAttribute("uv");
    expect(createCabinGeometry(exterior, "pab_e39_fender_L")).toBeNull(); exterior.dispose();
  });
});
