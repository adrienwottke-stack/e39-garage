import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Third-party lens mesh data is omitted from this public working sample.
const redLensDefinition: {lenses: Array<{name: string; position: number[]; normal: number[]; index: number[]}>} = {lenses: []};

// Visual photo reconstruction in the app's existing metre coordinate system.
// Rear faces point toward negative z; x>0 is the vehicle's left-hand side.
export const rearExhaust = {centres:[.485,.585],y:.266,endZ:-2.615,outerRadius:.043,innerRadius:.039,length:.145} as const;
export const rearPlate = {y:.765,holderZ:-2.466,faceZ:-2.475,pitch:Math.atan(.3)} as const;
export const rearInsert={bottomY:.258,topY:.365,thickness:.009,skinOffset:.0018,finLowY:.267,finHighY:.315,finProjection:.026} as const;

export function createExhaustTip() {
  // Closed annular rim, outer wall and inner wall. The opening remains empty.
  const {outerRadius:ro,innerRadius:ri,length}=rearExhaust;
  const profile=[new T.Vector2(ri,length),new T.Vector2(ri,.003),new T.Vector2(ri+.001,0),new T.Vector2(ro-.001,0),new T.Vector2(ro,.003),new T.Vector2(ro,length)];
  const g=new T.LatheGeometry(profile,56);
  g.rotateX(Math.PI/2);g.computeBoundingBox();return g;
}

function fittedInsertDepth(source:T.BufferGeometry,x:number,y:number) {
  const z=tailSurfaceDepth(source,x,y);
  if(z===null)throw new Error(`Heckeinsatz ohne Quellfläche bei ${x.toFixed(3)} / ${y.toFixed(3)}`);
  return z;
}

/** Actual M-Technik lower insert skin, separate from the upper rub strip. */
export function rearInsertSource(scene:T.Group) {
  scene.updateMatrixWorld(true);let source:T.BufferGeometry|null=null;
  const bumper=scene.getObjectByName('pab_e39_bumper_R_m-tech');
  bumper?.traverse(o=>{
    if(source||!(o instanceof T.Mesh))return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(materials.some(m=>m.name==='pab_e39_black_rough'))source=o.geometry.clone().applyMatrix4(o.matrixWorld);
  });
  if(!source)throw new Error('Die passende M-Technik-Heckeinsatzfläche fehlt.');
  return source as T.BufferGeometry;
}

// A shallow closed moulding follows the actual lower black skin. The old
// guessed depth sat up to ~140 mm behind it and left the fins floating in air.
export function createRearDiffuserInsert(source:T.BufferGeometry) {
  const columns=40,rows=16,positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++){
    const y=T.MathUtils.lerp(rearInsert.bottomY,rearInsert.topY,row/rows);
    const edge=(side:number)=>{
      let valid=0;
      for(let x=.01;x<=.681;x+=.01){if(tailSurfaceDepth(source,x*side,y)===null)break;valid=x;}
      return Math.max(.40,valid-.006)*side;
    };
    const left=edge(-1),right=edge(1);
    for(let column=0;column<=columns;column++){
      const x=T.MathUtils.lerp(left,right,column/columns),z=fittedInsertDepth(source,x,y)-rearInsert.skinOffset;
      positions.push(x,y,z);
    }
  }
  const layer=(columns+1)*(rows+1);
  for(let i=0;i<layer;i++)positions.push(positions[i*3],positions[i*3+1],positions[i*3+2]+rearInsert.thickness);
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const a=row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;
    indices.push(a,d,b,a,c,d,a+layer,b+layer,d+layer,a+layer,d+layer,c+layer);
  }
  const border:number[]=[];
  for(let c=0;c<=columns;c++)border.push(c);
  for(let r=1;r<=rows;r++)border.push(r*(columns+1)+columns);
  for(let c=columns-1;c>=0;c--)border.push(rows*(columns+1)+c);
  for(let r=rows-1;r>0;r--)border.push(r*(columns+1));
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];indices.push(a,b,b+layer,a,b+layer,a+layer);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;
}

export function createRearDiffuserFin(x:number,source:T.BufferGeometry) {
  const low=rearInsert.finLowY,high=rearInsert.finHighY,root=(y:number)=>fittedInsertDepth(source,x,y)+.0015;
  const s=new T.Shape();s.moveTo(-root(low),low);
  for(let i=1;i<=6;i++){const y=T.MathUtils.lerp(low,high,i/6);s.lineTo(-root(y),y);}
  // Shape x is -world-z so a proper rotation, rather than a reflection, places
  // the lateral extrusion. Both caps retain outward winding and bevel normals.
  s.quadraticCurveTo(-(root(high)-.017),high-.002,-(root(high)-.018),high-.010);
  const rear=root(low)-rearInsert.finProjection;
  s.lineTo(-rear,low-.024);s.quadraticCurveTo(-(rear+.009),low-.028,-(root(low)-.005),low-.009);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:.006,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.0012,bevelThickness:.0012,curveSegments:7});
  g.rotateY(Math.PI/2);g.translate(x-.003,0,0);g.computeBoundingBox();return g;
}

/** Nearest rearward intersection with the original fitted optical footprint. */
export function tailSurfaceDepth(g:T.BufferGeometry,x:number,y:number):number|null {
  const p=g.getAttribute('position'),index=g.getIndex();let nearest=Infinity;
  for(let i=0;i<(index?.count??p.count);i+=3) {
    const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
    const ax=p.getX(ia),ay=p.getY(ia),bx=p.getX(ib),by=p.getY(ib),cx=p.getX(ic),cy=p.getY(ic);
    const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(den)<1e-12)continue;
    const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,c=1-a-b;
    if(a<-.0001||b<-.0001||c<-.0001)continue;
    nearest=Math.min(nearest,a*p.getZ(ia)+b*p.getZ(ib)+c*p.getZ(ic));
  }
  return Number.isFinite(nearest)?nearest:null;
}

export function offsetTailGeometry(source:T.BufferGeometry,z:number) {
  const g=source.clone();g.translate(0,0,z);g.computeBoundingBox();return g;
}

export function clipTailFrameAtHeight(source:T.BufferGeometry,above:boolean,height=.818) {
  const p=source.getAttribute('position'),n=source.getAttribute('normal'),indices=source.getIndex(),positions:number[]=[],normals:number[]=[];
  type Vertex={p:T.Vector3;n:T.Vector3};
  for(let i=0;i<(indices?.count??p.count);i+=3) {
    const polygon:Vertex[]=[];
    const input=[0,1,2].map(k=>{const j=indices?indices.getX(i+k):i+k;return {p:new T.Vector3().fromBufferAttribute(p,j),n:new T.Vector3().fromBufferAttribute(n,j)};});
    for(let k=0;k<3;k++) {
      const a=input[k],b=input[(k+1)%3],insideA=above?a.p.y>=height:a.p.y<=height,insideB=above?b.p.y>=height:b.p.y<=height;
      if(insideA)polygon.push(a);
      if(insideA!==insideB){const t=(height-a.p.y)/(b.p.y-a.p.y);polygon.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()});}
    }
    for(let j=1;j<polygon.length-1;j++)for(const vertex of [polygon[0],polygon[j],polygon[j+1]]){positions.push(vertex.p.x,vertex.p.y,vertex.p.z);normals.push(vertex.n.x,vertex.n.y,vertex.n.z);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.computeBoundingBox();return g;
}

export function createTailLampRibs(source:T.BufferGeometry,zOffset=-.0015) {
  source.computeBoundingBox();const b=source.boundingBox!,pieces:T.BufferGeometry[]=[];
  for(let y=b.min.y+.003;y<b.max.y-.002;y+=.006) {
    let points:T.Vector3[]=[];
    const flush=()=>{if(points.length>2){const path=new T.CatmullRomCurve3(points);pieces.push(new T.TubeGeometry(path,Math.max(3,points.length*2),.0008,4,false));}points=[];};
    for(let x=b.min.x+.002;x<=b.max.x-.002;x+=.004) {
      const z=tailSurfaceDepth(source,x,y);
      if(z===null){flush();continue;}points.push(new T.Vector3(x,y,z+zOffset));
    }
    flush();
  }
  const g=pieces.length?mergeGeometries(pieces,false)!:new T.BufferGeometry();
  pieces.forEach(piece=>piece.dispose());g.computeBoundingBox();return g;
}

export function createTailReflectorFacets(source:T.BufferGeometry) {
  source.computeBoundingBox();const b=source.boundingBox!,v:number[]=[];
  const step=.012;
  for(let y=b.min.y+.008;y<b.max.y-.006;y+=step)for(let x=b.min.x+.008;x<b.max.x-.006;x+=step) {
    const corners=[[-.0048,-.0048],[.0048,-.0048],[.0048,.0048],[-.0048,.0048]].map(([dx,dy])=>{
      const z=tailSurfaceDepth(source,x+dx,y+dy);return z===null?null:new T.Vector3(x+dx,y+dy,z+.001);
    });
    if(corners.some(p=>p===null))continue;
    const z=tailSurfaceDepth(source,x,y);if(z===null)continue;
    const centre=new T.Vector3(x,y,z-.0025);
    for(let i=0;i<4;i++){for(const p of [corners[i]!,corners[(i+1)%4]!,centre])v.push(p.x,p.y,p.z);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}

export type LampPatch={name:string;geometry:T.BufferGeometry;material:T.MeshStandardMaterial};

// The perimeter and all corners come from the fitted source surfaces. New
// chambers, prism ribs, tinted skins and reflectors remain exportable meshes.
export function createTailLampAssembly(source:T.Group) {
  source.updateMatrixWorld(true);const pieces:LampPatch[]=[];
  source.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    const family=o.parent?.name||o.name;
    if(!/^pab_e39_taillight(?:frame|glass)?_[LR]$/.test(family)&&!/^pab_e39_taillight(?:frame|glass)?_[LR]$/.test(o.name))return;
    const name=/^pab_e39_taillight/.test(family)?family:o.name;
    const sourceMaterial=(Array.isArray(o.material)?o.material[0]:o.material) as T.MeshStandardMaterial;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
    if(name.includes('frame')) {
      pieces.push({name:`${name}_red_lens_frame`,geometry:clipTailFrameAtHeight(geometry,false),material:new T.MeshPhysicalMaterial({name:'E39_rear_red_perimeter',color:'#890710',roughness:.22,metalness:0,clearcoat:.55,clearcoatRoughness:.16,side:T.DoubleSide})});
      pieces.push({name:`${name}_clear_upper_frame`,geometry:clipTailFrameAtHeight(geometry,true),material:new T.MeshPhysicalMaterial({name:'E39_rear_clear_perimeter',color:'#c9cec7',roughness:.25,metalness:.08,clearcoat:.7,clearcoatRoughness:.16,side:T.DoubleSide})});
      geometry.dispose();
      return;
    }
    if(name.includes('glass')) {
      geometry.computeBoundingBox();const b=geometry.boundingBox!;
      const innerRed=b.max.y<.8&&Math.abs((b.min.x+b.max.x)/2)<.49;
      pieces.push({name:`${name}_${innerRed?'inner_red':'clear'}_cover`,geometry,material:new T.MeshPhysicalMaterial({name:innerRed?'E39_rear_red_chamber_lens':'E39_rear_clear_cover',color:innerRed?'#b20713':'#f8faf3',transmission:innerRed?.7:.94,thickness:innerRed?.003:.002,ior:1.49,roughness:innerRed?.12:.07,metalness:0,side:T.DoubleSide})});
      if(innerRed) {
        const base=offsetTailGeometry(geometry,.006);
        pieces.push({name:`${name}_inner_red_reflector`,geometry:base,material:new T.MeshStandardMaterial({name:'E39_rear_red_reflector',color:'#b92228',roughness:.3,metalness:.65,side:T.DoubleSide})});
        pieces.push({name:`${name}_inner_red_prisms`,geometry:createTailLampRibs(base),material:new T.MeshPhysicalMaterial({name:'E39_rear_red_prisms',color:'#b51a1e',roughness:.21,metalness:.1,clearcoat:.5,side:T.DoubleSide})});
      }
      return;
    }
    geometry.computeBoundingBox();
    const isRed=sourceMaterial.name==='pab_e39_red'||/brake|lowhi/.test(sourceMaterial.name);
    const isReverse=/reverse/.test(sourceMaterial.name)&&geometry.boundingBox!.max.y<.81;
    const chamber=isRed?'red':isReverse?'reverse':'indicator';
    const base=offsetTailGeometry(geometry,.004),facets=createTailReflectorFacets(geometry),ribs=createTailLampRibs(geometry);
    pieces.push({name:`${name}_${chamber}_reflector`,geometry:base,material:new T.MeshStandardMaterial({name:`E39_rear_${chamber}_reflector`,color:isRed?'#bd2022':'#c4c9c6',metalness:.78,roughness:.24,side:T.DoubleSide})});
    pieces.push({name:`${name}_${chamber}_reflector_facets`,geometry:facets,material:new T.MeshStandardMaterial({name:`E39_rear_${chamber}_facets`,color:isRed?'#d12c29':'#d5d6cb',metalness:.8,roughness:.18,side:T.DoubleSide})});
    pieces.push({name:`${name}_${chamber}_prisms`,geometry:ribs,material:new T.MeshPhysicalMaterial({name:`E39_rear_${chamber}_prisms`,color:isRed?'#b51a1e':'#e4e7df',roughness:.2,metalness:.1,clearcoat:.7,clearcoatRoughness:.12,side:T.DoubleSide})});
    geometry.dispose();
  });
  for(const definition of redLensDefinition.lenses) {
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(definition.position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(definition.normal,3));
    geometry.setIndex(definition.index);geometry.computeBoundingBox();
    pieces.push({name:`E39_FITTED_RED_COVER_${definition.name}`,geometry,material:new T.MeshPhysicalMaterial({name:'E39_rear_red_chamber_lens',color:'#b20713',transmission:.78,thickness:.003,ior:1.49,roughness:.09,metalness:0,clearcoat:.3,side:T.DoubleSide})});
  }
  return pieces;
}

