import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {fitVehicleCamera,vehicleFramingCorners,vehicleFramingSafeArea} from './vehicle-camera';

describe('full vehicle camera framing',()=>{
  const poses={front:new T.Vector3(2.7,1.25,3.4),rear:new T.Vector3(2.7,1.25,-3.4),side:new T.Vector3(4.9,1.1,0)};
  for(const [width,height] of [[790,508],[355,350],[3840,2160]])for(const [view,position] of Object.entries(poses)) {
    it(`keeps both bumpers, roof and wheels inside ${width}x${height} ${view}`,()=>{
      const target=new T.Vector3(0,.6,-.15);
      for(const focal of [24,50,85,135]){
        const fov=T.MathUtils.radToDeg(2*Math.atan(24/(2*focal))),camera=new T.PerspectiveCamera(fov,width/height,.012,1000);
        camera.position.copy(fitVehicleCamera(position,target,fov,width/height));camera.lookAt(target);camera.updateMatrixWorld();camera.updateProjectionMatrix();
        for(const corner of vehicleFramingCorners()){
          const clip=corner.project(camera);
          expect(Math.abs(clip.x)).toBeLessThanOrEqual(vehicleFramingSafeArea.horizontal+1e-6);
          expect(Math.abs(clip.y)).toBeLessThanOrEqual(vehicleFramingSafeArea.vertical+1e-6);
          expect(clip.z).toBeGreaterThan(-1);expect(clip.z).toBeLessThan(1);
        }
      }
    });
  }
});
