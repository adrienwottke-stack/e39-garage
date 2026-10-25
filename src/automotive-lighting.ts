import * as THREE from "three";

// Linear scene-referred light reaches exactly one OutputPass. AgX compresses
// bright clearcoat highlights without the ACES implementation's extra 1/0.6
// exposure scale or a second gamma conversion.
export const automotiveLighting = {
  toneMapping: THREE.AgXToneMapping,
  environmentIntensity: 1,
  reflectionResolution: 512,
  hemisphereIntensity: 0.25,
  keyPosition: [-1.75, 4.65, 0] as [number, number, number],
  keyIntensity: 1.15,
  fillIntensity: 0.4,
  shadowRadius: 4.5,
  shadowNormalBias: 0.004,
  shadowBias: -0.00008,
  shadowIntensity: 0.85,
  ao: { radius: 0.09, thickness: 0.065, distanceExponent: 2, scale: 1, samples: 16 },
  aoBlend: 0.4,
} as const;

export function configureAutomotiveRenderer(renderer: THREE.WebGLRenderer, exposure: number) {
  const previous = {
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
    shadowType: renderer.shadowMap.type,
  };
  renderer.toneMapping = automotiveLighting.toneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate = true;
  return () => {
    renderer.toneMapping = previous.toneMapping;
    renderer.toneMappingExposure = previous.exposure;
    renderer.outputColorSpace = previous.outputColorSpace;
    renderer.shadowMap.type = previous.shadowType;
    renderer.shadowMap.needsUpdate = true;
  };
}

// A feathered diffuser is part of the local radiance map, not a screen blur.
// The car, lettering, gaps and geometry retain their original sharpness.
export function createSoftboxProfile(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const edge = 0.16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    const distance = Math.min(u, 1 - u, v, 1 - v);
    const value = Math.round(255 * THREE.MathUtils.smoothstep(distance, 0, edge));
    const offset = (y * size + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = "E39_LINEAR_SOFTBOX_PROFILE";
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function automotivePanelIntensity(name: string, intensity: number) {
  return intensity * (name.startsWith("roof-") ? 0.78 : 0.9);
}
