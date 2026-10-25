import * as T from 'three';

export type VehicleGlassKind = 'window' | 'headlight' | 'taillight';

export function vehicleGlassKind(nodeName: string): VehicleGlassKind {
  if (/headlight/.test(nodeName)) return 'headlight';
  if (/taillight/.test(nodeName)) return 'taillight';
  return 'window';
}

/**
 * 0.8's windscreen, backlight and door windows already contain separate outer
 * and inner skins with correct winding. Preserve their surfaces and normals.
 * Distinct names let the Cycles adapter retain exported optical properties.
 */
export function createVehicleGlassMaterial(kind: VehicleGlassKind): T.MeshPhysicalMaterial {
  const window = kind === 'window';
  const material = new T.MeshPhysicalMaterial({
    name: `E39_${kind}_glass`,
    color: '#ffffff',
    metalness: 0,
    roughness: window ? .025 : .017,
    transmission: 1,
    // The source already has separate front/back skins. An additional optical
    // volume per skin caused a second refraction step and a milky white layer.
    thickness: 0,
    attenuationColor: window ? '#d9e4de' : '#ffffff',
    attenuationDistance: window ? 4 : 10,
    ior: window ? 1.48 : 1.49,
    clearcoat: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    side: T.FrontSide,
    envMapIntensity: window ? .72 : .78,
  });
  material.userData = {vehicleGlassKind: kind, pairedWindowSkins: window, opticalRevision: '0.12', thinWallOptics: true};
  return material;
}
