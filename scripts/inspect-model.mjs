import fs from 'node:fs';
const file = process.argv[2];
const bytes = fs.readFileSync(file);
const size = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.toString('utf8', 20, 20 + size));
console.log(JSON.stringify({bytes:bytes.length, extensions:doc.extensionsUsed, meshes:doc.meshes?.length, nodes:doc.nodes?.map((n,i)=>({i,name:n.name,mesh:n.mesh,children:n.children,translation:n.translation,rotation:n.rotation,scale:n.scale})), materials:doc.materials?.map((m,i)=>({i,name:m.name,baseColor:m.pbrMetallicRoughness?.baseColorFactor,textured:!!m.pbrMetallicRoughness?.baseColorTexture})), bounds:doc.accessors?.filter(a=>a.type==='VEC3' && a.min && a.max).slice(0,12).map(a=>({min:a.min,max:a.max,count:a.count}))},null,2));
