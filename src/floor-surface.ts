import * as T from "three";

// Deterministic concrete grain, generated locally; no private photo texture.
export function concreteTexture() {
  const size=512, bytes=new Uint8Array(size*size*4);
  let seed=739;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=(seed/4294967296-0.5)*5;
    const cloud=1.5*Math.sin(x/37)*Math.cos(y/53)+Math.sin((x+y)/79);
    const seam=x<1||y<1?-5:0;
    const i=(y*size+x)*4,v=182+grain+cloud+seam;
    bytes[i]=v;bytes[i+1]=v+1;bytes[i+2]=v+2;bytes[i+3]=255;
  }
  const map=new T.DataTexture(bytes,size,size,T.RGBAFormat);
  map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.repeat.set(16,16);
  map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
  return map;
}

export function floorBlendTexture() {
  const size=128, data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5)/size-.5,(y+.5)/size-.5);
    const a=255*(1-T.MathUtils.smoothstep(r,0.19,0.32));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=a;data[i+3]=255;
  }
  const map=new T.DataTexture(data,size,size,T.RGBAFormat);
  map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true;
  return map;
}
