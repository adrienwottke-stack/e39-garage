import * as T from 'three';
import {conformingTessellation} from './mesh-subdivision';

// Visual reconstruction from Adrien's rear photographs. These are coordinates
// of the existing app model, not measurements or a real-world fitment claim.
export const photoRearDiffuser={
  finXs:[-.19,.19],exhaustXs:[.485,.585],exhaustY:.247,exhaustEndZ:-2.535,
  exhaustOuterRadius:.043,exhaustInnerRadius:.038,
} as const;

// Rearward surface samples from the active bumper's painted lower surround,
// y=.33. Follow its corners instead of placing a flat plate behind the car.
const profile=new T.CubicInterpolant(
  new Float32Array([0,.2,.4,.5,.6,.7,.74]),
  new Float32Array([-2.51574343,-2.50894866,-2.48910858,-2.47445512,-2.45300635,-2.41252282,-2.36913347]),1,
);
export function photoDiffuserDepth(x:number,y:number){
  const across=profile.evaluate(Math.min(.74,Math.abs(x)))[0];
  const t=T.MathUtils.smoothstep(y,.215,.33);
  // Keep the upper attachment close to the painted surround; roll the lower
  // return farther inward instead of leaving a projecting black shelf.
  return across+.065*(1-t)-.0035;
}

function roundedPanel(left:number,right:number,bottom:number,top:number,r=.012){
  const s=new T.Shape();s.moveTo(left+r,bottom);s.lineTo(right-r,bottom);
  s.quadraticCurveTo(right,bottom,right,bottom+r);s.lineTo(right,top-r);
  s.quadraticCurveTo(right,top,right-r,top);s.lineTo(left+r,top);
  s.quadraticCurveTo(left,top,left,top-r);s.lineTo(left,bottom+r);
  s.quadraticCurveTo(left,bottom,left+r,bottom);s.closePath();return s;
}

export function photoDiffuserShapes(){
  const surround=new T.Shape();
  surround.moveTo(-.660,.235);surround.quadraticCurveTo(-.683,.257,-.690,.291);
  surround.quadraticCurveTo(-.690,.323,-.643,.333);surround.lineTo(.643,.333);
  surround.quadraticCurveTo(.690,.323,.690,.291);
  surround.quadraticCurveTo(.686,.258,.674,.239);
  // The left twin exhaust sits in an open-bottom cut-out, not in a black plate.
  surround.quadraticCurveTo(.666,.229,.652,.226);surround.lineTo(.652,.259);
  surround.quadraticCurveTo(.652,.294,.618,.294);surround.lineTo(.452,.294);
  surround.quadraticCurveTo(.420,.294,.420,.261);surround.lineTo(.420,.222);
  surround.lineTo(-.637,.222);
  surround.quadraticCurveTo(-.652,.222,-.660,.235);surround.closePath();
  const channel=roundedPanel(-.415,.395,.230,.286,.014);
  surround.holes.push(new T.Path(channel.getPoints(24)));
  const rightField=new T.Shape();
  rightField.moveTo(-.648,.306);rightField.quadraticCurveTo(-.648,.313,-.638,.314);
  rightField.lineTo(-.478,.313);rightField.quadraticCurveTo(-.468,.313,-.459,.305);
  rightField.lineTo(-.441,.290);rightField.quadraticCurveTo(-.434,.285,-.445,.285);
  rightField.lineTo(-.630,.289);rightField.quadraticCurveTo(-.642,.289,-.646,.297);rightField.closePath();
  const leftField=new T.Shape();
  leftField.moveTo(.445,.305);leftField.lineTo(.471,.322);leftField.lineTo(.635,.323);
  leftField.quadraticCurveTo(.644,.323,.647,.315);leftField.lineTo(.642,.306);
  leftField.quadraticCurveTo(.640,.302,.631,.302);leftField.lineTo(.455,.300);
  leftField.quadraticCurveTo(.443,.299,.445,.305);leftField.closePath();
  return {surround,channel,
    upperRidge:roundedPanel(-.415,.395,.288,.307,.009),
    rightField,leftField,
  };
}

export function createPhotoDiffuserPanel(shape:T.Shape,depth=.012,setback=0){
  const source=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,
    bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,curveSegments:8});
  const g=conformingTessellation(source,.020);source.dispose();
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),h=.0001;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nz=n.getZ(i);
    const dx=(photoDiffuserDepth(x+h,y)-photoDiffuserDepth(x-h,y))/(2*h);
    const dy=(photoDiffuserDepth(x,y+h)-photoDiffuserDepth(x,y-h))/(2*h);
    p.setZ(i,photoDiffuserDepth(x,y)+z+setback);
    const normal=new T.Vector3(n.getX(i)-dx*nz,n.getY(i)-dy*nz,nz).normalize();
    n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function createPhotoDiffuserFin(x:number){
  // Short vertical guides attached to the recessed channel and its lower lip.
  // The side shoulders are shaped by the surround; no extra long racing fins.
  const rootTop=photoDiffuserDepth(x,.278)+.018,rootBottom=photoDiffuserDepth(x,.218)+.018;
  const s=new T.Shape();s.moveTo(-rootTop,.279);s.lineTo(-(rootTop-.012),.272);
  s.lineTo(-(rootBottom-.030),.200);s.quadraticCurveTo(-(rootBottom-.020),.195,-rootBottom,.215);
  s.lineTo(-rootBottom,.222);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:.008,steps:1,bevelEnabled:true,bevelSize:.0012,bevelThickness:.0012,bevelSegments:3,curveSegments:16});
  g.rotateY(Math.PI/2);g.translate(x-.004,0,0);g.computeBoundingBox();return g;
}

export function createPhotoRearExhaust(){
  const {exhaustOuterRadius:ro,exhaustInnerRadius:ri}=photoRearDiffuser;
  const g=new T.LatheGeometry([
    new T.Vector2(ri,.13),new T.Vector2(ri,.003),new T.Vector2(ri+.001,0),
    new T.Vector2(ro-.001,0),new T.Vector2(ro,.003),new T.Vector2(ro,.13),
  ],64);
  g.rotateX(Math.PI/2);g.computeBoundingBox();return g;
}
