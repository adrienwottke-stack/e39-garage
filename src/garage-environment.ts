import { Euler, Matrix4, Vector3 } from "three";

export type GarageVector = [number, number, number];
export type GaragePanel = {
  name: string;
  position: GarageVector;
  target: GarageVector;
  width: number;
  height: number;
  color: string;
  reflection: number;
  intensity: number;
  watts: number;
};

// Metres in the same Y-up coordinates as the configured car. These panels are
// shared by the visible fixtures, reflection capture and the Cycles package.
export const garageRoom = {
  halfWidth: 9,
  back: -9,
  front: 12,
  height: 6.2,
  floorY: -0.014,
  color: "#111820",
  wall: "#202b35",
  steel: "#26323d",
  floor: "#303840",
} as const;

export const garagePanels: readonly GaragePanel[] = [
  { name: "roof-left", position: [-1.75, 4.9, 0], target: [-1.75, 0, 0], width: 1.65, height: 7.2, color: "#f2f5f7", reflection: 4.2, intensity: 7, watts: 1250 },
  { name: "roof-right", position: [1.75, 4.9, 0], target: [1.75, 0, 0], width: 1.65, height: 7.2, color: "#f2f5f7", reflection: 4.2, intensity: 7, watts: 1250 },
  { name: "front-fill", position: [0, 5.5, 6.8], target: [0, 0.7, 0], width: 5.4, height: 1.25, color: "#e5edf3", reflection: 1.7, intensity: 4, watts: 700 },
  { name: "left-wall", position: [-7.9, 2.8, -0.4], target: [0, 1, 0], width: 6, height: 1.05, color: "#d9e8f1", reflection: 1.8, intensity: 4, watts: 650 },
  { name: "right-wall", position: [7.9, 2.8, -0.4], target: [0, 1, 0], width: 6, height: 1.05, color: "#eef0ed", reflection: 1.8, intensity: 4, watts: 650 },
  { name: "rear-edge", position: [0, 3.4, -7.8], target: [0, 0.8, 0], width: 4.8, height: 0.65, color: "#e4edf4", reflection: 2, intensity: 4, watts: 550 },
] as const;

export function panelRotation(panel: GaragePanel): GarageVector {
  const position = new Vector3(...panel.position);
  const target = new Vector3(...panel.target);
  const up = Math.abs(position.y - target.y) > 4 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0);
  const rotation = new Euler().setFromRotationMatrix(new Matrix4().lookAt(target, position, up));
  return [rotation.x, rotation.y, rotation.z];
}

function rotated(point: GarageVector, angle: number): GarageVector {
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return [point[0] * c + point[2] * s, point[1], -point[0] * s + point[2] * c];
}

export function garageLightsForExport(angle: number) {
  return garagePanels.map(panel => ({
    name: panel.name,
    position: rotated(panel.position, angle),
    target: rotated(panel.target, angle),
    up: rotated(Math.abs(panel.position[1] - panel.target[1]) > 4 ? [0, 0, -1] : [0, 1, 0], angle),
    width: panel.width,
    height: panel.height,
    color: panel.color,
    watts: panel.watts,
  }));
}
