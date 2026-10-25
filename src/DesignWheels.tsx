// Bewusste 0.9-Aussenbasis: urspruengliche Foto-Raeder und Reifen bleiben erhalten.
import { useEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { wheelFinishes, type Look } from "./studio-domain";
import { createRoundel } from "./car-surfaces";
import { tireProfile, visualTireRadius } from "./wheel-geometry-09";
import { wheelDesigns } from "./tuning-parts";
import { wheelSpokeGeometry, wheelBoltGeometry } from "./tuning-parts-geometry";

function Tread() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 64; i++) {
      const angle = (i * Math.PI * 2) / 64;
      dummy.position.set(Math.sin(angle) * 0.307, Math.cos(angle) * 0.307, 0);
      dummy.rotation.set(0, 0, -angle + 0.25);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 64]} castShadow>
      <boxGeometry args={[0.004, 0.001, 0.15]} />
      <meshStandardMaterial color="#25282b" roughness={0.94} />
    </instancedMesh>
  );
}
function Wheel({
  look,
  side,
  z,
  onSelect,
  roundel,
}: {
  look: Look;
  side: number;
  z: number;
  onSelect: () => void;
  roundel: THREE.Texture;
}) {
  const { invalidate } = useThree();
  const radius = (look.wheelSize * 0.0254) / 2;
  const design = wheelDesigns.find(d => d.id === look.wheelStyle)!;
  const geometry = useMemo(() => wheelSpokeGeometry(design, radius), [design, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const bolts = useMemo(() => design.bolts ? wheelBoltGeometry(radius) : null, [design, radius]);
  useEffect(() => () => bolts?.dispose(), [bolts]);
  const tire = useMemo(() => tireProfile(radius), [radius]);
  const spokes = design.profile === "disc" || design.profile === "slot" ? 1 : design.spokes;
  const color = wheelFinishes[look.wheelFinish];
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  return (
    <group
      position={[side * 0.79, visualTireRadius, z]}
      rotation={[0, (side * Math.PI) / 2, 0]}
      onClick={click}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
        invalidate();
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <latheGeometry args={[tire, 96]} />
        <meshStandardMaterial color="#1c1d1e" roughness={0.86} />
      </mesh>
      <Tread />
      {[0.284, 0.291, 0.298].map((r) => (
        <mesh key={r} position={[0, 0, 0.098]}>
          <torusGeometry args={[r, 0.00045, 5, 96]} />
          <meshStandardMaterial color="#202224" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.145, 64, 1, true]} />
        <meshStandardMaterial
          color="#424950"
          metalness={0.9}
          roughness={0.32}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.164, 0.164, 0.012, 64]} />
        <meshStandardMaterial
          color="#62666a"
          metalness={0.85}
          roughness={0.56}
        />
      </mesh>
      <mesh position={[0.129, 0.032, 0.046]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.05, 0.115, 0.035]} />
        <meshStandardMaterial
          color={
            look.caliper === "red"
              ? "#a22324"
              : look.caliper === "blue"
                ? "#2550ab"
                : "#343a41"
          }
          metalness={0.35}
          roughness={0.35}
        />
      </mesh>
      {[radius - 0.002, radius - 0.013].map((r, i) => (
        <mesh key={i} position={[0, 0, 0.095]}>
          <torusGeometry args={[r, i ? 0.002 : 0.004, 8, 64]} />
          <meshStandardMaterial
            color={color}
            metalness={0.92}
            roughness={0.29}
          />
        </mesh>
      ))}
      {Array.from({ length: spokes }, (_, i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI * 2) / spokes]}>
          {(design.split === 2 && design.profile !== "photo" ? [-1, 1] : [0]).map((split) => (
            <mesh
              key={split}
              geometry={geometry}
              scale={[split < 0 ? -1 : 1, 1, 1]}
              position={[split * (design.profile === "y" ? .001 : .006), 0, 0]}
              rotation={[
                0,
                0,
                split * (design.profile === "mesh" ? .15 : design.profile === "y" ? .09 : .045),
              ]}
              castShadow
            >
              <meshStandardMaterial
                color={color}
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
          ))}
        </group>
      ))}
      {bolts && <mesh geometry={bolts}><meshStandardMaterial color="#d2d6d8" metalness={.93} roughness={.22} /></mesh>}
      <mesh position={[0, 0, 0.058]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.058, 0.069, 0.022, 64]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.24} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <group
          key={i}
          position={[
            Math.sin((i * Math.PI * 2) / 5) * 0.059,
            Math.cos((i * Math.PI * 2) / 5) * 0.059,
            0.073,
          ]}
        >
          <mesh><circleGeometry args={[0.0105, 24]} /><meshStandardMaterial color="#1b1e21" roughness={0.6} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0,0,-0.004]}>
            <cylinderGeometry args={[0.0065, 0.0065, 0.005, 6]} />
            <meshStandardMaterial color="#666a6c" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, 0.071]}>
        <circleGeometry args={[0.022, 32]} />
        <meshStandardMaterial
          map={roundel}
          color="#ffffff"
          metalness={0.3}
          roughness={0.22}
        />
      </mesh>
      <mesh
        position={[radius * 0.56, radius * 0.72, 0.1]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.004, 0.004, 0.017, 8]} />
        <meshStandardMaterial color="#15191d" />
      </mesh>
    </group>
  );
}
export default function DesignWheels({
  look,
  onSelect,
}: {
  look: Look;
  onSelect: () => void;
}) {
  const roundel = useMemo(createRoundel, []);
  useEffect(() => () => roundel.dispose(), [roundel]);
  return (
    <group>
      {[-1, 1].flatMap((side) =>
        [-1.495, 1.35].map((z) => (
          <Wheel
            key={side + ":" + z}
            look={look}
            side={side}
            z={z}
            onSelect={onSelect}
            roundel={roundel}
          />
        )),
      )}
    </group>
  );
}
