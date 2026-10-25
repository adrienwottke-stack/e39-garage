import * as T from 'three';

// Area-angle weighted normals avoid giving narrow bevel triangles the same
// influence as the panel face. Boundaries/creases use the original normal gate.
export function panelNormals(source:T.BufferGeometry) {
  if(source.userData.authoredPanelNormals)return source.clone();
  const g=source.index?source.toNonIndexed():source.clone();
  const p=g.getAttribute('position'), original=g.getAttribute('normal');
  const incident=new Map<string,{normal:T.Vector3;weight:number}[]>();
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  const key=(i:number)=>`${Math.round(p.getX(i)*100000)},${Math.round(p.getY(i)*100000)},${Math.round(p.getZ(i)*100000)}`;
  for(let i=0;i<p.count;i+=3) {
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
    const cross=b.clone().sub(a).cross(c.clone().sub(a)),area=cross.length();
    if(area<1e-12)continue;
    const normal=cross.normalize(),vertices=[a,b,c];
    for(let corner=0;corner<3;corner++) {
      const v=vertices[corner],u=vertices[(corner+1)%3].clone().sub(v).normalize(),w=vertices[(corner+2)%3].clone().sub(v).normalize();
      const weight=Math.sqrt(area)*Math.acos(T.MathUtils.clamp(u.dot(w),-1,1));
      const k=key(i+corner),list=incident.get(k)??[];
      list.push({normal,weight});incident.set(k,list);
    }
  }
  const normals=new Float32Array(p.count*3),base=new T.Vector3(),sum=new T.Vector3();
  for(let i=0;i<p.count;i++) {
    base.fromBufferAttribute(original,i).normalize();sum.set(0,0,0);
    for(const face of incident.get(key(i))??[])if(face.normal.dot(base)>0.7)sum.addScaledVector(face.normal,face.weight);
    if(sum.lengthSq()<1e-12)sum.copy(base);
    sum.normalize().toArray(normals,i*3);
  }
  g.setAttribute('normal',new T.BufferAttribute(normals,3));return g;
}
