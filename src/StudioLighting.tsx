import { memo, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { environments, type RenderSettings } from "./render-domain";
import PhotoEnvironment from "./PhotoEnvironment";
import Workshop from "./Workshop";
import GarageFloor from "./GarageFloor";
import { concreteTexture } from "./floor-surface";
import { garageRoom } from "./garage-environment";
import { automotiveLighting, configureAutomotiveRenderer } from "./automotive-lighting";

export default memo(function StudioLighting({ settings, shadowKey }: { settings: RenderSettings; shadowKey: string }) {
  const { gl, invalidate } = useThree();
  const concrete = useMemo(concreteTexture, []);
  useEffect(() => () => concrete.dispose(), [concrete]);
  const env = environments.find(e => e.id === settings.environment)!;
  const workshop = settings.environment === "workshop";
  const angle = settings.lightAngle * Math.PI / 180;
  const keyTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 0.45, 0);
    return target;
  }, []);
  useEffect(() => {
    const restore = configureAutomotiveRenderer(gl, settings.exposure);
    invalidate();
    return restore;
  }, [gl, settings.exposure, invalidate]);
  useEffect(() => {
    // A finite warm-up also covers a just-mounted Suspense scene on a demand canvas.
    invalidate();
    const pending: number[] = [];
    const warm = (remaining: number) => pending.push(requestAnimationFrame(() => {
      invalidate();
      if (remaining > 1) warm(remaining - 1);
    }));
    warm(2);
    return () => pending.forEach(cancelAnimationFrame);
  }, [settings, invalidate]);
  return <>
    <color attach="background" args={[env.color]} />
    <fog attach="fog" args={[env.color, workshop ? 20 : 18, workshop ? 48 : 160]} />
    <hemisphereLight color={workshop ? "#e6ebef" : env.key} groundColor={workshop ? "#30383e" : env.floor} intensity={workshop ? automotiveLighting.hemisphereIntensity : 0.4} />
    <group rotation={[0, angle, 0]}>
      <primitive object={keyTarget} />
      <directionalLight name="E39_PREVIEW_KEY" position={workshop ? automotiveLighting.keyPosition : [3, 7, 4]} target={keyTarget} color={env.key} intensity={workshop ? automotiveLighting.keyIntensity : env.intensity} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-4.6} shadow-camera-right={4.6} shadow-camera-top={4.6} shadow-camera-bottom={-4.6}
        shadow-camera-near={0.2} shadow-camera-far={16} shadow-radius={automotiveLighting.shadowRadius} shadow-normalBias={automotiveLighting.shadowNormalBias} shadow-bias={automotiveLighting.shadowBias} shadow-intensity={automotiveLighting.shadowIntensity} />
      <directionalLight name="E39_PREVIEW_FILL" position={[5, 3, -4]} color={env.fill} intensity={workshop ? automotiveLighting.fillIntensity : 0.4} />
    </group>
    {workshop ? <>
      <Workshop lightAngle={settings.lightAngle} />
      <PhotoEnvironment angle={angle} />
    </> : <Environment resolution={256} frames={1} key={`${settings.environment}:${settings.lightAngle}`}>
      <group rotation={[0, angle, 0]}>
        <Lightformer form="rect" intensity={3.5} color={env.key} scale={[4, 3, 1]} position={[3, 4, 2]} rotation={[0, -Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={2} color={env.fill} scale={[2, 5, 1]} position={[-4, 2, -1]} rotation={[0, Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={4} color={env.key} scale={[2, 7, 1]} position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0.3]} />
        <Lightformer form="rect" intensity={2.5} color={env.fill} scale={[6, 0.6, 1]} position={[0, 2, -5]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" scale={[5, 4, 1]} position={[1, 2, 5]} rotation={[0, Math.PI, 0]} />
      </group>
    </Environment>}
    <GarageFloor color={workshop ? garageRoom.floor : env.floor} texture={workshop ? concrete : undefined} reflective={settings.reflection} size={workshop ? 48 : 180} />
    {!workshop && <ContactShadows key={`${shadowKey}:${settings.lightAngle}`} position={[0, -0.009, 0]} opacity={0.55} scale={11} blur={2.2} far={1.8} resolution={1024} frames={Infinity} color="#111820" />}
  </>;
});
