import * as T from 'three';

// Conservative envelope of the active sedan, including the configurable bumpers,
// mirrors and roof aerial. Open-hood/cockpit/wheel views have separate close rigs.
export const vehicleFramingBounds=new T.Box3(new T.Vector3(-.99,-.02,-2.72),new T.Vector3(.99,1.58,2.33));
export const vehicleFramingSafeArea={horizontal:.90,vertical:.73};

export function vehicleFramingCorners(bounds=vehicleFramingBounds) {
  return [bounds.min.x,bounds.max.x].flatMap(x=>[bounds.min.y,bounds.max.y].flatMap(y=>[bounds.min.z,bounds.max.z].map(z=>new T.Vector3(x,y,z))));
}

/** Solve the perspective inequalities for every bound corner in the chosen rig. */
export function fitVehicleCamera(position:T.Vector3,target:T.Vector3,verticalFov:number,aspect:number) {
  const back=position.clone().sub(target).normalize();
  if(back.lengthSq()<.5)back.set(1,.2,1).normalize();
  const right=new T.Vector3(0,1,0).cross(back).normalize(),up=back.clone().cross(right).normalize();
  const tanVertical=Math.tan(T.MathUtils.degToRad(verticalFov)/2),tanHorizontal=tanVertical*Math.max(.1,aspect);
  let distance=.1;
  for(const corner of vehicleFramingCorners()) {
    const p=corner.sub(target),depth=p.dot(back);
    distance=Math.max(distance,
      depth+Math.abs(p.dot(right))/(tanHorizontal*vehicleFramingSafeArea.horizontal),
      depth+Math.abs(p.dot(up))/(tanVertical*vehicleFramingSafeArea.vertical));
  }
  return target.clone().addScaledVector(back,distance+.015);
}
