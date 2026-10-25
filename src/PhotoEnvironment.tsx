import { Environment, Lightformer } from "@react-three/drei";
import { memo, useEffect, useMemo } from "react";
import { garagePanels, garageRoom, panelRotation } from "./garage-environment";
import { automotiveLighting, automotivePanelIntensity, createSoftboxProfile } from "./automotive-lighting";

// Keep the existing component contract. Reflection capture now uses the bay's
// own rectangular diffusers and neutral walls, without a photo panorama.
export default memo(function PhotoEnvironment({ angle }: { angle: number }) {
  const profile = useMemo(() => createSoftboxProfile(), []);
  useEffect(() => () => profile.dispose(), [profile]);
  return <Environment resolution={automotiveLighting.reflectionResolution} frames={1} key={angle} environmentIntensity={automotiveLighting.environmentIntensity}>
    <color attach="background" args={["#3c4750"]} />
    <mesh position={[0, 3, -9]}>
      <boxGeometry args={[18, 6, 0.1]} />
      <meshBasicMaterial color={garageRoom.wall} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 9, 3, 0]}>
      <boxGeometry args={[0.1, 6, 20]} />
      <meshBasicMaterial color="#35414b" />
    </mesh>)}
    <group rotation={[0, angle, 0]}>
      {garagePanels.map(panel => <Lightformer key={panel.name} form="rect" map={profile} position={panel.position} rotation={panelRotation(panel)} scale={[panel.width, panel.height, 1]} color={panel.color} intensity={automotivePanelIntensity(panel.name, panel.reflection)} />)}
    </group>
    <Lightformer form="rect" position={[-3.05, 2.5, -8.8]} scale={[0.06, 4.2, 1]} color="#68b8eb" intensity={1.3} />
    <Lightformer form="rect" position={[3.05, 2.5, -8.8]} scale={[0.06, 4.2, 1]} color="#e8aa66" intensity={1.3} />
  </Environment>;
});
