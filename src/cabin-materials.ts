import * as T from "three";
import type { Look } from "./studio-domain";

export type CabinMaterialKind =
  | "cloth" | "leather" | "belt" | "stitch" | "trim"
  | "metal" | "plastic" | "carpet" | "buckle" | "warning-off";

// Only these source objects are replaced. The dashboard, vents, shifter boot,
// seats and door cards remain the fitted geometry from the original asset.
export function shouldReplaceCabinNode(name: string) {
  return /^pab_e39_(?:steer|dash_business|needle_speedo|needle_tacho|dash_fuel|dash_temp|shifter_knob_M)(?:$|_)/.test(name)
    || name === "pab_e39_dash.001";
}

export function cabinMaterialKind(nodeName: string, materialName: string): CabinMaterialKind | null {
  // GLTFLoader gives a multiple-primitive object's child mesh a generated name;
  // its semantic pab_e39 name is on the parent group.
  const node = nodeName.match(/(?:^|\s)(pab_e39_[^\s]+)/)?.[1] ?? nodeName;
  if (!/^pab_e39_(?:dash|doorpanel|seat|seats|shifter|int(?:$|_)|sunvisor|brakepedal|clutchpedal)/.test(node)) return null;
  if (/int_trim/.test(materialName)) return "trim";
  if (/realalcantara|alcantara/.test(materialName)) return "cloth";
  // In the selected source, cloth07_black is the seat-belt webbing, not the
  // seat's centre fabric. It must stay dark when cognac upholstery is selected.
  if (/cloth07/.test(materialName)) return "belt";
  if (/leather2/.test(materialName)) return "leather";
  if (/stitches/.test(materialName)) return "stitch";
  if (/chrome|silver|metal/.test(materialName)) return "metal";
  if (/red$/.test(materialName)) return "buckle";
  if (/signal_R|highbeam/.test(materialName) && /^pab_e39_dash$/.test(node)) return "warning-off";
  if (/black/.test(materialName)) return /^pab_e39_int$/.test(node) ? "carpet" : "plastic";
  return null;
}

export function createCabinGeometry(source: T.BufferGeometry, nodeName: string): T.BufferGeometry | null {
  if (!cabinMaterialKind(nodeName, "pab_e39_black_rough") || source.hasAttribute("uv")) return null;
  // The texture-free base GLB discarded all cabin UVs. Project in metre space so
  // exported normal maps have real, finite texture coordinates. The oblique
  // seat projection covers both cushions and backrests without a UV seam across
  // their shared edge; door cards use their longitudinal/vertical axes.
  const geometry = source.clone(), p = geometry.getAttribute("position"), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    if (/doorpanel/.test(nodeName)) { uv[i * 2] = p.getZ(i) * 2.5; uv[i * 2 + 1] = p.getY(i) * 2.5; }
    else if (/shifter_boot/.test(nodeName)) { uv[i * 2] = Math.atan2(p.getZ(i) - .1686, p.getX(i) - .0144) / (2 * Math.PI); uv[i * 2 + 1] = p.getY(i) * 4; }
    else if (/pab_e39_int(?:\s|$)/.test(nodeName)) { uv[i * 2] = p.getX(i) * 2.5; uv[i * 2 + 1] = -p.getZ(i) * 2.5; }
    else { uv[i * 2] = p.getX(i) * 2.5; uv[i * 2 + 1] = (p.getY(i) - p.getZ(i)) * 2.5; }
  }
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  return geometry;
}

export type CabinSurfaceMaps = Record<"cloth" | "leather" | "plastic" | "brushed", T.CanvasTexture>;

function noise(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function createCabinSurfaceNormal(kind: keyof CabinSurfaceMaps) {
  const size = 128, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!, pixels = ctx.createImageData(size, size);
  const height = (x: number, y: number) => {
    x = (x + size) % size; y = (y + size) % size;
    if (kind === "brushed") return noise(0, y) * .018 + noise(x, y) * .003;
    if (kind === "cloth") return Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) * .22 + noise(x, y) * .08;
    if (kind === "leather") return noise(Math.floor(x / 3), Math.floor(y / 3)) * .22 + noise(x, y) * .045;
    return noise(x, y) * .13;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = height(x + 1, y) - height(x - 1, y), dy = height(x, y + 1) - height(x, y - 1);
    const normal = new T.Vector3(-dx, -dy, 1).normalize(), i = (y * size + x) * 4;
    pixels.data[i] = (normal.x * .5 + .5) * 255;
    pixels.data[i + 1] = (normal.y * .5 + .5) * 255;
    pixels.data[i + 2] = (normal.z * .5 + .5) * 255;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.name = `E39 cabin ${kind} procedural normal`;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  // Projected source UVs are 2.5 units per metre. Forty repeats × 128 rows
  // therefore put brush marks at roughly 0.078 mm, rather than visible grooves.
  texture.repeat.set(kind === "brushed" ? 40 : 22, kind === "brushed" ? 40 : 22);
  texture.anisotropy = 8;
  return texture;
}

export function createCabinSurfaceMaps(): CabinSurfaceMaps {
  return { cloth: createCabinSurfaceNormal("cloth"), leather: createCabinSurfaceNormal("leather"), plastic: createCabinSurfaceNormal("plastic"), brushed: createCabinSurfaceNormal("brushed") };
}

export function disposeCabinSurfaceMaps(maps: CabinSurfaceMaps) {
  Object.values(maps).forEach(map => map.dispose());
}

export function createCabinMaterial(source: T.Material, nodeName: string, maps: CabinSurfaceMaps): T.MeshStandardMaterial | null {
  const kind = cabinMaterialKind(nodeName, source.name);
  if (!kind) return null;
  const material = new T.MeshStandardMaterial({ name: `E39_cabin_${kind}`, side: T.DoubleSide });
  material.userData.cabinKind = kind;
  if (["cloth", "belt", "carpet"].includes(kind)) material.normalMap = maps.cloth;
  else if (kind === "leather") material.normalMap = maps.leather;
  else if (kind === "trim") material.normalMap = maps.brushed;
  else if (kind === "plastic") material.normalMap = maps.plastic;
  const normalStrength = kind === "trim" ? .05 : kind === "cloth" ? .42 : .25;
  material.normalScale.set(normalStrength, normalStrength);
  material.envMapIntensity = kind === "trim" || kind === "metal" ? .6 : .22;
  updateCabinMaterial(material);
  return material;
}

export function updateCabinMaterial(material: T.Material, look?: Pick<Look, "upholstery" | "interiorTrim">) {
  const m = material as T.MeshStandardMaterial, kind = m.userData.cabinKind as CabinMaterialKind | undefined;
  if (!kind) return;
  m.metalness = 0;
  m.roughness = .85;
  m.emissive.set("#000000");
  m.emissiveIntensity = 0;
  if (kind === "cloth") { m.color.set(look?.upholstery === "cognac" ? "#76503a" : "#3b3b40"); m.roughness = .96; }
  if (kind === "leather") { m.color.set(look?.upholstery === "cognac" ? "#805237" : "#171b1f"); m.roughness = .68; }
  if (kind === "belt") { m.color.set("#1e2023"); m.roughness = .98; }
  if (kind === "carpet") { m.color.set("#222429"); m.roughness = .99; }
  if (kind === "plastic") { m.color.set("#20252a"); m.roughness = .84; }
  if (kind === "stitch") { m.color.set(look?.upholstery === "cognac" ? "#957255" : "#45464a"); m.roughness = .92; }
  if (kind === "trim") { m.color.set(look?.interiorTrim === "dark" ? "#24292e" : "#adb3b7"); m.metalness = look?.interiorTrim === "dark" ? .26 : .74; m.roughness = .38; }
  if (kind === "metal") { m.color.set("#8d949b"); m.metalness = .88; m.roughness = .28; }
  if (kind === "buckle") { m.color.set("#7b2024"); m.roughness = .67; }
  if (kind === "warning-off") { m.color.set("#14191e"); m.roughness = .8; }
}
