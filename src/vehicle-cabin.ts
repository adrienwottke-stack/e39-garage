import * as T from 'three';
import type {Look} from './studio-domain';
import {updateCabinMaterial} from './cabin-materials';

export type VehicleCabinPatterns=Record<'walnut'|'carbon'|'tartan',T.CanvasTexture>;
export function createVehicleCabinPatterns():VehicleCabinPatterns {
  const make=(kind:keyof VehicleCabinPatterns)=>{
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!,pixels=ctx.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const noise=(Math.sin(x*127.1+y*311.7)*43758.5453)%1;
      let rgb:number[];
      if(kind==='walnut'){
        const grain=Math.sin(y*.12+Math.sin(x*.025)*2+Math.sin(x*.009)*4)*.5+.5;
        const fine=Math.sin(y*1.7+Math.sin(x*.021)*7)*.5+.5;
        const value=grain*.35+fine*.10+noise*.035;rgb=[80+value*68,46+value*48,27+value*32];
      }else if(kind==='carbon'){
        const row=Math.floor(y/8),col=Math.floor(x/8),over=(row+col)%2===0;
        const ridge=Math.sin((over?x:y)*Math.PI/8)*.5+.5;
        const value=20+ridge*26+((x+y)%3)*3;rgb=[value,value+2,value+3];
      }else{
        const horizontal=y%64,vertical=x%64;
        const broad=horizontal<22||vertical<22, fine=horizontal>42&&horizontal<46||vertical>42&&vertical<46;
        rgb=fine?[153,139,106]:broad?[45,68,57]:[22,31,28];
        const weave=(x+y)%2?1:.78;rgb=rgb.map(v=>v*weave);
      }
      const i=(y*256+x)*4;pixels.data.set([...rgb.map(v=>Math.max(0,Math.min(255,v))),255],i);
    }
    ctx.putImageData(pixels,0,0);const map=new T.CanvasTexture(c);map.name=`E39 procedural cabin ${kind}`;map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
    map.repeat.set(kind==='walnut'?1.7:kind==='carbon'?5:2.5,kind==='walnut'?2:kind==='carbon'?5:2.5);return map;
  };
  return {walnut:make('walnut'),carbon:make('carbon'),tartan:make('tartan')};
}

export function updateVehicleCabin(material:T.Material,nodeName:string,look?:Look,patterns?:VehicleCabinPatterns) {
  const m=material as T.MeshStandardMaterial,kind=m.userData.cabinKind as string|undefined;
  if(!kind)return;
  updateCabinMaterial(m,look);
  const palette:Record<string,[string,string]>={anthracite:['#24282c','#34383a'],cognac:['#865639','#704a36'],ivory:['#bbb7a8','#a6a394'],burgundy:['#542d32','#452a31'],alcantara:['#282a2c','#303336'],tartan:['#242a28','#3c4945']};
  const [leather,cloth]=palette[look?.upholstery??'anthracite']??palette.anthracite;
  if(kind==='leather'){m.color.set(leather);m.roughness=look?.upholstery==='alcantara'?.97:.71;}
  if(kind==='cloth'){m.color.set(/pab_e39_int(?:\s|$)/.test(nodeName)?'#737779':cloth);m.roughness=.97;}
  if(kind==='trim') {
    const trim:Record<string,string>={silver:'#aeb4b6',brushed:'#989e9f',dark:'#282d31',walnut:'#563524','piano-black':'#0d1114',carbon:'#252b2c'};
    m.color.set(trim[look?.interiorTrim??'silver']);m.metalness=['silver','brushed'].includes(look?.interiorTrim??'silver')?.70:.08;
    m.roughness=look?.interiorTrim==='piano-black'?.15:look?.interiorTrim==='walnut'?.29:.42;
  }
  const nextMap=kind==='trim'&&(look?.interiorTrim==='walnut'||look?.interiorTrim==='carbon')?patterns?.[look.interiorTrim]
    :kind==='cloth'&&look?.upholstery==='tartan'&&/pab_e39_seat/.test(nodeName)?patterns?.tartan:undefined;
  if(m.map!==(nextMap??null)){m.map=nextMap??null;m.needsUpdate=true;}
  if(nextMap)m.color.set('#d1d1cc');
  m.side=T.DoubleSide;
}
