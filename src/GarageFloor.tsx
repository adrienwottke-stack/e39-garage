import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

// A single bounded planar reflection, blurred in the floor shader. All targets,
// geometries and materials are owned here and released when the bay unmounts.
// Updating at draw time also refreshes the reflection for a 4K camera aspect.
export default function GarageFloor({ color, texture, reflective, size = 48 }: {
  color: string; texture?: THREE.Texture; reflective: boolean; size?: number;
}) {
  const resources = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size);
    const reflector = reflective ? new Reflector(geometry, { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: 0.002 }) : null;
    const material = new THREE.MeshStandardMaterial({
      name: "E39_GARAGE_FLOOR_MATERIAL", color, map: texture, bumpMap: texture,
      bumpScale: 0.0015, roughness: reflective ? 0.76 : 0.9, metalness: reflective ? 0.18 : 0.05,
    });
    if (reflector) {
      material.onBeforeCompile = shader => {
        const reflectorMaterial = reflector.material as THREE.ShaderMaterial;
        shader.uniforms.garageReflection = reflectorMaterial.uniforms.tDiffuse;
        shader.uniforms.garageReflectionMatrix = reflectorMaterial.uniforms.textureMatrix;
        shader.vertexShader = `uniform mat4 garageReflectionMatrix; varying vec4 garageReflectionUv;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\ngarageReflectionUv = garageReflectionMatrix * vec4(position, 1.0);");
        shader.fragmentShader = `uniform sampler2D garageReflection; varying vec4 garageReflectionUv;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
          vec2 reflectionUv = garageReflectionUv.xy / garageReflectionUv.w;
          vec3 floorReflection = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996323;
            float r = 0.007 * sqrt((float(i) + 0.5) / 12.0);
            floorReflection += texture2D(garageReflection, reflectionUv + vec2(cos(a), sin(a)) * r).rgb / 12.0;
          }
          float floorFresnel = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
          outgoingLight += floorReflection * (0.035 + 0.1 * floorFresnel);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => "e39-bounded-floor-reflection-v1";
    }
    return { geometry, reflector, material };
  }, [color, texture, reflective, size]);
  useEffect(() => () => {
    resources.reflector?.dispose();
    resources.material.dispose();
    resources.geometry.dispose();
  }, [resources]);
  return <mesh name="E39_RENDER_FLOOR" userData={{ garageFloor: true }} geometry={resources.geometry} material={resources.material}
    dispose={null} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.014, 0]} receiveShadow
    onBeforeRender={function (this: THREE.Mesh, renderer, scene, camera, geometry, material, group) {
      if (!resources.reflector || scene.overrideMaterial) return;
      this.visible = false;
      try {
        resources.reflector.matrixWorld.copy(this.matrixWorld);
        resources.reflector.onBeforeRender(renderer, scene, camera, geometry, material, group);
      } finally { this.visible = true; }
    }} />;
}
