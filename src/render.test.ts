import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  defaultRender,
  exportSize,
  formats,
  renderFilename,
  renderSchema,
} from "./render-domain";
import { captureRender } from "./capture-render";
import { lookIdeas, photoLook } from "./studio-domain";

describe("Rendergrößen und gespeicherte Studioeinstellungen", () => {
  it("probiert Ideen aus ohne den Ausgangslook oder andere Ideen umzuschreiben", () => {
    const baseline = photoLook(),
      ideas = lookIdeas(baseline);
    expect(ideas).toHaveLength(4);
    ideas[0].look.paint = "#ffffff";
    expect(baseline.paint).toBe("#254b87");
    expect(ideas[1].look.paint).toBe("#254b87");
  });
  it("hält Bildformate, Auflösungen und Speichergrenze zusammen", () => {
    for (const format of formats)
      for (const quality of ["hd", "large"] as const) {
        const s = { ...defaultRender(), format: format.id, quality };
        const { width, height } = exportSize(s);
        const [a, b] = format.ratio.split(" / ").map(Number);
        expect(width / height).toBeCloseTo(a / b, 8);
        expect(width * height).toBeLessThanOrEqual(8_400_000);
      }
    expect(exportSize({ ...defaultRender(), quality: "large" })).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(() =>
      exportSize({ ...defaultRender(), quality: "large" }, 2048),
    ).toThrow("kleinere");
  });
  it("weist beschädigte Einstellungen zurück und erzeugt sichere Dateinamen", () => {
    expect(() =>
      renderSchema.parse({ ...defaultRender(), exposure: 99 }),
    ).toThrow();
    expect(() =>
      renderSchema.parse({ ...defaultRender(), focal: 0 }),
    ).toThrow();
    const filename = renderFilename("../../Mein blauer E39?!", defaultRender());
    expect(filename).toBe("E39-Mein-blauer-E39-workshop-1920x1080.png");
  });
});

function renderer(blob: Blob | null, limit = 8192) {
  const state = { size: new THREE.Vector2(800, 500), ratio: 1.5 };
  const render = vi.fn();
  const gl = {
    capabilities: { maxTextureSize: limit },
    getContext: () => ({
      MAX_RENDERBUFFER_SIZE: 1,
      getParameter: () => limit,
      isContextLost: () => false,
    }),
    getSize: (target: THREE.Vector2) => target.copy(state.size),
    getPixelRatio: () => state.ratio,
    setPixelRatio: (value: number) => {
      state.ratio = value;
    },
    setSize: (w: number, h: number) => {
      state.size.set(w, h);
    },
    render,
    domElement: {
      toBlob: (callback: (value: Blob | null) => void) => callback(blob),
    },
  } as unknown as THREE.WebGLRenderer;
  return { gl, state, render };
}
describe("PNG-Aufnahme ohne Verlust der laufenden 3D-Ansicht", () => {
  it('nutzt beim Export dieselbe Schattenpipeline und stellt sie nach einem Fehler auf die Vorschau zurück',async()=>{
    const {gl,state}=renderer(null),camera=new THREE.PerspectiveCamera(36,1.6);
    const pipeline=vi.fn().mockImplementationOnce(()=>{throw new Error('Pipelinefehler');});
    await expect(captureRender(gl,new THREE.Scene(),camera,{width:1920,height:1080},pipeline)).rejects.toThrow('Pipelinefehler');
    expect(pipeline.mock.calls).toEqual([[1920,1080],[1200,750]]);
    expect(state.size.toArray()).toEqual([800,500]);expect(camera.aspect).toBe(1.6);
  });
  it("rendert in echter Exportgröße und stellt Kamera und Canvas wieder her", async () => {
    const blob = new Blob(["test"], { type: "image/png" });
    const { gl, state, render } = renderer(blob);
    const camera = new THREE.PerspectiveCamera(36, 1.6);
    camera.position.set(4, 2, 5);
    let exportSizeSeen: THREE.Vector2 | undefined;
    render.mockImplementationOnce(() => {
      exportSizeSeen = state.size.clone();
      expect(camera.aspect).toBeCloseTo(16 / 9);
    });
    expect(
      await captureRender(gl, new THREE.Scene(), camera, {
        width: 1920,
        height: 1080,
      }),
    ).toBe(blob);
    expect(exportSizeSeen?.toArray()).toEqual([1920, 1080]);
    expect(state.size.toArray()).toEqual([800, 500]);
    expect(state.ratio).toBe(1.5);
    expect(camera.aspect).toBe(1.6);
    expect(camera.position.toArray()).toEqual([4, 2, 5]);
    expect(render).toHaveBeenCalledTimes(2);
  });
  it("stellt die Vorschau auch nach fehlgeschlagener Bildkodierung wieder her", async () => {
    const { gl, state } = renderer(null);
    const camera = new THREE.PerspectiveCamera(36, 1.6);
    await expect(
      captureRender(gl, new THREE.Scene(), camera, {
        width: 1440,
        height: 1440,
      }),
    ).rejects.toThrow("PNG");
    expect(state.size.toArray()).toEqual([800, 500]);
    expect(state.ratio).toBe(1.5);
    expect(camera.aspect).toBe(1.6);
  });
  it("allokiert keine unzulässigen Bilder und hält die GPU-Grenze ein", async () => {
    const { gl, state, render } = renderer(null, 2048);
    await expect(
      captureRender(gl, new THREE.Scene(), new THREE.Camera(), {
        width: 3840,
        height: 2160,
      }),
    ).rejects.toThrow("kleinere");
    expect(render).not.toHaveBeenCalled();
    expect(state.size.toArray()).toEqual([800, 500]);
  });
  it("stellt nach einem fehlgeschlagenen Grafikaufruf die Vorschaugröße wieder her", async () => {
    const { gl, state, render } = renderer(null);
    render.mockImplementationOnce(() => {
      throw new Error("synthetischer Grafikfehler");
    });
    const camera = new THREE.PerspectiveCamera(36, 1.6);
    await expect(
      captureRender(gl, new THREE.Scene(), camera, {
        width: 1920,
        height: 1080,
      }),
    ).rejects.toThrow("Grafikfehler");
    expect(state.size.toArray()).toEqual([800, 500]);
    expect(camera.aspect).toBe(1.6);
    expect(state.ratio).toBe(1.5);
  });
});
