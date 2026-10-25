import https from 'node:https';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
// Explicit deployment address; TLS hostname and certificate validation stay enabled.
const hostname = 'e39.127.0.0.1.sslip.io';
function request(path, data) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? null : JSON.stringify(data);
    const req = https.request({hostname, path, method: body ? 'POST' : 'GET',
      lookup: (_name, options, cb) => options?.all ? cb(null, [{address:'127.0.0.1',family:4}]) : cb(null,'127.0.0.1',4),
      headers: body ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} : {},
    }, res => {let text=''; res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));});
    req.setTimeout(35000,()=>req.destroy(Error('timeout')));req.on('error',reject);req.end(body);
  });
}
const expected=(await fs.readFile('dist/index.html','utf8')).match(/src="([^"]+\.js)"/)[1];
const page=await request('/'); assert.equal(page.status,200);assert.ok(page.text.includes(expected));
const catalog=JSON.parse((await request('/api/parts/catalog')).text);
assert.equal(catalog.items.length,9); assert.equal(catalog.model,'ready');
assert.equal(catalog.vehicle.year,2001);assert.equal(catalog.vehicle.bumper,'mtech');
const cases=[];
for(const query of ['silberne 18 Zoll Felgen als Satz bis 1.500 Euro','dezenter schwarzer Frontansatz bis 300 Euro','19 Zoll Felgen bis 100 Euro']) {
  const res=await request('/api/parts/search',{query,category:'wheels'});assert.equal(res.status,200);
  const result=JSON.parse(res.text); assert.equal(result.mode,'semantic');
  assert.ok(result.items.every(i=>i.fit.status==='conditional'));
  if(query.startsWith('silberne')) {assert.ok(result.items.length>0);assert.ok(result.items.every(i=>i.diameter===18 && (i.quantity===1?4*i.offer.price:i.offer.price)<=1500));}
  if(query.startsWith('dezenter')) {assert.equal(result.items.length,3);assert.ok(result.items.every(i=>i.category==='lip'&&i.offer.price<=300));assert.doesNotMatch(result.budgetNote,/Satzbudget/);}
  if(query.startsWith('19'))assert.equal(result.items.length,0);
  cases.push({query,...result});
}
const report={checkedAt:new Date().toISOString(),base:'https://'+hostname,expectedScript:expected,catalog,cases,passed:true};
await fs.writeFile('../../outputs/E39-Garage-Version-0.5-Nachweis.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,expectedScript:expected,model:catalog.model,offers:catalog.items.length,cases:cases.map(c=>({query:c.query,count:c.items.length,mode:c.mode,elapsedMs:c.model.elapsedMs}))},null,2));
