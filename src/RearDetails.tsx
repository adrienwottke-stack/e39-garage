import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import type {Look} from './studio-domain';
import {MODEL_URL} from './model-version';
import {createExhaustTip,createRearDiffuserFin,createRearDiffuserInsert,rearInsertSource,createTailLampAssembly,rearExhaust} from './rear-geometry';

export default function RearDetails({look}:{look:Look}) {
  const {scene}=useGLTF(MODEL_URL),lamps=useMemo(()=>createTailLampAssembly(scene),[scene]);
  const tips=useMemo(()=>createExhaustTip(),[]);
  const diffuser=useMemo(()=>{const source=rearInsertSource(scene);try{return {backing:createRearDiffuserInsert(source),fins:[-.39,-.16,.07,.3].map(x=>createRearDiffuserFin(x,source))};}finally{source.dispose();}},[scene]);
  const materials=useMemo(()=>({
    backing:new T.MeshStandardMaterial({name:'E39_rear_moulded_diffuser_backing',color:'#1b2022',roughness:.64,metalness:.02}),
    fin:new T.MeshStandardMaterial({name:'E39_rear_moulded_diffuser',color:'#15191b',roughness:.64,metalness:.02}),
    pipe:new T.MeshStandardMaterial({name:'E39_exhaust_dark_stainless',color:'#363b3c',metalness:.88,roughness:.31,side:T.DoubleSide}),
  }),[]);
  useEffect(()=>()=>{lamps.forEach(p=>{p.geometry.dispose();p.material.dispose();});},[lamps]);
  useEffect(()=>()=>{tips.dispose();},[tips]);
  useEffect(()=>()=>{diffuser.backing.dispose();diffuser.fins.forEach(g=>g.dispose());},[diffuser]);
  // dispose={null} preserves shared geometry across the photo/standard switch.
  // Its materials are owned here too, rather than leaked JSX children.
  useEffect(()=>()=>{Object.values(materials).forEach(m=>m.dispose());},[materials]);
  useEffect(()=>{for(const patch of lamps) {
    if(patch.material.name==='E39_rear_red_prisms'||patch.material.name==='E39_rear_red_chamber_lens') {
      patch.material.emissive.set(look.lights?'#f3070b':'#000000');patch.material.emissiveIntensity=look.lights ? .85 : 0;
    }
  }},[lamps,look.lights]);
  return <group name="E39_REAR_DETAIL_010">
    <group name="E39_REAR_OPTICS_010">{lamps.map((p,i)=><mesh key={i} name={p.name} geometry={p.geometry} material={p.material} dispose={null} />)}</group>
    {look.rearBumper==='photo'&&<group name="E39_PHOTO_REAR_DIFFUSER_AND_EXHAUST">
      <mesh name="E39_DIFFUSER_FITTED_BODY" geometry={diffuser.backing} material={materials.backing} castShadow receiveShadow dispose={null}/>
      {diffuser.fins.map((g,i)=><mesh key={i} name={`E39_DIFFUSER_FIN_${i}`} geometry={g} material={materials.fin} castShadow receiveShadow dispose={null}/>)}
      <mesh name="E39_EXHAUST_RECESSED_HEATSHIELD" position={[.535,.306,-2.437]}><boxGeometry args={[.28,.14,.022]}/><meshStandardMaterial name="E39_exhaust_pocket" color="#111518" roughness={.85} metalness={.14}/></mesh>
      {rearExhaust.centres.map((x,i)=><group key={x} name={`E39_LEFT_TAILPIPE_${i}`} position={[x,rearExhaust.y,rearExhaust.endZ]}>
        <mesh name={`E39_EXHAUST_WALL_${i}`} geometry={tips} material={materials.pipe} castShadow dispose={null}/>
        <mesh name={`E39_EXHAUST_DARK_RECESS_${i}`} position={[0,0,.12]} rotation={[0,Math.PI,0]}><circleGeometry args={[rearExhaust.innerRadius*.96,40]}/><meshStandardMaterial name="E39_exhaust_inner_soot" color="#050607" roughness={.98}/></mesh>
      </group>)}
    </group>}
  </group>;
}
