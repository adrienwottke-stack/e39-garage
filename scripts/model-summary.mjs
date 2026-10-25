import fs from 'node:fs';
const bytes=fs.readFileSync('../model-source/source/BMW1.glb');
const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
const nodes=doc.nodes.map((n,i)=>{const mesh=doc.meshes[n.mesh];const attrs=mesh?.primitives.map(p=>doc.accessors[p.attributes.POSITION]).filter(Boolean)??[];const mn=[0,1,2].map(j=>Math.min(...attrs.map(a=>a.min?.[j]??0)));const mx=[0,1,2].map(j=>Math.max(...attrs.map(a=>a.max?.[j]??0)));return{i,name:n.name,translation:n.translation,center:mn.map((v,j)=>Number(((v+mx[j])/2).toFixed(3))),bounds:[mn.map(v=>+v.toFixed(3)),mx.map(v=>+v.toFixed(3))],materials:[...new Set(mesh?.primitives.map(p=>doc.materials[p.material]?.name))]};});
fs.writeFileSync('../model-source/manifest.json',JSON.stringify(nodes,null,2));
console.log(nodes.filter(n=>/m54|m52|engine|hood|bumper|roof$|body$|wheel|radiator|fan|filter|intake|door_FL$/.test(n.name)).map(n=>`${n.i} ${n.name} @${n.center} shift=${n.translation??'-'} materials=${n.materials.join(',')}`).join('\n'));
console.log('ALL NAMES\n'+nodes.map(n=>n.i+' '+n.name).join('\n'));
