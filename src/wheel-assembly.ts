import * as T from "three";
import { wheelFinishes, type Look } from "./studio-domain";
import { barrelGeometry, lathedGeometry, photoSpokeGeometry,
  tireGeometry, wheelHubGeometry } from "./wheel-geometry";
import { wheelDesigns } from "./tuning-parts";
import { wheelSpokeGeometry } from "./tuning-parts-geometry";
import { brakeDimensions, brakeHatGeometry, brakeVentGeometry, caliperGeometry,
  frictionRingGeometry } from "./brake-geometry";

function material(name: string, color: T.ColorRepresentation, metalness: number, roughness: number) {
  const m = new T.MeshStandardMaterial({ color, metalness, roughness });
  m.name = name;
  return m;
}

function add(parent: T.Object3D, name: string, geometry: T.BufferGeometry,
  mat: T.Material, position?: readonly [number, number, number]) {
  const mesh = new T.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  if (position) mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function cylinder(radius: number, height: number, segments = 32) {
  return new T.CylinderGeometry(radius, radius, height, segments).rotateX(Math.PI / 2);
}

// All details use ordinary meshes + glTF-compatible standard materials. The
// factory is also used by geometry/export verification without a browser.
export function createWheelAssembly(look: Pick<Look, "wheelSize" | "wheelStyle" | "wheelFinish" | "caliper">,
  roundel?: T.Texture, front = true) {
  const root = new T.Group();
  root.name = `E39_010_Wheel_${front ? "Front" : "Rear"}_${look.wheelStyle}_${look.wheelSize}`;
  const radius = look.wheelSize * 0.0254 / 2;
  const color = wheelFinishes[look.wheelFinish];
  const rim = material(`E39_010_Rim_${look.wheelFinish}`, color, 0.80, 0.29);
  const innerRim = material(`E39_010_Barrel_${look.wheelFinish}`, new T.Color(color).multiplyScalar(0.62), 0.77, 0.38);
  const rubber = material("E39_010_Tire_Rubber", "#222426", 0, 0.87);
  const darkRubber = material("E39_010_Valve_Rubber", "#121619", 0, 0.82);
  const steel = material("E39_010_Fastener_Zinc", "#8a8f95", 0.76, 0.36);
  const brakeFace = material("E39_010_Brake_Machined_Iron", "#9ba0a2", 0.82, 0.46);
  const brakeCast = material("E39_010_Brake_Cast_Iron", "#45494b", 0.72, 0.68);
  const caliperColor = look.caliper === "red" ? "#a02927" : look.caliper === "blue" ? "#28549e" : "#62676a";
  const caliper = material(`E39_010_Caliper_${look.caliper}`, caliperColor, 0.43, 0.48);
  const clip = material("E39_010_Caliper_Spring_Steel", "#626b72", 0.78, 0.36);

  add(root, "E39_010_Tire_Closed_Recessed_Tread", tireGeometry(radius), rubber);
  add(root, "E39_010_Rim_Drop_Center_Barrel", barrelGeometry(radius), innerRim);
  // The front lip is a rounded section, not a pair of intersecting wire rings.
  add(root, "E39_010_Rim_Rolled_Front_Lip", lathedGeometry([
    [radius - 0.010, 0.091], [radius - 0.008, 0.097], [radius - 0.005, 0.102],
    [radius, 0.1055], [radius + 0.003, 0.103], [radius + 0.004, 0.099],
    [radius + 0.003, 0.095], [radius - 0.001, 0.092], [radius - 0.010, 0.091],
  ]), rim);
  add(root, "E39_010_Rim_Hub_With_Open_Lug_Bores", wheelHubGeometry(), rim);
  const style = look.wheelStyle === "reference" ? "photo" : look.wheelStyle;
  const design = wheelDesigns.find(d => d.id === style)!;
  const spokes = design.profile === "disc" || design.profile === "slot" ? 1 : design.spokes;
  const spokeGeometry = style === "photo" ? photoSpokeGeometry(radius) : wheelSpokeGeometry(design, radius);
  for (let i = 0; i < spokes; i++) {
    const pair = new T.Group();
    pair.name = `E39_010_Spoke_Unit_${i + 1}`;
    pair.rotation.z = i * Math.PI * 2 / spokes;
    root.add(pair);
    for (const split of design.split === 2 && style !== "photo" ? [-1, 1] : [0]) {
      const spoke = add(pair, `E39_010_Spoke_${i + 1}_${split}`, spokeGeometry, rim);
      spoke.position.x = split * .006;
      spoke.scale.x = split < 0 ? -1 : 1;
      spoke.rotation.z = split * (design.profile === "mesh" ? .15 : design.profile === "y" ? .09 : .045);
    }
  }
  const lugSeat = lathedGeometry([
    [0.0115, 0.075], [0.0105, 0.074], [0.0070, 0.067],
    [0.0070, 0.060], [0.0115, 0.060], [0.0115, 0.075],
  ], 24);
  const bolt = cylinder(0.0065, 0.007, 6);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, x = Math.sin(a) * 0.059, y = Math.cos(a) * 0.059;
    add(root, `E39_010_Lug_Conical_Seat_${i}`, lugSeat, innerRim, [x, y, 0]);
    add(root, `E39_010_Lug_Recessed_Hex_Bolt_${i}`, bolt, steel, [x, y, 0.063]);
  }
  add(root, "E39_010_Center_Cap_Bezel", lathedGeometry([
    [0.0220, 0.074], [0.0238, 0.075], [0.0241, 0.0775],
    [0.0228, 0.079], [0.0218, 0.078], [0.0220, 0.074],
  ], 64), rim);
  const logo = material("E39_010_Center_Roundel", "#f4f6f7", 0.2, 0.30);
  if (roundel) logo.map = roundel;
  add(root, "E39_010_Center_Cap_Roundel", new T.CircleGeometry(0.0221, 64), logo, [0, 0, 0.0783]);
  const valveAngle = Math.PI * 1.28, vr = radius - 0.018;
  const valve = new T.Group();
  valve.name = "E39_010_Valve_Assembly";
  valve.position.set(Math.sin(valveAngle) * vr, Math.cos(valveAngle) * vr, 0.079);
  add(valve, "E39_010_Valve_Sealing_Base", cylinder(0.0045, 0.005), darkRubber);
  add(valve, "E39_010_Valve_Stem", cylinder(0.0025, 0.016), steel, [0, 0, 0.008]);
  add(valve, "E39_010_Valve_Cap", cylinder(0.0033, 0.007, 12), darkRubber, [0, 0, 0.018]);
  root.add(valve);

  const brakes = new T.Group(), d = brakeDimensions(front);
  brakes.name = `E39_010_Brake_${front ? "Front" : "Rear"}_Plain_Vented`;
  root.add(brakes);
  add(brakes, "E39_010_Brake_Friction_Face_Outer", frictionRingGeometry(front, true), brakeFace);
  add(brakes, "E39_010_Brake_Friction_Face_Inner", frictionRingGeometry(front, false), brakeFace);
  add(brakes, "E39_010_Brake_Internal_Vanes", brakeVentGeometry(front), brakeCast);
  add(brakes, "E39_010_Brake_Formed_Hat", brakeHatGeometry(front), brakeCast);
  add(brakes, "E39_010_Brake_Dust_Shield", lathedGeometry([
    [0.047, -0.005], [d.outerRadius + 0.005, -0.005],
    [d.outerRadius + 0.008, -0.002], [d.outerRadius + 0.007, 0],
    [d.outerRadius + 0.004, -0.003], [0.047, -0.003], [0.047, -0.005],
  ]), brakeCast);
  const caliperGroup = new T.Group();
  caliperGroup.name = "E39_010_Brake_Floating_Caliper_Assembly";
  caliperGroup.rotation.z = -0.28;
  brakes.add(caliperGroup);
  add(caliperGroup, "E39_010_Caliper_Carrier", caliperGeometry(front, true), brakeCast);
  add(caliperGroup, "E39_010_Caliper_Cast_Housing", caliperGeometry(front), caliper);
  const scale = front ? 1 : 0.94;
  const springCurve = new T.CatmullRomCurve3([
    new T.Vector3(0.140 * scale, -0.040 * scale, 0.0555),
    new T.Vector3(0.151 * scale, -0.024 * scale, 0.057),
    new T.Vector3(0.153 * scale, 0, 0.057),
    new T.Vector3(0.151 * scale, 0.024 * scale, 0.057),
    new T.Vector3(0.140 * scale, 0.040 * scale, 0.0555),
  ]);
  add(caliperGroup, "E39_010_Caliper_Retaining_Spring", new T.TubeGeometry(springCurve, 28, 0.0011, 6), clip);
  add(caliperGroup, "E39_010_Caliper_Bleed_Nipple", cylinder(0.003, 0.011, 6), steel,
    [0.153 * scale, 0.047 * scale, 0.054]);
  root.userData = { revision: "0.10", visualReconstruction: true, measuredFitment: false,
    tireRadius: 0.308, closedTread: true, ordinaryExportableMeshes: true };
  return root;
}

export function disposeWheelAssembly(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  root.traverse(node => {
    if (node instanceof T.Mesh) {
      geometries.add(node.geometry);
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m);
    }
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}
