import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import * as T from 'three';
import type {ComponentId} from './components-data';

export default function EngineAssembly({model,selected,onSelect,explode,onMotion}:{model:T.Group;selected:ComponentId;onSelect:(id:ComponentId)=>void;explode:boolean;onMotion?:(moving:boolean)=>void}){
 const {invalidate}=useThree(),insert=useRef<T.Group>(null),ring=useRef<T.Mesh>(null);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const caps=useMemo(()=>model.children.filter(o=>o.userData.explodeCap),[model]);
 useEffect(()=>{
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;
   let owner:T.Object3D|null=o;while(owner&&!owner.userData.component)owner=owner.parent;
   for(const material of Array.isArray(o.material)?o.material:[o.material]){
    const m=material as T.MeshStandardMaterial;
    if(!m.userData.engineBase){
     if(/black|simboliai/.test(m.name)){m.color.set('#272d31');m.metalness=.04;m.roughness=.76;}
     else if(/metal|silver|engine$/.test(m.name)){m.color.set('#767d81');m.metalness=.78;m.roughness=.48;}
     else if(/grey/.test(m.name)){m.color.set('#363b3f');m.metalness=.08;m.roughness=.65;}
     else if(/beige/.test(m.name)){m.color.set('#b1a58c');m.metalness=0;m.roughness=.66;}
     m.envMapIntensity=.55;m.userData.engineBase=true;
    }
    m.emissive?.set(owner?.userData.component===selected?'#123849':'#000000');m.emissiveIntensity=.55;
   }
  });invalidate();
 },[model,selected,invalidate]);
 useFrame((_,dt)=>{
  let moving=false;
  const move=(o:T.Object3D|null,target:number)=>{if(!o)return;o.position.y=reduced?target:T.MathUtils.damp(o.position.y,target,7,Math.min(dt,.04));if(Math.abs(o.position.y-target)>.0002){moving=true;invalidate();}else o.position.y=target;};
  caps.forEach(o=>move(o,explode?.43:0));move(insert.current,explode?.17:0);move(ring.current,explode?.31:0);
  onMotion?.(moving);
 });
 const select=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();let o:T.Object3D|null=e.object;while(o&&!o.userData.component)o=o.parent;onSelect((o?.userData.component??'engine') as ComponentId);};
 return <group name="E39_visual_inline_six_reference">
  <primitive object={model} onClick={select}/>
  <group position={[.061,.690,1.632]} visible={explode} onClick={e=>{e.stopPropagation();onSelect('oil-filter');}}>
   <group ref={insert} name="E39_oil_filter_visual_insert">
    <mesh><cylinderGeometry args={[.041,.041,.105,48]}/><meshStandardMaterial color="#b5a079" roughness={.94}/></mesh>
    {Array.from({length:40},(_,i)=><mesh key={i} position={[Math.sin(i*Math.PI/20)*.041,0,Math.cos(i*Math.PI/20)*.041]} rotation={[0,i*Math.PI/20,0]}><boxGeometry args={[.0015,.101,.004]}/><meshStandardMaterial color="#d1bd94" roughness={.97}/></mesh>)}
    {[-.051,.051].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[.042,.042,.006,48]}/><meshStandardMaterial color="#292e31" roughness={.72}/></mesh>)}
   </group>
   <mesh ref={ring} name="E39_oil_filter_visual_seal" rotation={[Math.PI/2,0,0]}><torusGeometry args={[.049,.0024,10,64]}/><meshStandardMaterial color="#151b20" roughness={.8}/></mesh>
  </group>
 </group>;
}
