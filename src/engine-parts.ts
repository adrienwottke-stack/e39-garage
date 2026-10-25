import type {ComponentId} from './components-data';
// Authoring regions for the supplied inline-six reference assembly. These
// select model geometry for the vehicle record; they are not fitment dimensions.
export function enginePartAt(x:number,y:number,z:number):ComponentId {
 if(z>1.885)return 'radiator';
 if(z>1.755&&Math.abs(x)<.30&&y<.70)return 'fan';
 if(x<-.36&&z>1.48)return 'expansion-tank';
 if(x>.31&&z>1.47)return 'air-filter';
 if(x>-.005&&x<.122&&z>1.568&&z<1.702&&y>.61)return 'oil-filter';
 if(y<.53&&z>1.56)return 'belt';
 if(x>.035&&y>.53)return 'intake';
 return 'valve-cover';
}
