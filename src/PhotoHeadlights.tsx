import {useEffect,useMemo} from 'react';
import * as T from 'three';
import type {Look} from './studio-domain';
import {
  createHeadlightCorner,createHeadlightCornerRibs,createHeadlightInsert,
  createHeadlightReflector,createHeadlightHousing,createProjectorShroud,createProjectorLens,
  headlightCoverDepth,headlightOptics,headlightOpticSetback,
} from './headlight-geometry';
import {createHeadlightMaterials} from './headlight-materials';

// The source cover/gasket retain their original reference envelope. Every
// reflector, lens and closed housing below is a real three-dimensional insert.
export default function PhotoHeadlights({look}:{look:Look}) {
  const geometry=useMemo(()=>({insert:createHeadlightInsert(),corner:createHeadlightCorner(),
    ribs:createHeadlightCornerRibs(),reflector:createHeadlightReflector(),housing:createHeadlightHousing(),
    shroud:createProjectorShroud(),lens:createProjectorLens(),
    indicatorBulb:new T.SphereGeometry(.0095,20,12),bulb:new T.SphereGeometry(.008,24,16),
    lensBezel:new T.TorusGeometry(.0352,.0016,10,64),outerBezel:new T.TorusGeometry(.0605,.0015,10,64),
    guide:new T.TorusGeometry(.0575,.0017,10,64),clip:new T.BoxGeometry(.009,.006,.009)}),[]);
  const materials=useMemo(()=>createHeadlightMaterials(look.lights),[look.lights]);
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  return <group name="E39_OPTICS_12" dispose={null}>
    {[-1,1].map(side=><group key={side} name={`E39_OPTICS_${side}`} scale={[side,1,1]}>
      <mesh geometry={geometry.insert} material={materials.insert} />
      <mesh geometry={geometry.corner} material={materials.corner} />
      <mesh geometry={geometry.ribs} material={materials.prisms} />
      <mesh geometry={geometry.indicatorBulb} position={[.726,.585,headlightCoverDepth(.726)-.031]} rotation={[0,.52,0]} material={materials.indicatorBulb} scale={[1,1,.64]} />
      {headlightOptics.map((optic,index)=><group key={index} name={`E39_OPTIC_${side}_${index}`}
        position={[optic.x,optic.y,headlightCoverDepth(optic.x)-headlightOpticSetback]} rotation={[0,.20,0]}>
        <mesh geometry={geometry.housing} material={materials.housing} />
        {optic.projector?<>
          <mesh geometry={geometry.shroud} material={materials.shroud} />
          <mesh name="E39_projector_convex_glass_surface" geometry={geometry.lens} material={materials.lens} />
          <mesh geometry={geometry.lensBezel} position={[0,0,-.003]} material={materials.bezel} />
        </>:<>
          <mesh geometry={geometry.reflector} material={materials.reflector} />
          <mesh geometry={geometry.bulb} position={[0,0,-.037]} scale={[1,1,1.5]} material={materials.bulb} />
        </>}
        <mesh geometry={geometry.outerBezel} position={[0,0,.001]} material={materials.bezel} />
        <mesh geometry={geometry.guide} position={[0,0,.003]} material={materials.guide} />
        <mesh geometry={geometry.clip} position={[0,.057,-.006]} material={materials.housing} />
      </group>)}
    </group>)}
  </group>;
}
