import { garagePanels, garageRoom, panelRotation } from "./garage-environment";
import { memo, useEffect, useMemo } from "react";
import { garageAccentTexture } from "./garage-accent";

function Block({
  name, position, size, color = garageRoom.steel, metalness = 0.35, roughness = 0.7,
}: {
  name?: string;
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  metalness?: number;
  roughness?: number;
}) {
  return <mesh name={name} position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>;
}

function Strip({ position, size, color }: {
  position: [number, number, number]; size: [number, number, number]; color: string;
}) {
  return <mesh position={position}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.5} />
  </mesh>;
}

// Real geometry, deliberately sparse: the same tuning bay is present in scene
// exports, free-camera views, floor reflections and the live configurator.
export default memo(function Workshop({ lightAngle = 25 }: { lightAngle?: number }) {
  const wallAccents = useMemo(() => [garageAccentTexture("#2e92ca"), garageAccentTexture("#bc743e")], []);
  useEffect(() => () => wallAccents.forEach(texture => texture.dispose()), [wallAccents]);
  return <group name="E39_TUNING_GARAGE" userData={{ garageRevision: "0.11", environment: "procedural-tuning-bay" }}>
    <Block name="rear-wall" position={[0, 3.1, -9.1]} size={[18.2, 6.2, 0.2]} color="#17212a" />
    {[-1, 1].map((side, index) => <mesh key={`wall-accent-${side}`} position={[side * 5.9, 1.9, -8.995]}>
      <planeGeometry args={[5.7, 3.8]} />
      <meshStandardMaterial color="#17212a" emissive="#ffffff" emissiveMap={wallAccents[index]} emissiveIntensity={0.42} roughness={0.95} />
    </mesh>)}
    <Block position={[0, 6.22, 1.5]} size={[18.2, 0.12, 21]} color="#151c23" />
    <Block position={[0, 2.45, -8.94]} size={[5.8, 4.5, 0.07]} color="#27333e" roughness={0.76} />
    {Array.from({ length: 15 }, (_, i) => <Block key={`door-${i}`} position={[0, 0.4 + i * 0.29, -8.884]} size={[5.67, 0.018, 0.015]} color="#17232e" />)}
    {[-1, 1].map(side => <group key={side}>
      <Block position={[side * 9.05, 3.1, 1.5]} size={[0.1, 6.2, 21]} color={garageRoom.wall} />
      <Block position={[side * 8.97, 0.5, 1.5]} size={[0.04, 1, 21]} color="#162029" />
      <Block position={[side * 8.94, 1.03, 1.5]} size={[0.035, 0.035, 21]} color="#52606c" />
      <Strip position={[side * 8.88, 1.55, 0.25]} size={[0.035, 0.08, 6.9]} color={side < 0 ? "#45a6dc" : "#d7924a"} />
      {[-7.3, -3.6, 0.1, 3.8, 7.5, 11.2].map(z => <group key={z}>
        <Block position={[side * 8.86, 3.5, z]} size={[0.15, 5.4, 0.12]} color="#33414d" />
        <Block position={[side * 8.97, 5.9, z]} size={[0.12, 0.2, 3.5]} color="#111921" />
      </group>)}
      <Strip position={[side * 3.05, 2.5, -8.84]} size={[0.08, 4.2, 0.035]} color={side < 0 ? "#45a6dc" : "#d7924a"} />
      <Block position={[side * 6.35, 0.51, -7.95]} size={[3.1, 1.02, 0.9]} color="#293946" roughness={0.5} />
      <Block position={[side * 6.35, 1.04, -7.95]} size={[3.25, 0.07, 1]} color="#59656d" roughness={0.38} metalness={0.7} />
      {[0.2, 0.44, 0.68, 0.92].map(y => <group key={y}>
        <Block position={[side * 6.35, y, -7.49]} size={[2.95, 0.015, 0.014]} color="#18232c" />
        <Block position={[side * 6.35, y + 0.08, -7.474]} size={[0.6, 0.022, 0.028]} color="#849099" metalness={0.8} />
      </group>)}
      <Block position={[side * 6.35, 2.05, -8.87]} size={[3.1, 1.5, 0.03]} color="#1e2c37" />
      {[-1.2, -0.6, 0, 0.6, 1.2].map(dx => <Block key={dx} position={[side * 6.35 + dx, 2.05, -8.845]} size={[0.008, 1.32, 0.008]} color="#34444f" />)}
      <Strip position={[side * 6.35, 2.86, -8.83]} size={[3.1, 0.06, 0.035]} color={side < 0 ? "#45a6dc" : "#d7924a"} />
      <Strip position={[side * 6.35, 1.22, -8.83]} size={[3.1, 0.08, 0.035]} color={side < 0 ? "#45a6dc" : "#d7924a"} />
      <Strip position={[side * 4.7, 1.64, -8.84]} size={[0.08, 2.05, 0.035]} color={side < 0 ? "#45a6dc" : "#d7924a"} />
      {/* Low parking guides give a scale cue without a bright runway under the car. */}
      {[-3.4, 3.4].map(z => <Block key={z} position={[side * 2.25, -0.01, z]} size={[0.32, 0.004, 0.035]} color="#74828a" roughness={0.9} />)}
      <Block position={[side * 2.4, -0.01, 0]} size={[0.012, 0.004, 6.8]} color="#3c474e" roughness={0.95} />
    </group>)}
    {[-6, -3, 0, 3, 6, 9].map(z => <Block key={`roof-${z}`} position={[0, 6.06, z]} size={[18, 0.16, 0.14]} color="#27323c" />)}
    {/* Turning the light rig preserves the relation between visible panels and reflections. */}
    <group rotation={[0, lightAngle * Math.PI / 180, 0]} name="E39_SOFTBOX_RIG">
      {garagePanels.map(panel => <Block key={`suspension-${panel.name}`} position={[panel.position[0], (6.03 + panel.position[1]) / 2, panel.position[2]]} size={[0.025, 6.03 - panel.position[1], 0.025]} color="#3b4650" metalness={0.7} />)}
      {garagePanels.map(panel => <group key={panel.name} name={`E39_SOFTBOX_${panel.name}`} position={panel.position} rotation={panelRotation(panel)}>
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[panel.width + 0.1, panel.height + 0.1, 0.1]} />
          <meshStandardMaterial color="#18232b" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh name={`E39_EMITTER_${panel.name}`} userData={{ garageEmitter: true }} position={[0, 0, 0.018]}>
          <planeGeometry args={[panel.width, panel.height]} />
          <meshStandardMaterial color={panel.color} emissive={panel.color} emissiveIntensity={1.5} roughness={0.4} />
        </mesh>
      </group>)}
    </group>
  </group>;
});
