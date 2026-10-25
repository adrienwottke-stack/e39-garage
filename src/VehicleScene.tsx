import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { panelNormals } from './panel-normals';
import {createVehicleGlassMaterial,vehicleGlassKind} from './vehicle-glass';
import { PhotographicPipeline } from './photographic-pipeline';
import type { ExportBlender } from './export-blender';
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { componentById, type ComponentId } from "./components-data";
import { MODEL_URL } from "./model-version";
import PhotoInterior from "./PhotoInterior";
import PhotoBodyKit from "./PhotoBodyKit";
import PhotoHeadlights from './PhotoHeadlights';
import EngineBay,{HoodInsulation} from './EngineBay';
import {fairVehicleSkin,vehicleBodyOffset} from './vehicle-panels';
import {fitVehicleCamera} from './vehicle-camera';
import {createCabinSurfaceMaps,disposeCabinSurfaceMaps,createCabinMaterial,createCabinGeometry,shouldReplaceCabinNode} from './cabin-materials';
import {updateVehicleCabin,createVehicleCabinPatterns} from './vehicle-cabin';
import DesignWheels from "./DesignWheels";
import { wheelFinishes, type Look, type CameraView } from "./studio-domain";
import StudioLighting from "./StudioLighting";
import {
  defaultRender,
  type Capture,
  type RenderSettings,
} from "./render-domain";
import { captureRender } from "./capture-render";
import { createRoundel, emblemGeometry } from "./car-surfaces";
import {createVehiclePaint,applyVehiclePaint} from './vehicle-paint';

type Props = {
  selected: ComponentId;
  onSelect: (id: ComponentId) => void;
  hood: boolean;
  explode: boolean;
  paint: string;
  hoodPaint: string;
  reset: number;
  look?: Look;
  cameraView?: CameraView;
  studio?: boolean;
  renderSettings?: RenderSettings;
  renderMode?: boolean;
  onCaptureReady?: (capture: Capture | null) => void;
  onExportReady?: (exporter:ExportBlender|null)=>void;
};
type SceneMotion={hood:boolean;engine:boolean};
function Car(props: Props & {motion:{current:SceneMotion}}) {
  const gltf = useGLTF(MODEL_URL);
  const { invalidate } = useThree();
  const roundel = useMemo(createRoundel, []);
  const cabinMaps = useMemo(createCabinSurfaceMaps,[]);
  const cabinPatterns=useMemo(createVehicleCabinPatterns,[]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hoodRef = useRef<THREE.Group>(null);
  const { body, hood, wheels, ownGeometry,modelFront } = useMemo(() => {
    const ownGeometry: THREE.BufferGeometry[] = [];
    const body = gltf.scene.clone(true),
      hood = new THREE.Group(),
      wheels = new THREE.Group();
    hood.position.set(0, 0.96, 0.704);
    const toMove: THREE.Object3D[] = [];
    body.traverse((o) => {
      if (/lettering/.test(o.name)) o.visible = false;
      if (shouldReplaceCabinNode(o.name))
        o.visible = false;
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const clone = (m: THREE.Material) => {
          const semantic=`${o.name} ${o.parent?.name??''}`;
          const cabinMaterial=createCabinMaterial(m,semantic,cabinMaps);
          if(cabinMaterial)return cabinMaterial;
          if (/^pab_e39_paint$/.test(m.name)) {
            const source = m as THREE.MeshStandardMaterial;
            const painted = createVehiclePaint(source.color);
            painted.name = m.name;
            return painted;
          }
          if (/glass/.test(m.name)) {
            return createVehicleGlassMaterial(vehicleGlassKind(o.name + ' ' + o.parent?.name));
          }
          if (/logo/.test(m.name)) {
            const badge = new THREE.MeshStandardMaterial({
              map: roundel,
              color: "#ffffff",
              metalness: 0.3,
              roughness: 0.24,
              side: THREE.DoubleSide,
            });
            badge.name = m.name;
            return badge;
          }
          const clone = m.clone() as THREE.MeshStandardMaterial;
          if (typeof clone.metalness === "number")
            clone.metalness = Math.min(1, clone.metalness);
          if (/red$/.test(m.name)) {
            clone.roughness = 0.22;
            clone.metalness = 0.18;
          }
          return clone;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(clone)
          : clone(o.material);
        const semantic=`${o.name} ${o.parent?.name??''}`;
        const mapped=createCabinGeometry(o.geometry,semantic);
        if(mapped){o.geometry=mapped;ownGeometry.push(mapped);}
        // The source sunroof subframe floated below the roof when entered.
        // Replace only that isolated shallow primitive with the continuous liner.
        if(/pab_e39_int(?:\s|$)/.test(semantic)) {
          o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!;
          if(b.min.y>1.22&&b.max.y<1.29&&b.min.z< -1.30&&b.max.z<.2)o.visible=false;
        }
        if (
          (Array.isArray(o.material) ? o.material : [o.material]).some((m) =>
            /^pab_e39_paint$/.test(m.name),
          )
        ) {
          // Smooth across coincident panel vertices while retaining hard creases.
          const panel=/pab_e39_hood/.test(semantic)?'hood':/pab_e39_fender_[LR]/.test(semantic)?'fender':null;
          if(panel){o.geometry=fairVehicleSkin(o.geometry,panel);ownGeometry.push(o.geometry);}
          else {o.geometry=panelNormals(o.geometry);ownGeometry.push(o.geometry);}
        }
        if (
          (Array.isArray(o.material) ? o.material : [o.material]).some((m) =>
            /logo/.test(m.name),
          )
        ) {
          o.geometry = emblemGeometry(o.geometry, o.name + o.parent?.name);
          ownGeometry.push(o.geometry);
        }
      }
      if (/pab_e39_hood$|pab_e39_grille$/.test(o.name)) toMove.push(o);
      if (
        o.userData.component === "wheels" ||
        o.userData.component === "brakes"
      )
        toMove.push(o);
    });
    for (const n of toMove) {
      n.removeFromParent();
      if (
        n.userData.component === "wheels" ||
        n.userData.component === "brakes"
      ) {
        wheels.add(n);
        // The source tire was undersized (292 mm). Match the 308 mm design tire
        // and move its centre up by the same 16 mm: contact remains exactly y=0.
        n.position.y+=.016;
        if(n.name==='wheel-tire')n.scale.set(1,.308/.292,.308/.292);
        continue;
      }
      n.position.sub(hood.position);
      hood.add(n);
    }
    return { body, hood, wheels, ownGeometry,modelFront:!!body.getObjectByName('pab_e39_bumper_F_m-tech') };
  }, [gltf.scene, roundel,cabinMaps]);
  useEffect(()=>{
    // Demand rendering can mount the loaded model after its first invalidation.
    // Two finite follow-up frames also finish texture upload and shadow warmup.
    invalidate();
    let second=0;
    const first=requestAnimationFrame(()=>{invalidate();second=requestAnimationFrame(()=>invalidate());});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[body,invalidate]);
  useEffect(() => {
    for (const [root, color] of [
      [body, props.look?.paint ?? props.paint],
      [hood, props.look?.hoodPaint ?? props.hoodPaint],
    ] as const)
      root.traverse((o) => {
        if (/^pab_e39_headlight_[LR](?:$|_late\.00[12]$)/.test(o.name)) o.visible = !props.look;
        if (/^pab_e39_bumper_F_m-tech(?:$|_)/.test(o.name))
          o.visible = props.look?.frontBumper === "photo";
        else if (/^pab_e39_bumper_F/.test(o.name))
          o.visible = !props.look || props.look.frontBumper === "standard";
        if (/^pab_e39_bumper_R/.test(o.name)) o.visible = !props.look||props.look.rearBumper==='photo'||props.look.rearBumper==='standard';
        if (/^pab_e39_exhaust/.test(o.name))
          o.visible = !props.look||props.look.rearBumper === "standard";
        if (/spoiler_lip/.test(o.name))
          o.visible = props.look?.spoiler === "lip";
        if (/spoiler_ducktail/.test(o.name))
          o.visible = props.look?.spoiler === "ducktail";
        if (o instanceof THREE.Mesh)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (m) => {
              const material = m as THREE.MeshPhysicalMaterial;
              if (/^pab_e39_paint$/.test(m.name)) {
                const paintColor=(
                  /mirror_[LR]/.test(o.name + o.parent?.name) &&
                    props.look?.mirrors === "black"
                    ? "#151b20"
                    : color
                );
                applyVehiclePaint(material,paintColor,props.look?.finish);
              }
              if (/int_trim/.test(m.name))
                material.color.set(
                  props.look?.interiorTrim === "dark" ? "#242a30" : "#b6bec6",
                );
              if (/alcantara|cloth07|leather2/.test(m.name))
                material.color.set(
                  props.look?.upholstery === "cognac"
                    ? "#79492e"
                    : /leather/.test(m.name)
                      ? "#171b20"
                      : "#303238",
                );
              if (/chrome/.test(m.name)) {
                material.color.set(
                  props.look?.trim === "black" ? "#13171b" : "#d1d5d8",
                );
                material.metalness = props.look?.trim === "black" ? 0.15 : 0.95;
                material.roughness = props.look?.trim === "black" ? 0.35 : 0.18;
              }
              if (
                /highbeam|lowbeam|running|fog1/.test(m.name) &&
                material.emissive
              ) {
                material.emissive.set(
                  props.look?.lights ? "#e9f2ff" : "#30302c",
                );
                material.emissiveIntensity = props.look?.lights ? 1.8 : 0;
              }
              updateVehicleCabin(material,`${o.name} ${o.parent?.name??''}`,props.look,cabinPatterns);
            },
          );
      });
    wheels.traverse((o) => {
      if (o.name === "wheel-rim") {
        const scale = ((props.look?.wheelSize ?? 17) * 0.0254) / 2 / 0.22;
        o.scale.set(1, scale, scale);
      }
      if (o instanceof THREE.Mesh)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (/chrome/.test(m.name))
            (m as THREE.MeshStandardMaterial).color.set(
              wheelFinishes[props.look?.wheelFinish ?? "silver"],
            );
          if (/caliper/.test(o.name))
            (m as THREE.MeshStandardMaterial).color.set(
              props.look?.caliper === "red"
                ? "#a22324"
                : props.look?.caliper === "blue"
                  ? "#2550ab"
                  : "#343a41",
            );
        });
    });
    invalidate();
  }, [
    body,
    hood,
    wheels,
    props.paint,
    props.hoodPaint,
    props.look,
    cabinPatterns,
    invalidate,
  ]);
  useEffect(
    () => () => {
      for (const root of [body, hood, wheels])
        root.traverse((o) => {
          if (o instanceof THREE.Mesh)
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => m.dispose(),
            );
        });
      ownGeometry.forEach((g) => g.dispose());
      roundel.dispose();
      disposeCabinSurfaceMaps(cabinMaps);
      Object.values(cabinPatterns).forEach(map=>map.dispose());
    },
    [body, hood, wheels, ownGeometry, roundel,cabinMaps,cabinPatterns],
  );
  useFrame((_, dt) => {
    if (hoodRef.current) {
      const target = props.hood ? -1.17 : 0;
      hoodRef.current.rotation.x = reduced
        ? target
        : THREE.MathUtils.damp(
            hoodRef.current.rotation.x,
            target,
            6,
            Math.min(dt, 0.04),
          );
      props.motion.current.hood=Math.abs(hoodRef.current.rotation.x-target)>.001;
      if(props.motion.current.hood)invalidate();
      else hoodRef.current.rotation.x=target;
    }
  });
  const select = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    let object: THREE.Object3D | null = e.object;
    while (object && !object.userData.component) object = object.parent;
    props.onSelect((object?.userData.component ?? "body") as ComponentId);
  };
  return (
    <group>
      <group position={[0, vehicleBodyOffset(props.look?.lowering), 0]}>
        <primitive object={body} onClick={select} />
        <group ref={hoodRef} position={[0, 0.96, 0.704]}>
          <primitive object={hood} position={[0, 0, 0]} onClick={select} />
          <HoodInsulation />
        </group>
        <EngineBay {...props} onMotion={moving=>{props.motion.current.engine=moving;}} />
        {props.look && <PhotoInterior look={props.look} />}
        {props.look && <PhotoHeadlights look={props.look} />}
        {props.look && (
          <PhotoBodyKit
            look={props.look}
            modelFront={modelFront}
            onSelect={() => props.onSelect("body")}
          />
        )}
      </group>
      {props.look && props.look.wheelStyle !== "reference" ? (
        <DesignWheels
          look={props.look}
          onSelect={() => props.onSelect("wheels")}
        />
      ) : (
        <primitive object={wheels} onClick={select} />
      )}
    </group>
  );
}
function Scene(props: Props) {
  const controls = useRef<OrbitControlsType>(null);
  const animating=useRef(true),motion=useRef<SceneMotion>({hood:false,engine:false});
  const { camera, invalidate, gl, scene, size } = useThree();
  const settleMotion=useCallback(async()=>{
    for(let i=0;i<180&&(animating.current||motion.current.hood||motion.current.engine);i++){
      invalidate();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    if(animating.current||motion.current.hood||motion.current.engine)throw new Error('Die Ansicht bewegt sich noch. Versuche den Export erneut.');
  },[invalidate]);
  useEffect(()=>{
    props.onExportReady?.(async settings=>{
      await settleMotion();
      const {exportBlender}=await import('./export-blender');
      return exportBlender(scene,camera,settings);
    });
    return ()=>props.onExportReady?.(null);
  },[scene,camera,props.onExportReady,settleMotion]);
  const pipeline=useMemo(()=>new PhotographicPipeline(gl,scene,camera),[gl,scene,camera]);
  useEffect(()=>()=>pipeline.dispose(),[pipeline]);
  useFrame(()=>{
    const pixels=gl.getDrawingBufferSize(new THREE.Vector2());
    pipeline.render(pixels.x,pixels.y);
  },1);
  useEffect(() => {
    props.onCaptureReady?.(async (options) => {
      await settleMotion();
      return captureRender(gl, scene, camera, options, (width,height)=>pipeline.render(width,height));
    });
    return () => props.onCaptureReady?.(null);
  }, [gl, scene, camera, props.onCaptureReady, settleMotion, pipeline]);
  const focal = props.renderMode ? (props.renderSettings?.focal ?? 50) : 50;
  const desired = useRef(new THREE.Vector3(5, 2.8, 6));
  const target = useRef(new THREE.Vector3(0, 0.6, 0));
  const desiredFov=useRef(36);
  const engine = props.hood,
    detail = props.selected === "oil-filter" && props.explode;
  useEffect(() => {
    const poses: Record<CameraView, [number, number, number]> = {
      front: [2.7, 1.25, 3.4],
      side: [4.9, 1.1, 0],
      rear: [2.7, 1.25, -3.4],
      wheel: [2.35, 0.85, 2.8],
      interior: [0.38, 1.065, -0.25],
      engine: [1.65, 2.45, 3.1],
    };
    desired.current.set(
      ...((detail
        ? [1.25, 1.8, 3.05]
        : engine
          ? [1.65, 2.45, 3.1]
          : props.cameraView
            ? poses[props.cameraView]
            : [5, 2.6, 6]) as [number, number, number]),
    );
    target.current.set(
      ...((detail
        ? [0.19, 0.82, 1.66]
        : engine
          ? [0, 0.6, 1]
          : props.cameraView === "interior"
            ? [0.20, 0.81, 0.48]
            : props.cameraView === "wheel"
              ? [0.79, 0.36, 1.35]
              : [0, 0.6, -0.15]) as [number, number, number]),
    );
    let lensFit = 1;
    if (camera instanceof THREE.PerspectiveCamera) {
      desiredFov.current =
        props.cameraView === "interior"
          ? 65
          : props.studio
            ? THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * focal)))
            : 36;
      lensFit =
        props.cameraView === "interior"
          ? 1
          : props.studio
            ? Math.tan(THREE.MathUtils.degToRad(18)) /
              Math.tan(THREE.MathUtils.degToRad(desiredFov.current / 2))
            : 1;
      camera.near=.012;camera.updateProjectionMatrix();
    }
    const exterior=!engine&&!detail&&props.cameraView!=='interior'&&props.cameraView!=='wheel'&&props.cameraView!=='engine';
    if(exterior)desired.current.copy(fitVehicleCamera(desired.current,target.current,desiredFov.current,size.width/size.height));
    else desired.current.sub(target.current).multiplyScalar(lensFit).add(target.current);
    animating.current = true;
    invalidate();
  }, [
    engine,
    detail,
    props.reset,
    props.cameraView,
    invalidate,
    size.width,
    size.height,
    focal,
    props.studio,
    camera,
  ]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame((_, dt) => {
    if (!animating.current || !controls.current) return;
    const amount = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.04) * 5);
    camera.position.lerp(desired.current, amount);
    controls.current.target.lerp(target.current, amount);
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov.current,amount);camera.updateProjectionMatrix();}
    controls.current.update();
    if (camera.position.distanceTo(desired.current) < 0.008&&controls.current.target.distanceTo(target.current)<.008&&(!(camera instanceof THREE.PerspectiveCamera)||Math.abs(camera.fov-desiredFov.current)<.03)){
      camera.position.copy(desired.current);controls.current.target.copy(target.current);controls.current.update();
      if(camera instanceof THREE.PerspectiveCamera){camera.fov=desiredFov.current;camera.updateProjectionMatrix();}
      animating.current = false;
    }
    else invalidate();
  });
  return (
    <>
      {props.studio ? (
        <StudioLighting
          settings={props.renderSettings ?? defaultRender()}
          shadowKey={`${props.look?.lowering ?? 0}:${props.look?.wheelStyle}:${props.renderSettings?.environment}`}
        />
      ) : (
        <>
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[3, 7, 5]}
            intensity={3}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
            shadow-bias={-0.001}
          />
          <Environment resolution={128}>
            <Lightformer
              form="rect"
              intensity={5}
              color="#d4e7f7"
              scale={[10, 4, 1]}
              position={[0, 4, 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
            <Lightformer
              form="rect"
              intensity={3}
              scale={[1, 3, 9]}
              position={[-4, 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
            />
            <Lightformer
              form="rect"
              color="#7cafd4"
              intensity={4}
              scale={[1, 2, 9]}
              position={[4, 2, 0]}
              rotation={[0, -Math.PI / 2, 0]}
            />
          </Environment>
        </>
      )}
      <Car {...props} motion={motion} />
      {!props.studio && (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.005, 0]}
            receiveShadow
          >
            <planeGeometry args={[200, 200]} />
            <shadowMaterial opacity={0.25} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.009, 0]}>
            <ringGeometry args={[3.2, 3.212, 120]} />
            <meshBasicMaterial color="#36424d" transparent opacity={0.45} />
          </mesh>
        </>
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan
        minDistance={0.08}
        maxDistance={80}
        maxPolarAngle={Math.PI*.98}
        enableDamping
        dampingFactor={.075}
        rotateSpeed={.65}
        panSpeed={.65}
        onStart={() => {
          animating.current = false;
        }}
      />
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function VehicleScene(props: Props) {
  const [failed, setFailed] = useState(false);
  const loading = useProgress((state) => state.active);
  return (
    <div className="scene-canvas" aria-label="Drehbare 3D-Ansicht des BMW E39">
      <SceneBoundary onError={() => setFailed(true)}>
        <Canvas
          frameloop="demand"
          shadows
          dpr={[1.5, 2]}
          camera={{ position: [5, 2.6, 6], fov: 36,near:.012 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          fallback={
            <div aria-hidden="true">
              Die 3D-Ansicht benötigt WebGL. Alle Fahrzeugdaten bleiben über die
              Bauteilliste erreichbar.
            </div>
          }
        >
          <Suspense fallback={null}>
            <Scene {...props} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
      {loading && !failed && (
        <div className="model-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          E39 wird geladen …
        </div>
      )}
      {failed && (
        <div className="scene-fallback">
          Das 3D-Modell konnte nicht geladen werden. Du kannst alle Funktionen
          über die Bauteilliste weiter nutzen.
        </div>
      )}
      <span className="sr-only">
        Ausgewählt: {componentById(props.selected).name}. Teile können auch über
        die Schaltflächen ausgewählt werden.
      </span>
    </div>
  );
}
useGLTF.preload(MODEL_URL);
