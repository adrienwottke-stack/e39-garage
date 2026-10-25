import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {frontPanelGeometry,frontSurfaceZ,frontReturnGeometry,frontSkinHalfWidthAt,FRONT_SKIN_TOP,FRONT_PLATE_HOLDER_Z,FRONT_PLATE_FACE_Z} from './bumper-geometry';
import {panelNormals} from './panel-normals';
import {fairPanel} from './panel-fairing';

describe('Geformte Front und Panelnormalen',()=>{
  it('schließt die Frontkappe und beide Eckflächen mit identischer Position und Tangente',()=>{
    for(const side of [-1,1]) {
      const g=frontReturnGeometry(side),p=g.attributes.position,n=g.attributes.normal;
      let shared=0;
      for(let i=0;i<p.count;i++) {
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        if(Math.abs(Math.abs(x)-frontSkinHalfWidthAt(y))>1e-6||Math.abs(z-frontSurfaceZ(x,y))>1e-6)continue;
        const h=.0001,dx=(frontSurfaceZ(x+h,y)-frontSurfaceZ(x-h,y))/(2*h),dy=(frontSurfaceZ(x,y+h)-frontSurfaceZ(x,y-h))/(2*h);
        const expected=new T.Vector3(-dx,-dy,1).normalize(),actual=new T.Vector3(n.getX(i),n.getY(i),n.getZ(i));
        expect(actual.dot(expected)).toBeGreaterThan(.9999);shared++;
      }
      expect(shared).toBeGreaterThan(20);
      expect(g.boundingBox!.max.y).toBeCloseTo(FRONT_SKIN_TOP,6);g.dispose();
    }
  });
  it('hält den gesamten geraden Kennzeichenhalter vor der gekrümmten Front',()=>{
    for(let row=0;row<=20;row++)for(let column=0;column<=20;column++) {
      const x=T.MathUtils.lerp(-.2465,.2465,column/20),y=T.MathUtils.lerp(.371,.485,row/20);
      expect(FRONT_PLATE_HOLDER_Z-.011-frontSurfaceZ(x,y)).toBeGreaterThan(.001);
      expect(FRONT_PLATE_FACE_Z-(FRONT_PLATE_HOLDER_Z+.011)).toBeGreaterThan(0);
    }
  });
  it('schließt beide Stoßfänger-Seiten bis zum vorderen Radbogen mit nach außen zeigenden Normalen',()=>{
    for(const side of [-1,1]){
      const g=frontReturnGeometry(side),p=g.attributes.position,n=g.attributes.normal;
      let minZ=Infinity,maxZ=-Infinity;
      for(let i=0;i<p.count;i++){
        expect([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
        expect(side*n.getX(i)).toBeGreaterThan(0.7);
        minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));
      }
      expect(minZ).toBeLessThan(1.7);expect(maxZ).toBeGreaterThan(1.85);g.dispose();
    }
  });
  it('begrenzt geometrische Glättung auf 12 mm und hält offene Panelkanten fest',()=>{
    const source=new T.PlaneGeometry(1,1,10,10),p=source.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*13)*Math.cos(p.getY(i)*9)*0.016);
    source.computeVertexNormals();
    const before=source.toNonIndexed(),g=fairPanel(source),a=before.attributes.position,b=g.attributes.position;
    let moved=0;
    for(let i=0;i<a.count;i++){
      const distance=Math.hypot(a.getX(i)-b.getX(i),a.getY(i)-b.getY(i),a.getZ(i)-b.getZ(i));
      expect(distance).toBeLessThanOrEqual(0.012001);moved=Math.max(moved,distance);
      if(Math.abs(a.getX(i))===0.5||Math.abs(a.getY(i))===0.5)expect(distance).toBe(0);
    }
    expect(moved).toBeGreaterThan(0.0001);source.dispose();before.dispose();g.dispose();
  });
  it('formt symmetrische, zurückgesetzte Nebellampentaschen statt aufgesetzter Ringe',()=>{
    for(const x of [0,.2,.66,.85])expect(frontSurfaceZ(x,.285)).toBeCloseTo(frontSurfaceZ(-x,.285),10);
    expect(frontSurfaceZ(.66,.285)).toBeLessThan(frontSurfaceZ(.66,.4));
    expect(frontSurfaceZ(0,.3)).toBeGreaterThan(frontSurfaceZ(.85,.3));
  });
  it('liefert endliche, normierte Flächen für die tatsächlich verformte Front',()=>{
    const shape=new T.Shape();shape.moveTo(-.879,.162);shape.lineTo(.879,.162);shape.lineTo(.879,.513);shape.lineTo(-.879,.513);shape.closePath();
    const g=frontPanelGeometry(shape),p=g.getAttribute('position'),n=g.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      expect([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,5);
    }
    expect(g.boundingBox!.min.z).toBeGreaterThan(1.7);expect(g.boundingBox!.max.z).toBeLessThan(2.3);g.dispose();
  });
  it('verändert bei der Normalenkorrektur weder Quellgeometrie noch Panelpositionen',()=>{
    const source=new T.BoxGeometry(2,1,3),before=Array.from(source.attributes.position.array);
    const corrected=panelNormals(source);
    expect(Array.from(source.attributes.position.array)).toEqual(before);
    const expanded=source.toNonIndexed();expect(Array.from(corrected.attributes.position.array)).toEqual(Array.from(expanded.attributes.position.array));
    const n=corrected.attributes.normal;
    for(let i=0;i<n.count;i++)expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,5);
    expanded.dispose();source.dispose();corrected.dispose();
  });
});
