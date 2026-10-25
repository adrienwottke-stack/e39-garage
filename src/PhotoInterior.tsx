import {useEffect,useMemo} from 'react';
import {RoundedBox} from '@react-three/drei';
import * as T from 'three';
import type {Look} from './studio-domain';
import {createRoundel} from './car-surfaces';
import {cabinFit,createWheelSpoke,gaugeAngle} from './cabin-geometry';
import {createGaugeTexture,createGearPattern} from './cabin-textures';
import {createHeadliner} from './vehicle-panels';

function displayTexture() {
  const c=document.createElement('canvas');c.width=1024;c.height=448;
  const ctx=c.getContext('2d')!;ctx.fillStyle='#090e12';ctx.fillRect(0,0,1024,448);
  ctx.fillStyle='#141c22';ctx.fillRect(145,40,734,368);
  ctx.strokeStyle='#28313a';ctx.lineWidth=2;ctx.strokeRect(154,49,716,350);
  ctx.fillStyle='#9b947c';ctx.font='20px Arial';ctx.fillText('AUDIO',191,91);
  ctx.fillStyle='#5f6667';ctx.font='28px Arial';ctx.fillText('BMW Business',191,230);
  for(const side of [60,964])for(let i=0;i<5;i++){
    ctx.fillStyle='#9a9e9b';ctx.font='15px Arial';ctx.textAlign='center';ctx.fillText((side===60?['NAV','BAND','MEDIA','MENU','BACK']:['▲','▶','◀','EQ','SET'])[i],side,73+i*53);
  }
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
}

function steeringRim(flat:boolean) {
  const points:T.Vector3[]=[];
  for(let i=0;i<128;i++) {
    const angle=i/128*Math.PI*2,x=Math.cos(angle)*.170,y=Math.sin(angle)*.170;
    points.push(new T.Vector3(x,flat?Math.max(-.142,y):y,0));
  }
  return new T.TubeGeometry(new T.CatmullRomCurve3(points,true,'centripetal'),128,.0185,12,true);
}

function shiftGeometry(style:string) {
  const profile=style==='billet'
    ? [[.011,0],[.012,.012],[.017,.019],[.023,.044],[.022,.056],[.017,.062],[0,.063]]
    : style==='short'
      ? [[.010,0],[.013,.010],[.017,.021],[.023,.037],[.022,.048],[.018,.053],[0,.055]]
      : [[.010,0],[.011,.010],[.013,.027],[.020,.051],[.024,.064],[.023,.072],[.019,.078],[0,.080]];
  return new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),64);
}

function SoftBox({position,args,color='#171c21',radius=.006,metalness=0,roughness=.72}:{position:[number,number,number];args:[number,number,number];color?:string;radius?:number;metalness?:number;roughness?:number}) {
  return <RoundedBox position={position} args={args} radius={radius} smoothness={2} bevelSegments={2} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metalness} roughness={roughness}/></RoundedBox>;
}

export default function PhotoInterior({look}:{look?:Look}) {
  const style=look?.steeringWheel??'oem',shift=look?.shiftKnob??'leather';
  const geometry=useMemo(()=>({rim:steeringRim(style==='flat-bottom'),spokes:[createWheelSpoke(-1),createWheelSpoke(0),createWheelSpoke(1)],shift:shiftGeometry(shift),headliner:createHeadliner()}),[style,shift]);
  const textures=useMemo(()=>({screen:displayTexture(),badge:createRoundel(),pattern:createGearPattern(),gauges:cabinFit.gauges.map(createGaugeTexture)}),[]);
  useEffect(()=>()=>{geometry.rim.dispose();geometry.spokes.forEach(g=>g.dispose());geometry.shift.dispose();geometry.headliner.dispose();},[geometry]);
  useEffect(()=>()=>{textures.screen.dispose();textures.badge.dispose();textures.pattern.dispose();textures.gauges.forEach(t=>t.dispose());},[textures]);
  const trim=look?.interiorTrim==='walnut'?'#5e3626':look?.interiorTrim==='silver'||look?.interiorTrim==='brushed'?'#a8adb0':'#24282c';
  return <group name="E39_CABIN_11">
    <mesh name="E39_continuous_headliner" geometry={geometry.headliner} receiveShadow dispose={null}><meshStandardMaterial color="#777a7b" roughness={.98} side={T.DoubleSide} envMapIntensity={.18}/></mesh>
    <SoftBox position={[0,.67,-1.62]} args={[1.37,.72,.025]} color="#282b2e"/>
    <SoftBox position={[0,1.028,-1.73]} args={[1.30,.025,.26]} color="#333638"/>
    {[-1,1].map(side=><group key={side}>
      <SoftBox position={[side*.425,1.304,-.02]} args={[.235,.025,.145]} color="#777a7b" radius={.012}/>
      <SoftBox position={[side*.626,1.279,-.58]} args={[.025,.026,.135]} color="#7d8081"/>
    </group>)}
    <SoftBox position={[0,1.316,-.18]} args={[.14,.022,.083]} color="#555b60" radius={.008}/>
    <SoftBox position={[0,1.302,-.18]} args={[.079,.008,.057]} color="#c4c4b7" radius={.004}/>
    <group name="E39_steering_wheel" position={[...cabinFit.steering]} rotation={[.28,0,0]}>
      <mesh geometry={geometry.rim} dispose={null} castShadow><meshStandardMaterial color="#15191c" roughness={style==='sport'?.87:.65} envMapIntensity={.28}/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*.159,.056,-.001]} scale={[.70,1,.95]} castShadow><sphereGeometry args={[.027,24,16]}/><meshStandardMaterial color="#15191c" roughness={.7}/></mesh>)}
      {geometry.spokes.map((g,i)=><mesh key={i} geometry={g} position={[0,0,.002]} dispose={null} castShadow><meshStandardMaterial color={style==='three-spoke'?'#7d858b':'#20262b'} roughness={.56} metalness={style==='three-spoke'?.68:.08}/></mesh>)}
      <SoftBox position={[0,-.008,-.012]} args={style==='oem'?[.135,.108,.049]:[.114,.100,.051]} radius={.026} color="#22272b" roughness={.76}/>
      <mesh position={[0,-.007,-.040]} rotation={[0,Math.PI,0]}><circleGeometry args={[.024,48]}/><meshStandardMaterial map={textures.badge} metalness={.30} roughness={.27}/></mesh>
      {style!=='three-spoke'&&[-1,1].map(side=><group key={side}>
        <SoftBox position={[side*.088,.012,-.016]} args={[.035,.025,.007]} radius={.004} color="#15191c"/>
        {[-1,1].map(row=><mesh key={row} position={[side*.088,.011+row*.006,-.020]}><boxGeometry args={[.010,.0012,.001]}/><meshStandardMaterial color="#a4aaa9" roughness={.65}/></mesh>)}
      </group>)}
      {style==='flat-bottom'&&<SoftBox position={[0,-.143,-.001]} args={[.105,.026,.034]} color="#181e23" radius={.011}/>}
      <mesh position={[0,.170,0]}><boxGeometry args={[.009,.037,.038]}/><meshStandardMaterial color={style==='sport'?'#a13431':'#252a2e'} roughness={.77}/></mesh>
    </group>
    <group name="E39_manual_shift_knob" position={[.0134,.5575,.1686]}>
      <mesh geometry={geometry.shift} dispose={null} castShadow><meshStandardMaterial color={shift==='wood'?'#613720':shift==='billet'?'#a4adb4':'#171c20'} metalness={shift==='billet'?.85:.04} roughness={shift==='wood'?.26:shift==='billet'?.31:.67}/></mesh>
      <mesh position={[0,shift==='short'?.054:shift==='billet'?.062:.079,0]} rotation={[-Math.PI/2,0,Math.PI]}><circleGeometry args={[shift==='short'?.0155:.017,48]}/><meshStandardMaterial map={textures.pattern} roughness={.24} metalness={.23}/></mesh>
      {shift!=='billet'&&<mesh position={[0,.010,0]}><cylinderGeometry args={[.0116,.0116,.005,48]}/><meshStandardMaterial color={trim} metalness={.67} roughness={.28}/></mesh>}
    </group>
    <SoftBox position={[0,.754,.35]} args={[.296,.127,.055]} color="#161c21" radius={.006}/>
    <mesh position={[0,.754,.320]} rotation={[0,Math.PI,0]}><planeGeometry args={[.287,.119]}/><meshStandardMaterial map={textures.screen} roughness={.34} metalness={.1}/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[side*.127,.708,.316]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.010,.010,.008,32]}/><meshStandardMaterial color="#31383c" metalness={.48} roughness={.38}/></mesh>)}
    {cabinFit.gauges.map((g,i)=><group key={g.key} position={[g.x,g.y,g.z]} rotation={[0,Math.PI,0]}>
      <mesh><circleGeometry args={[g.radius,64]}/><meshStandardMaterial map={textures.gauges[i]} roughness={.79} emissive={look?.lights?'#896034':'#000000'} emissiveIntensity={.12}/></mesh>
      <group rotation={[0,0,gaugeAngle(0)-Math.PI/2]}><mesh position={[0,g.radius*.32,.0008]}><boxGeometry args={[.0011,g.radius*.70,.001]}/><meshStandardMaterial color="#b85532" roughness={.6}/></mesh></group>
      <mesh position={[0,0,.0015]}><circleGeometry args={[g.radius*.11,24]}/><meshStandardMaterial color="#202426" roughness={.8}/></mesh>
    </group>)}
  </group>;
}
