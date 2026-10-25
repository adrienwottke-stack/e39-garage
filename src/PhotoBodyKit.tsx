import { useEffect, useMemo } from "react";
import * as T from "three";
import { RoundedBox } from "@react-three/drei";
import type { Look } from "./studio-domain";
import { createVehiclePaint } from './vehicle-paint';
import PhotoRearDiffuser from './PhotoRearDiffuser';
import { frontBumpers, rearBumpers, type FrontSpec, type RearSpec } from "./tuning-parts";
import { aperture, frontStudyShapes, rearStudyShapes, studyPanelGeometry, rearReturnGeometry, intakeGrilleGeometry, exhaustCenters, studyExhaustGeometry, diffuserFinGeometry, rearSurfaceZ } from "./tuning-parts-geometry";
import { frontReturnGeometry, frontSurfaceZ, FRONT_PLATE_HOLDER_Z, FRONT_PLATE_FACE_Z } from "./bumper-geometry";

function Paint({ look }: { look: Look }) {
  const material=useMemo(()=>createVehiclePaint(look.paint,look.finish,T.DoubleSide),[look.paint,look.finish]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <primitive object={material} attach="material" />;
}
function Panel({ shape, look, rear = false, offset = 0, paint = false, color = "#151c22", depth = .055 }: {
  shape: T.Shape; look: Look; rear?: boolean; offset?: number; paint?: boolean; color?: string; depth?: number;
}) {
  const geometry = useMemo(() => studyPanelGeometry(shape, rear, depth, offset), [shape, rear, depth, offset]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow>{paint ? <Paint look={look} /> : <meshStandardMaterial color={color} metalness={.08} roughness={.62} side={T.DoubleSide} />}</mesh>;
}
function Return({ side, look, rear = false }: { side: number; look: Look; rear?: boolean }) {
  const geometry = useMemo(() => rear ? rearReturnGeometry(side) : frontReturnGeometry(side), [side, rear]);
  const strip = useMemo(() => !rear ? frontReturnGeometry(side, .451, .492, .003) : null, [side, rear]);
  useEffect(() => () => { geometry.dispose(); strip?.dispose(); }, [geometry, strip]);
  return <><mesh geometry={geometry} castShadow receiveShadow><Paint look={look} /></mesh>{strip && <mesh geometry={strip}><meshStandardMaterial color="#20262b" roughness={.63} side={T.DoubleSide} /></mesh>}</>;
}
function Grille({ shape, pattern }: { shape: T.Shape; pattern: FrontSpec["grille"] }) {
  const geometry = useMemo(() => intakeGrilleGeometry(shape, pattern), [shape, pattern]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color="#34404a" metalness={.45} roughness={.65} side={T.DoubleSide} /></mesh>;
}
function FrontStudy({ spec, look }: { spec: FrontSpec; look: Look }) {
  const shapes = useMemo(() => frontStudyShapes(spec), [spec]);
  const lip = useMemo(() => aperture(1.69, .022, .141, -.015, .008), []);
  const strips = useMemo(() => [-1, 1].map(side => aperture(.547, .041, .451, 0, .012, side * .5435)), []);
  return <group name={`E39_STUDY_FRONT_${spec.id}`}>
    <Panel shape={shapes.shell} look={look} paint />
    {[-1, 1].map(side => <Return key={side} side={side} look={look} />)}
    <Panel shape={shapes.mouth} look={look} offset={-.05} color="#080d11" depth={.012} />
    <Grille shape={shapes.mouth} pattern={spec.grille} />
    {Array.from({ length: spec.dividers }, (_, i) => {
      const x = spec.width * ((i + 1) / (spec.dividers + 1) - .5);
      return <mesh key={i} position={[x, spec.bottom + spec.height / 2, frontSurfaceZ(x, spec.bottom + spec.height / 2) - .003]} castShadow><boxGeometry args={[spec.dividers === 1 ? .024 : .012, spec.height - .012, .047]} /><Paint look={look} /></mesh>;
    })}
    {shapes.vents.map((shape, i) => {
      const points = shape.getPoints(24), box = new T.Box2().setFromPoints(points), x = (box.min.x + box.max.x) / 2, y = (box.min.y + box.max.y) / 2;
      return <group key={i}><Panel shape={shape} look={look} offset={-.045} color="#090f14" depth={.014} />
        {spec.vent === "round" ? <group position={[x, y, frontSurfaceZ(x, y) - .025]} rotation={[0, -Math.sign(x) * .32, 0]}>
          <mesh><torusGeometry args={[Math.min(spec.ventHeight * .36, .048), .005, 12, 40]} /><meshStandardMaterial color="#747e84" metalness={.85} roughness={.25} /></mesh>
          <mesh scale={[1, 1, .24]} position={[0, 0, -.006]}><sphereGeometry args={[Math.min(spec.ventHeight * .32, .043), 24, 16]} /><meshPhysicalMaterial color="#66737b" metalness={.65} roughness={.08} clearcoat={1} emissive={look.lights ? "#fff3d2" : "#000000"} emissiveIntensity={look.lights ? 1.8 : 0} /></mesh>
        </group> : <Grille shape={shape} pattern={spec.vent === "duct" ? "vertical" : "horizontal"} />}
      </group>;
    })}
    {strips.map((shape, i) => <Panel key={i} shape={shape} look={look} offset={.003} color="#20262b" depth={.012} />)}
    {spec.lip > 0 && <Panel shape={lip} look={look} offset={spec.lip} color="#151c23" depth={.09} />}
  </group>;
}
function Exhausts({ spec }: { spec: RearSpec }) {
  const geometry = useMemo(studyExhaustGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>{exhaustCenters(spec.exhaust).map(x => <group key={x} position={[x, .239, rearSurfaceZ(x, .239) - .07]}>
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow><meshStandardMaterial color="#87929a" metalness={.96} roughness={.21} side={T.DoubleSide} /></mesh>
    <mesh position={[0, 0, .12]} rotation={[0, Math.PI, 0]}><circleGeometry args={[.033, 32]} /><meshStandardMaterial color="#050709" roughness={1} /></mesh>
  </group>)}</>;
}
function Fin({ x, spec }: { x: number; spec: RearSpec }) {
  const geometry = useMemo(() => diffuserFinGeometry(x, spec), [x, spec]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color="#1c252d" roughness={.49} metalness={.16} /></mesh>;
}
function RearStudy({ spec, look }: { spec: RearSpec; look: Look }) {
  const shapes = useMemo(() => rearStudyShapes(spec), [spec]);
  const strips = useMemo(() => [-1, 1].map(side => aperture(.57, .049, .51, 0, .012, side * .55)), []);
  const lip = useMemo(() => aperture(1.68, .021, .143, .02, .008), []);
  return <group name={`E39_STUDY_REAR_${spec.id}`}>
    {spec.id !== "photo" && <><Panel shape={shapes.shell} look={look} paint rear />{[-1, 1].map(side => <Return key={side} side={side} look={look} rear />)}
      {strips.map((shape, i) => <Panel key={i} shape={shape} look={look} rear color="#20262b" offset={.004} depth={.012} />)}
      {shapes.vents.map((shape, i) => <Panel key={i} shape={shape} look={look} rear color="#090f14" offset={-.032} depth={.012} />)}
    </>}
    <Panel shape={shapes.mouth} look={look} rear color="#182128" offset={spec.id === "photo" ? .014 : -.018} depth={.025} />
    {Array.from({ length: spec.fins }, (_, i) => <Fin key={i} x={spec.width * .56 * ((i + 1) / (spec.fins + 1) - .5)} spec={spec} />)}
    {spec.lip > 0 && <Panel shape={lip} look={look} rear offset={spec.lip} color="#141b21" depth={.07} />}
    <Exhausts spec={spec} />
  </group>;
}
export default function PhotoBodyKit({ look, onSelect, modelFront = false }: { look: Look; onSelect: () => void; modelFront?: boolean }) {
  const frontSpec = frontBumpers.find(p => p.id === look.frontBumper)!;
  const rearSpec = rearBumpers.find(p => p.id === look.rearBumper)!;
  const lip = useMemo(() => aperture(1.68, .022, .141, -.015, .008), []);
  const plate = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 112;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#e5e8e7"; ctx.fillRect(0, 0, 512, 112);
    ctx.fillStyle = "#1d4d8c"; ctx.fillRect(8, 7, 32, 98); ctx.fillStyle = "#17202a"; ctx.font = "bold 76px Arial"; ctx.textAlign = "center"; ctx.fillText("E39 530i", 282, 85);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
  }, []);
  useEffect(() => () => plate.dispose(), [plate]);
  return <group onClick={event => { event.stopPropagation(); onSelect(); }}>
    {look.frontBumper !== "standard" && !(look.frontBumper === "photo" && modelFront) && <FrontStudy spec={frontSpec} look={look} />}
    {look.frontBumper !== "standard" && <>
      <RoundedBox name="E39_NEUTRAL_FRONT_PLATE_HOLDER" args={[.493, .114, .022]} radius={.004} position={[0, .428, FRONT_PLATE_HOLDER_Z]}><meshStandardMaterial color="#171d22" roughness={.45} /></RoundedBox>
      <mesh name="E39_NEUTRAL_FRONT_PLATE" position={[0, .428, FRONT_PLATE_FACE_Z]}><planeGeometry args={[.47, .1]} /><meshStandardMaterial map={plate} roughness={.6} /></mesh>
    </>}
    {look.rearBumper === "photo" ? <PhotoRearDiffuser /> : look.rearBumper !== "standard" && <RearStudy spec={rearSpec} look={look} />}
    <mesh position={[0, .779, -2.545]} rotation={[0, Math.PI, 0]}><planeGeometry args={[.46, .1]} /><meshStandardMaterial map={plate} roughness={.6} /></mesh>
    {look.frontLip && <Panel shape={lip} offset={.052} color="#151b20" look={look} depth={.105} />}
    {look.sideSkirts && [-1, 1].map(side => <RoundedBox key={side} args={[.074, .047, 2.02]} radius={.013} position={[side * .867, .148, -.08]}><meshStandardMaterial color="#171f27" metalness={.12} roughness={.43} /></RoundedBox>)}
  </group>;
}
