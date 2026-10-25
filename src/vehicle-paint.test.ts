import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {createVehiclePaint,applyVehiclePaint} from './vehicle-paint';

describe('continuous automotive finish',()=>{
  it('keeps a replacement panel and a repainted body optically identical through finish changes',()=>{
    const body=createVehiclePaint('#151b20');
    for(const finish of ['gloss','satin','gloss']) {
      const bumper=createVehiclePaint('#2042a0',finish,T.DoubleSide);
      applyVehiclePaint(body,'#2042a0',finish);
      for(const key of ['metalness','roughness','clearcoat','clearcoatRoughness','ior','specularIntensity','envMapIntensity'] as const)
        expect(body[key]).toBe(bumper[key]);
      expect(body.color.getHexString()).toBe(bumper.color.getHexString());
      expect(body.clearcoatRoughness).toBeLessThan(body.roughness);
      expect(body.side).toBe(T.FrontSide);
      expect(bumper.side).toBe(T.DoubleSide);
      bumper.dispose();
    }
    body.dispose();
  });
});
