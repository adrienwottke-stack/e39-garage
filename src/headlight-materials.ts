import * as T from 'three';

/**
 * Every optical interior is visible in WebGL's opaque transmission prepass.
 * The fitted outer cover provides actual transmission. A second transmissive
 * lens underneath it would disappear from that prepass in the active renderer.
 * The backed inner lens therefore uses a dielectric reflective surface with a
 * dark optical cavity; its highlight follows real convex geometry.
 */
export function createHeadlightMaterials(lights=false) {
  return {
    insert:new T.MeshStandardMaterial({name:'E39_headlight_moulded_insert',color:'#10171b',roughness:.61,metalness:.03,envMapIntensity:.32}),
    housing:new T.MeshStandardMaterial({name:'E39_closed_optic_housing',color:'#12191e',roughness:.72,metalness:.03,envMapIntensity:.3}),
    reflector:new T.MeshStandardMaterial({name:'E39_aluminised_fluted_reflector',color:'#b5bcb9',roughness:.22,metalness:1,envMapIntensity:.62,side:T.DoubleSide}),
    corner:new T.MeshStandardMaterial({name:'E39_indicator_metalised_optics',color:'#7d8786',roughness:.31,metalness:.82,envMapIntensity:.55,side:T.DoubleSide}),
    prisms:new T.MeshPhysicalMaterial({name:'E39_indicator_moulded_prisms',color:'#5f6a6a',roughness:.24,metalness:.08,clearcoat:.65,clearcoatRoughness:.16,envMapIntensity:.55,side:T.DoubleSide}),
    bezel:new T.MeshStandardMaterial({name:'E39_optic_satin_bezel',color:'#677174',roughness:.26,metalness:.9,envMapIntensity:.56}),
    shroud:new T.MeshPhysicalMaterial({name:'E39_projector_graphite_shroud',color:'#283238',roughness:.26,metalness:.68,clearcoat:.2,envMapIntensity:.55}),
    lens:new T.MeshPhysicalMaterial({name:'E39_projector_backed_convex_lens',color:'#17242c',roughness:.045,metalness:0,ior:1.51,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:.82,
      emissive:lights?'#d5e1e0':'#000000',emissiveIntensity:lights?.42:0}),
    guide:new T.MeshPhysicalMaterial({name:'E39_unlit_polymer_light_guide',color:lights?'#b4a889':'#6d6b5c',roughness:.31,metalness:0,ior:1.49,clearcoat:.25,envMapIntensity:.45,
      emissive:lights?'#ffe2a3':'#000000',emissiveIntensity:lights?1.05:0}),
    bulb:new T.MeshPhysicalMaterial({name:'E39_small_halogen_bulb',color:'#756f5c',roughness:.16,metalness:.15,clearcoat:.7,envMapIntensity:.5,
      emissive:lights?'#fff2d8':'#000000',emissiveIntensity:lights?1.5:0}),
    indicatorBulb:new T.MeshPhysicalMaterial({name:'E39_indicator_amber_capsule',color:'#9c7950',roughness:.21,metalness:.12,clearcoat:.8,envMapIntensity:.55}),
  };
}
