import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {RoundedBox} from '@react-three/drei';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ComponentId} from './components-data';
import {frontSurfacePoint} from './front-panels';

type Props={selected:ComponentId;onSelect:(id:ComponentId)=>void;explode:boolean;onMotion?:(moving:boolean)=>void};
function Solid({at,size,color='#242a2e',metal=.04,rough=.70,radius=.012}:{at:[number,number,number];size:[number,number,number];color?:string;metal?:number;rough?:number;radius?:number}) {
  const material=<meshStandardMaterial color={color} metalness={metal} roughness={rough} envMapIntensity={.55}/>;
  if(Math.min(...size)<.019)return <mesh position={at}><boxGeometry args={size}/>{material}</mesh>;
  return <RoundedBox position={at} args={size} radius={radius} smoothness={2} bevelSegments={2} castShadow receiveShadow>{material}</RoundedBox>;
}
function RepeatedBoxes({items,color,metal=0,rough=.8}:{items:{at:[number,number,number];size:[number,number,number];angle?:number}[];color:string;metal?:number;rough?:number}) {
  const key=JSON.stringify(items);
  const geometry=useMemo(()=>{
    const sources=items.map(item=>{const g=new T.BoxGeometry(...item.size);if(item.angle)g.rotateY(item.angle);g.translate(...item.at);return g;});
    const merged=mergeGeometries(sources)!;sources.forEach(g=>g.dispose());return merged;
  },[key]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} dispose={null}><meshStandardMaterial color={color} metalness={metal} roughness={rough}/></mesh>;
}
function Hose({points,radius=.018,color='#1e2529',metal=0}:{points:[number,number,number][];radius?:number;color?:string;metal?:number}) {
  const key=JSON.stringify(points);
  const geometry=useMemo(()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),40,radius,12,false),[key,radius]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} dispose={null} castShadow><meshStandardMaterial color={color} metalness={metal} roughness={metal?.4:.8}/></mesh>;
}
function Part({id,selected,onSelect,children}:{id:ComponentId;selected:ComponentId;onSelect:Props['onSelect'];children:ReactNode}) {
  const ref=useRef<T.Group>(null),[hover,setHover]=useState(false);
  const {invalidate}=useThree();
  useEffect(()=>{ref.current?.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if((m as T.MeshStandardMaterial).emissive){const mat=m as T.MeshStandardMaterial;mat.emissive.set(id===selected?'#143846':hover?'#0d2028':'#000000');mat.emissiveIntensity=.5;}});invalidate();},[id,selected,hover,invalidate]);
  return <group ref={ref} userData={{component:id}} onClick={e=>{e.stopPropagation();onSelect(id);}} onPointerOver={e=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHover(false);document.body.style.cursor='auto';}}>{children}</group>;
}
function coverLabel() {
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#22292d';ctx.fillRect(0,0,1024,256);
  ctx.fillStyle='#aeb1ae';ctx.font='bold 78px Arial';ctx.fillText('BMW',68,112);
  ctx.fillStyle='#8e9698';ctx.font='25px Arial';ctx.fillText('6 CYLINDER',72,170);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
}
export function HoodInsulation() {
  const geometry=useMemo(()=>{
    const p:number[]=[],ix:number[]=[];const uCount=20,vCount=26;
    for(let j=0;j<=vCount;j++)for(let i=0;i<=uCount;i++) {
      const x=(i/uCount*2-1)*.61,z=.86+j/vCount*1.055;
      const y=frontSurfacePoint('pab_e39_hood',new T.Vector3(x,0,z)).y-.024;
      p.push(x,y-.96,z-.704);
    }
    for(let j=0;j<vCount;j++)for(let i=0;i<uCount;i++) {const a=j*(uCount+1)+i,b=a+uCount+1;ix.push(a,a+1,b,a+1,b+1,b);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="E39_hood_acoustic_lining" geometry={geometry} dispose={null} receiveShadow><meshStandardMaterial color="#303538" roughness={.99} side={T.DoubleSide} envMapIntensity={.22}/></mesh>;
}
/** Purpose-built visual inline-six and a closed bay; not engineering/fitment CAD. */
export default function EngineBay({selected,onSelect,explode,onMotion}:Props) {
  const filter=useRef<T.Group>(null),label=useMemo(coverLabel,[]),{invalidate}=useThree();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>()=>label.dispose(),[label]);
  useEffect(()=>{invalidate();},[explode,invalidate]);
  useFrame((_,dt)=>{
    let moving=false;
    filter.current?.children.forEach((piece,i)=>{
      const target=explode?[.40,.17,.29][i]:0;
      piece.position.y=reduced?target:T.MathUtils.damp(piece.position.y,target,7,Math.min(dt,.04));
      if(Math.abs(piece.position.y-target)>.0004){moving=true;invalidate();}else piece.position.y=target;
    });
    onMotion?.(moving);
  });
  const common={selected,onSelect};
  return <group name="E39_VISUAL_ENGINE_BAY_11">
    <group name="E39_closed_engine_bay" onClick={e=>{e.stopPropagation();onSelect('engine');}}>
      <Solid at={[0,.302,1.29]} size={[1.32,.025,1.23]} color="#1a2227" radius={.008}/>
      <Solid at={[0,.62,.745]} size={[1.29,.42,.055]} color="#333b40"/>
      <Solid at={[0,.846,.770]} size={[1.32,.045,.13]} color="#222a2f"/>
      {[-1,1].map(side=><group key={side}>
        <Solid at={[side*.665,.525,1.29]} size={[.055,.39,1.13]} color="#263139"/>
        <Solid at={[side*.612,.730,1.245]} size={[.15,.027,.85]} color="#2f3b43" radius={.01}/>
        <mesh position={[side*.548,.65,.978]} castShadow><cylinderGeometry args={[.115,.145,.20,48]}/><meshStandardMaterial color="#34414a" metalness={.35} roughness={.5}/></mesh>
        <mesh position={[side*.548,.763,.978]}><cylinderGeometry args={[.076,.079,.025,48]}/><meshStandardMaterial color="#272e33" metalness={.45} roughness={.48}/></mesh>
        {Array.from({length:3},(_,i)=>{const a=i*Math.PI*2/3;return <mesh key={i} position={[side*.548+Math.cos(a)*.093,.764,.978+Math.sin(a)*.093]}><cylinderGeometry args={[.009,.009,.016,6]}/><meshStandardMaterial color="#90979a" metalness={.8} roughness={.3}/></mesh>;})}
      </group>)}
      <Solid at={[-.50,.710,1.32]} size={[.23,.14,.34]} color="#1d252a"/>
      <Solid at={[-.53,.790,1.30]} size={[.065,.012,.07]} color="#c6c5b1" radius={.002}/>
      <Hose points={[[-.50,.72,1.48],[-.40,.70,1.57],[-.38,.58,1.65],[-.28,.53,1.64]]} radius={.013}/>
    </group>
    <Part id="valve-cover" {...common}>
      <Solid at={[-.095,.499,1.23]} size={[.345,.35,.75]} color="#737b7e" metal={.74} rough={.59} radius={.027}/>
      <Solid at={[-.095,.711,1.23]} size={[.353,.093,.792]} color="#646d72" metal={.64} rough={.48} radius={.017}/>
      <Solid at={[-.099,.786,1.22]} size={[.355,.073,.78]} color="#22292d" radius={.025}/>
      {[-.19,-.15,-.11].map(x=><Solid key={x} at={[x,.824,1.27]} size={[.005,.003,.56]} color="#909797" metal={.73} rough={.36} radius={.001}/>)}
      <mesh position={[-.099,.824,1.04]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.23,.06]}/><meshStandardMaterial map={label} roughness={.72}/></mesh>
      <mesh position={[-.212,.837,.933]}><cylinderGeometry args={[.032,.034,.022,32]}/><meshStandardMaterial color="#11191e" roughness={.76}/></mesh>
      <Solid at={[-.212,.850,.933]} size={[.035,.008,.009]} color="#30383d" radius={.002}/>
      {Array.from({length:6},(_,i)=><group key={i}>
        <Solid at={[.022,.824,.938+i*.105]} size={[.059,.025,.071]} color="#30383d" radius={.009}/>
        <Solid at={[.056,.814,.938+i*.105]} size={[.028,.018,.028]} color="#181f23" radius={.005}/>
      </group>)}
      <Hose points={[[.068,.799,.93],[.078,.795,1.18],[.070,.795,1.49],[.03,.76,1.62]]} radius={.008}/>
      {[-.24,.045].flatMap(x=>[.89,1.55].map(z=><mesh key={`${x}:${z}`} position={[x,.827,z]}><cylinderGeometry args={[.007,.007,.008,6]}/><meshStandardMaterial color="#9da4a4" metalness={.78} roughness={.4}/></mesh>))}
    </Part>
    <Part id="intake" {...common}>
      <Solid at={[.375,.652,1.20]} size={[.154,.160,.720]} color="#242b30" radius={.055}/>
      {Array.from({length:6},(_,i)=>{const z=.927+i*.104;return <Hose key={i} points={[[.075,.707,z],[.17,.738,z+.014],[.253,.714,z+.021],[.295,.656,z+.024],[.358,.631,z+.025]]} radius={.030} color="#2f373c"/>;})}
      <Solid at={[.411,.728,1.195]} size={[.025,.008,.53]} color="#424a4d" radius={.003}/>
      <Hose points={[[.38,.65,1.55],[.39,.633,1.63],[.34,.612,1.70]]} radius={.048}/>
    </Part>
    <Part id="air-filter" {...common}>
      <Solid at={[.548,.568,1.626]} size={[.248,.233,.355]} color="#252c30" radius={.024}/>
      <Solid at={[.548,.691,1.626]} size={[.256,.031,.361]} color="#1d252a" radius={.018}/>
      {Array.from({length:8},(_,i)=><Solid key={i} at={[.548,.710,1.49+i*.038]} size={[.21,.009,.008]} color="#353d41" radius={.002}/>)}
      <Hose points={[[.444,.61,1.48],[.412,.606,1.44],[.391,.61,1.52],[.34,.612,1.70]]} radius={.044}/>
      {[1.46,1.77].map(z=><Solid key={z} at={[.672,.66,z]} size={[.014,.035,.014]} color="#9ba0a0" metal={.85} rough={.35} radius={.003}/>)}
    </Part>
    <Part id="oil-filter" {...common}>
      <group position={[.19,.62,1.66]}>
        <mesh castShadow><cylinderGeometry args={[.071,.077,.17,48]}/><meshStandardMaterial color="#747e82" metalness={.72} roughness={.42}/></mesh>
        <group ref={filter}>
          <group name="E39_oil_filter_cap">
            <mesh position={[0,.113,0]}><cylinderGeometry args={[.076,.078,.046,48]}/><meshStandardMaterial color="#1a2227" roughness={.76}/></mesh>
            <mesh position={[0,.148,0]}><cylinderGeometry args={[.023,.023,.025,6]}/><meshStandardMaterial color="#272f33" roughness={.68}/></mesh>
            <RepeatedBoxes color="#30383b" rough={.76} items={Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return {at:[Math.sin(a)*.075,.113,Math.cos(a)*.075],size:[.004,.033,.005],angle:a};})}/>
          </group>
          <group name="E39_oil_filter_paper_insert">
            <mesh position={[0,.042,0]}><cylinderGeometry args={[.045,.045,.10,48]}/><meshStandardMaterial color="#b5a17a" roughness={.97}/></mesh>
            <RepeatedBoxes color="#cdb98e" rough={.97} items={Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return {at:[Math.sin(a)*.045,.042,Math.cos(a)*.045],size:[.0015,.10,.006],angle:a};})}/>
            {[-.01,.094].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[.046,.046,.007,48]}/><meshStandardMaterial color="#282f32" roughness={.8}/></mesh>)}
          </group>
          <group name="E39_oil_filter_seal"><mesh position={[0,.105,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.061,.0025,10,64]}/><meshStandardMaterial color="#10171b" roughness={.83}/></mesh></group>
        </group>
      </group>
    </Part>
    <Part id="radiator" {...common}>
      <Solid at={[0,.53,1.958]} size={[.88,.385,.042]} color="#2e373c" metal={.68} rough={.57} radius={.008}/>
      <RepeatedBoxes color="#768080" metal={.78} rough={.52} items={Array.from({length:42},(_,i)=>({at:[-.416+i*.0203,.53,1.984],size:[.0025,.349,.007]}))}/>
      {[-.15,0,.15].map(y=><Solid key={y} at={[0,.53+y,1.989]} size={[.85,.007,.007]} color="#545f62" metal={.67} rough={.52} radius={.002}/>)}
      {[-1,1].map(side=><Solid key={side} at={[side*.455,.53,1.956]} size={[.055,.403,.067]} color="#1e272d" radius={.015}/>)}
    </Part>
    <Part id="expansion-tank" {...common}>
      <Solid at={[-.520,.535,1.724]} size={[.153,.34,.179]} color="#272f32" radius={.027}/>
      <mesh position={[-.52,.725,1.724]}><cylinderGeometry args={[.046,.049,.043,32]}/><meshStandardMaterial color="#151e23" roughness={.76}/></mesh>
      <Solid at={[-.52,.749,1.724]} size={[.045,.005,.023]} color="#a9a37b" radius={.002}/>
      <Hose points={[[-.52,.64,1.79],[-.48,.68,1.87],[-.35,.7,1.87],[-.25,.65,1.71]]} radius={.019}/>
    </Part>
    <Part id="fan" {...common}>
      <group position={[0,.523,1.843]}>
        <mesh><torusGeometry args={[.195,.012,12,80]}/><meshStandardMaterial color="#252f35" roughness={.81}/></mesh>
        <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.048,.048,.06,32]}/><meshStandardMaterial color="#383f42" roughness={.69}/></mesh>
        {Array.from({length:9},(_,i)=><group key={i} rotation={[0,0,i*Math.PI*2/9]}><mesh position={[.025,.118,0]} rotation={[0,.28,-.32]} castShadow><boxGeometry args={[.059,.136,.009]}/><meshStandardMaterial color="#252e33" roughness={.78}/></mesh></group>)}
      </group>
    </Part>
    <Part id="belt" {...common}>
      <group position={[-.13,.466,1.712]}>
        {[[-.13,-.06],[.095,-.075],[.005,.10]].map(([x,y],i)=><group key={i} position={[x,y,0]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.055,.055,.033,40]}/><meshStandardMaterial color="#7f888b" metalness={.79} roughness={.41}/></mesh><mesh position={[0,0,.019]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.012,.012,.008,6]}/><meshStandardMaterial color="#b1b7b6" metalness={.8} roughness={.3}/></mesh></group>)}
        <mesh scale={[1.34,.92,1]}><torusGeometry args={[.132,.009,8,64]}/><meshStandardMaterial color="#1b2226" roughness={.95}/></mesh>
      </group>
    </Part>
  </group>;
}
