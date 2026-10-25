import fs from 'node:fs/promises';
const base=(process.argv[2]??'https://e39.127.0.0.1.sslip.io').replace(/\/$/,'');
const local=await fs.readFile('dist/index.html','utf8');
const expected=local.match(/src="([^"]+\.js)"/)[1];
const response=await fetch(base);
const html=await response.text();
const latest=response.status===200&&html.includes(expected);
console.log(JSON.stringify({page:response.status,latestBuild:latest,expectedScript:expected}));
let passed=latest;
const model=(await fs.readFile('src/model-version.ts','utf8')).match(/\/models\/[^'"]+\.glb/)[0];
for(const path of ['/manifest.webmanifest','/sw.js',model,'/icon-512.png']){
 const res=await fetch(base+path,{method:'HEAD'});passed&&=res.status===200;
 console.log(JSON.stringify({path,status:res.status,type:res.headers.get('content-type'),bytes:res.headers.get('content-length')}));
}
if(!passed)process.exitCode=1;
