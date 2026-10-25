import https from 'node:https';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hostname='e39.127.0.0.1.sslip.io';
function get(path,method='GET') {
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname,path,method,
      lookup:(_name,options,cb)=>options?.all?cb(null,[{address:'127.0.0.1',family:4}]):cb(null,'127.0.0.1',4),
    },res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});
    req.setTimeout(30000,()=>req.destroy(Error('timeout')));req.on('error',reject);req.end();
  });
}
const html=await fs.readFile('dist/index.html','utf8'),script=html.match(/src="([^"]+\.js)"/)[1];
const home=await get('/');assert.equal(home.status,200);assert.ok(home.body.toString().includes(script));
const assets=[];
for(const path of ['/sw.js','/manifest.webmanifest',script,'/models/e39-b0aae9fcac8c.glb']){
  const r=await get(path,'HEAD');assert.equal(r.status,200);assets.push({path,status:r.status,bytes:Number(r.headers['content-length'])});
}
const hdr='/models/environments/autoshop-01-d6c700aadd01-2k.hdr';
const remote=await get(hdr);assert.equal(remote.status,200);
const sha256=createHash('sha256').update(remote.body).digest('hex');
assert.equal(sha256,'d6c700aadd0133186d6c7ac258dfb2bc5b1bfa0ace73483f77cf85fcf4abc932');
const catalog=JSON.parse((await get('/api/parts/catalog')).body.toString());assert.equal(catalog.items.length,9);assert.equal(catalog.model,'ready');
const report={checkedAt:new Date().toISOString(),passed:true,base:'https://'+hostname,script,assets,hdr:{path:hdr,bytes:remote.body.length,sha256},parts:{model:catalog.model,offers:catalog.items.length}};
await fs.writeFile('../../outputs/E39-Garage-Version-0.6-Nachweis.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
