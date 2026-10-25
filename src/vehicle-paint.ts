import * as T from 'three';

/** One finish for the metal body and every painted replacement panel.
 * The pigmented base scatters light below a smoother dielectric clear coat.
 * Values are visual material choices, not a measured BMW paint specification.
 */
export function applyVehiclePaint(material:T.MeshPhysicalMaterial, color:T.ColorRepresentation, finish:string='gloss') {
  const satin=finish==='satin';
  material.color.set(color);
  material.metalness=.48;
  material.roughness=satin?.49:.29;
  material.clearcoat=satin?.22:1;
  material.clearcoatRoughness=satin?.32:.075;
  material.ior=1.5;
  material.specularIntensity=1;
  material.envMapIntensity=1;
}

export function createVehiclePaint(color:T.ColorRepresentation,finish:string='gloss',side:T.Side=T.FrontSide) {
  const material=new T.MeshPhysicalMaterial({side});
  material.name='pab_e39_paint';
  applyVehiclePaint(material,color,finish);
  return material;
}
