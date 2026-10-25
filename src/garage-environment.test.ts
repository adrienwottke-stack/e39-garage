import { describe, expect, it, vi, afterEach } from "vitest";
import { Buffer } from "node:buffer";
import * as THREE from "three";
import { strFromU8, unzipSync } from "fflate";
import { garageLightsForExport, garagePanels, garageRoom, panelRotation } from "./garage-environment";
import { defaultRender, environments } from "./render-domain";
import { concreteTexture } from "./floor-surface";

const { parseAsync } = vi.hoisted(() => ({ parseAsync: vi.fn() }));
vi.mock("three/addons/exporters/GLTFExporter.js", () => ({
  GLTFExporter: class { parseAsync = parseAsync; },
}));
import { exportBlender } from "./export-blender";

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("Tuning-Garage: ein gemeinsamer Lichtraum", () => {
  it("behält gespeicherte Umgebungs-IDs und die Garage als Einstieg", () => {
    expect(defaultRender().environment).toBe("workshop");
    expect(environments.map(environment => environment.id)).toEqual(["workshop", "pearl", "graphite", "sunset"]);
    expect(environments[0].name).toBe("Tuning-Garage");
  });

  it("richtet sichtbare Diffusoren und Reflexionsflächen auf denselben Wagenraum", () => {
    expect(garagePanels).toHaveLength(6);
    expect(new Set(garagePanels.map(panel => panel.name)).size).toBe(garagePanels.length);
    for (const panel of garagePanels) {
      const facing = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...panelRotation(panel)));
      const direction = new THREE.Vector3(...panel.target).sub(new THREE.Vector3(...panel.position)).normalize();
      expect(facing.dot(direction)).toBeCloseTo(1, 10);
      expect(panel.width * panel.height).toBeGreaterThan(3);
      expect(panel.position[1]).toBeLessThan(garageRoom.height);
      expect(panel.watts).toBeGreaterThan(0);
    }
  });

  it("rotiert Cycles-Flächen einschließlich Hochachse wie die Vorschau", () => {
    const rotated = garageLightsForExport(90);
    for (let index = 0; index < garagePanels.length; index++) {
      const source = garagePanels[index], target = rotated[index];
      expect(target.position[0]).toBeCloseTo(source.position[2], 10);
      expect(target.position[1]).toBe(source.position[1]);
      expect(target.position[2]).toBeCloseTo(-source.position[0], 10);
      expect(target.target[0]).toBeCloseTo(source.target[2], 10);
      expect(target.width).toBe(source.width);
      expect(target.height).toBe(source.height);
      const direction = new THREE.Vector3(...target.target).sub(new THREE.Vector3(...target.position)).normalize();
      expect(Math.abs(direction.dot(new THREE.Vector3(...target.up)))).toBeLessThan(0.95);
    }
  });

  it("erzeugt eine deterministische neutrale Bodenstruktur ohne Bilddownload", () => {
    const first = concreteTexture(), second = concreteTexture();
    expect(first.image.width).toBe(512);
    expect(Buffer.from(first.image.data!).equals(Buffer.from(second.image.data!))).toBe(true);
    expect(first.repeat.toArray()).toEqual([16, 16]);
    first.dispose(); second.dispose();
  });
});

describe("Szenenpaket mit echter 3D-Garage", () => {
  it("verpackt die gemeinsame Lichtgeometrie ohne Foto-HDRI oder Netzabruf", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    parseAsync.mockResolvedValueOnce(new ArrayBuffer(16));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1.2);
    const sourceMaterial = new THREE.MeshStandardMaterial({ color: "#48525d" });
    sourceMaterial.onBeforeCompile = () => undefined;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), sourceMaterial);
    floor.userData.garageFloor = true; scene.add(floor);
    scene.add(new THREE.DirectionalLight());
    const sourceDispose = vi.spyOn(sourceMaterial, "dispose");
    const settings = { ...defaultRender(), quality: "large" as const };
    const archive = unzipSync(new Uint8Array(await (await exportBlender(scene, camera, settings)).arrayBuffer()));
    const config = JSON.parse(strFromU8(archive["render.json"]));
    expect(Object.keys(archive)).toContain("scene.glb");
    expect(Object.keys(archive)).not.toContain("environment.hdr");
    expect(config.width).toBe(3840); expect(config.height).toBe(2160);
    expect(config.environment.kind).toBe("procedural-tuning-bay");
    expect(config.environment.lights).toEqual(garageLightsForExport(settings.lightAngle));
    expect(fetch).not.toHaveBeenCalled();
    const snapshot = parseAsync.mock.calls[0][0] as THREE.Scene;
    const snapshotFloor = snapshot.getObjectByName("E39_RENDER_FLOOR") as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    expect(snapshotFloor.material).not.toBe(sourceMaterial);
    expect(snapshotFloor.material.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
    expect(snapshot.children.filter(object => object instanceof THREE.Light).every(light => !light.visible)).toBe(true);
    expect(floor.name).toBe(""); expect(floor.material).toBe(sourceMaterial);
    expect(camera.aspect).toBe(1.2); expect(sourceDispose).not.toHaveBeenCalled();
    sourceMaterial.dispose(); floor.geometry.dispose();
  });

  it("lässt Originalmaterialien auch bei einem Exportfehler unberührt", async () => {
    parseAsync.mockRejectedValueOnce(new Error("synthetischer Exportfehler"));
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); scene.add(mesh);
    const disposed = vi.spyOn(material, "dispose");
    await expect(exportBlender(scene, new THREE.PerspectiveCamera(), defaultRender())).rejects.toThrow("synthetischer Exportfehler");
    expect(mesh.material).toBe(material); expect(disposed).not.toHaveBeenCalled();
    material.dispose(); mesh.geometry.dispose();
  });
});
