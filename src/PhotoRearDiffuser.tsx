import {useEffect,useMemo} from 'react';
import {createPhotoDiffuserFin,createPhotoDiffuserPanel,createPhotoRearExhaust,photoDiffuserShapes,photoRearDiffuser} from './photo-rear-diffuser';

export default function PhotoRearDiffuser(){
  const parts=useMemo(()=>{
    const shapes=photoDiffuserShapes();
    return {
      surround:createPhotoDiffuserPanel(shapes.surround,.014),
      channel:createPhotoDiffuserPanel(shapes.channel,.008,.020),
      ridge:createPhotoDiffuserPanel(shapes.upperRidge,.008,-.004),
      fields:[shapes.rightField,shapes.leftField].map(s=>createPhotoDiffuserPanel(s,.008,-.003)),
      fins:photoRearDiffuser.finXs.map(createPhotoDiffuserFin),
      exhaust:createPhotoRearExhaust(),
    };
  },[]);
  useEffect(()=>()=>{parts.surround.dispose();parts.channel.dispose();parts.ridge.dispose();parts.fields.forEach(g=>g.dispose());parts.fins.forEach(g=>g.dispose());parts.exhaust.dispose();},[parts]);
  return <group name="E39_PHOTO_REAR_DIFFUSER" userData={{reference:'private rear photos, 2026-10-14',revision:'photo-rear-2'}}>
    <mesh name="photo-diffuser-shaped-surround" geometry={parts.surround} castShadow receiveShadow><meshStandardMaterial color="#222326" roughness={.63} metalness={.04}/></mesh>
    <mesh name="photo-diffuser-recessed-channel" geometry={parts.channel} receiveShadow><meshStandardMaterial color="#111315" roughness={.79} metalness={.02}/></mesh>
    <mesh name="photo-diffuser-upper-ridge" geometry={parts.ridge} castShadow><meshStandardMaterial color="#242528" roughness={.56} metalness={.04}/></mesh>
    {parts.fields.map((g,i)=><mesh key={`field-${i}`} name={`photo-diffuser-side-field-${i}`} geometry={g} castShadow><meshStandardMaterial color="#27282b" roughness={.60} metalness={.04}/></mesh>)}
    {parts.fins.map((g,i)=><mesh key={`fin-${i}`} name={`photo-diffuser-short-fin-${i}`} geometry={g} castShadow><meshStandardMaterial color="#202124" roughness={.62} metalness={.04}/></mesh>)}
    {photoRearDiffuser.exhaustXs.map(x=><group key={x} position={[x,photoRearDiffuser.exhaustY,photoRearDiffuser.exhaustEndZ]}>
      <mesh name="photo-rear-hollow-exhaust" geometry={parts.exhaust} castShadow><meshStandardMaterial color="#353638" roughness={.56} metalness={.58}/></mesh>
      <mesh name="photo-rear-exhaust-dark-interior" position={[0,0,.11]} rotation={[0,Math.PI,0]}><circleGeometry args={[photoRearDiffuser.exhaustInnerRadius,48]}/><meshStandardMaterial color="#050607" roughness={1}/></mesh>
    </group>)}
  </group>;
}
