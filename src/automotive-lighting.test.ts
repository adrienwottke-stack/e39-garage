import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { automotiveLighting, automotivePanelIntensity, configureAutomotiveRenderer, createSoftboxProfile } from "./automotive-lighting";

describe("Automotive-Licht ohne Bildweichzeichnung", () => {
  it("hält Belichtung unverändert und genau einen linearen Ausgabeweg", () => {
    const renderer = {
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 0.85,
      outputColorSpace: THREE.LinearSRGBColorSpace,
      shadowMap: { type: THREE.BasicShadowMap, needsUpdate: false },
    } as unknown as THREE.WebGLRenderer;
    const restore = configureAutomotiveRenderer(renderer, 1.15);
    expect(renderer.toneMapping).toBe(THREE.AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.15);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.shadowMap.type).toBe(THREE.PCFShadowMap);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
    restore();
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.85);
    expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(renderer.shadowMap.type).toBe(THREE.BasicShadowMap);
  });

  it("modelliert weiche Diffusorränder in linearem Licht mit neutralem Zentrum", () => {
    const texture = createSoftboxProfile(64), data = texture.image.data!;
    const pixel = (x: number, y: number) => Number(data[(y * 64 + x) * 4]);
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(pixel(32, 32)).toBe(255);
    expect(pixel(0, 32)).toBeLessThan(4);
    expect(pixel(0, 32)).toBe(pixel(63, 32));
    expect(pixel(32, 0)).toBe(pixel(32, 63));
    for (let x = 1; x < 16; x++) expect(pixel(x, 32)).toBeGreaterThanOrEqual(pixel(x - 1, 32));
    for (let index = 0; index < data.length; index += 4) {
      expect(data[index]).toBe(data[index + 1]);
      expect(data[index]).toBe(data[index + 2]);
      expect(data[index + 3]).toBe(255);
    }
    texture.dispose();
  });

  it("begrenzt AO auf Kontaktbereiche und reduziert reflektierte Spitzen", () => {
    expect(automotiveLighting.ao.radius).toBeLessThanOrEqual(0.1);
    expect(automotiveLighting.ao.thickness).toBeLessThan(automotiveLighting.ao.radius);
    expect(automotiveLighting.aoBlend).toBeLessThan(0.5);
    expect(automotivePanelIntensity("roof-left", 4.2)).toBeLessThan(4.2);
    expect(automotivePanelIntensity("front-fill", 1.7)).toBeGreaterThan(1);
    expect(automotiveLighting.keyPosition[1]).toBeGreaterThan(4);
    expect(automotiveLighting.keyPosition[2]).toBe(0);
    expect(automotiveLighting.shadowNormalBias).toBeLessThanOrEqual(0.005);
  });
});
