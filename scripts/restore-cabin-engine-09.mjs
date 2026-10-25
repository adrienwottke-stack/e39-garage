import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';

const root='C:/Users/demo/Documents/Codex/2026-10-18/verwe';
const source=unzipSync(new Uint8Array(await fs.readFile(root+'/work/baseline-0.9/source.zip')));
const text=name=>new TextDecoder().decode(source['src/'+name]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline=text('VehicleScene.tsx');
const current=(await fs.readFile('src/VehicleScene.tsx','utf8')).replace(/\r\n/g,'\n');
if(!current.includes('import EngineAssembly'))throw Error('Expected the 0.10.1 scene before restoring');
const backup=root+'/work/interior-engine-09/before-0.10.1';
await fs.mkdir(backup,{recursive:true});
const files=['VehicleScene.tsx','PhotoInterior.tsx','model-version.ts','components-data.ts','export-blender.ts'];
for(const file of files)await fs.copyFile('src/'+file,backup+'/'+file);

// Restore the complete visual definitions from 0.9; retain only motion reporting
// so exports continue to wait for the camera, hood and filter to settle.
let visual=baseline.slice(baseline.indexOf('const metal ='),baseline.indexOf('function Scene('));
visual=visual.replace('  explode,\n}: Pick<Props, "selected" | "onSelect" | "explode">)',
  '  explode,\n  onMotion,\n}: Pick<Props, "selected" | "onSelect" | "explode"> & {onMotion?:(moving:boolean)=>void})');
visual=visual.replace('    cap.current?.children.forEach((part, i) => {','    let moving=false;\n    cap.current?.children.forEach((part, i) => {');
visual=visual.replace('      if (Math.abs(part.position.y - target) > 0.001) invalidate();\n    });',
  '      if (Math.abs(part.position.y - target) > 0.001) {moving=true;invalidate();}\n      else part.position.y=target;\n    });\n    onMotion?.(moving);');
visual=visual.replace('function Car(props: Props)', 'function Car(props: Props & {motion:{current:SceneMotion}})');
visual=visual.replace('      if (Math.abs(hoodRef.current.rotation.x - target) > 0.001) invalidate();',
  '      props.motion.current.hood=Math.abs(hoodRef.current.rotation.x-target)>.001;\n      if(props.motion.current.hood)invalidate();\n      else hoodRef.current.rotation.x=target;');
visual=visual.replace('<Engine {...props} />','<Engine {...props} onMotion={moving=>{props.motion.current.engine=moving;}} />');
let prefix=current.slice(0,current.indexOf('type SceneMotion='));
prefix=prefix.replace('  OrbitControls,\n','  OrbitControls,\n  RoundedBox,\n');
prefix=prefix.replace('import EngineAssembly from "./EngineAssembly";\n','');
prefix=prefix.replace('wheelFinishes, photoLook,','wheelFinishes,');
prefix=prefix.replace(/^import \{createCabinSurfaceMaps[^\n]*\n/m,'');
let scene=current.slice(current.indexOf('function Scene('));
scene=scene.replace('? [0.061, 0.79, 1.632]','? [0.19, 0.82, 1.66]');
const restored=prefix+'type SceneMotion={hood:boolean;engine:boolean};\n'+visual+scene;
if(restored.includes('EngineAssembly')||restored.includes('createCabinMaterial'))throw Error('Experimental visual pipeline remains');
if(!restored.includes('onMotion?.(moving)'))throw Error('Engine export settling missing');
await fs.writeFile('src/VehicleScene.tsx',restored);
await fs.writeFile('src/PhotoInterior.tsx',source['src/PhotoInterior.tsx']);
await fs.writeFile('src/model-version.ts',source['src/model-version.ts']);
const model='public/models/e39-body-9651faf179e2.glb';
if(hash(await fs.readFile(model))!==hash(source[model]))throw Error('0.9 model differs');
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
pkg.version=lock.version=lock.packages[''].version='0.10.2';
await fs.writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
await fs.writeFile('package-lock.json',JSON.stringify(lock,null,2)+'\n');
const exporter=(await fs.readFile('src/export-blender.ts','utf8'))
  .replace("modelRevision:'0.10.1'","modelRevision:'0.10.2'")
  .replace("exteriorBasis:'0.9 restored after rejected 0.10 exterior'","visualBasis:'0.9 restored for exterior, cabin and engine'")
  .replace("engineReference:'M52 source assembly, visual reference only; not exact M54 CAD'","engineReference:'0.9 simplified procedural engine, illustrative only; not exact M54 CAD'");
await fs.writeFile('src/export-blender.ts',exporter);
let data=await fs.readFile('src/components-data.ts','utf8');
data=data.replace('Visueller Motorraum mit detaillierter M52-Referenzgeometrie. Die Darstellung ist kein exaktes Modell des M54 in deinem Wagen. Baugruppenbereiche und Ölfilter-Explosionsansicht dienen der Orientierung, nicht als Montagevorlage.','Wiederhergestellter Motorraum aus Version 0.9 mit vereinfachten, auswählbaren Baugruppen und Ölfilter-Explosionsansicht. Die Darstellung dient der Orientierung, nicht als exaktes M54-Modell oder Montagevorlage.');
data=data.replace('Visuelle Reihensechszylinder-Referenz aus einer M52-Ausgangsgeometrie. Bauteilpositionen und Ausführung am tatsächlichen M54 prüfen.','Vereinfachte Reihensechszylinder-Darstellung aus Version 0.9. Bauteilpositionen und Ausführung am tatsächlichen M54 prüfen.');
await fs.writeFile('src/components-data.ts',data);
const proof={version:'0.10.2',baselineArchive:root+'/work/baseline-0.9/source.zip',model,modelSha256:hash(await fs.readFile(model)),modelByteIdenticalTo09:true,photoInteriorSha256:hash(await fs.readFile('src/PhotoInterior.tsx')),photoInteriorByteIdenticalTo09:hash(await fs.readFile('src/PhotoInterior.tsx'))===hash(source['src/PhotoInterior.tsx']),visualDefinitionsFrom09:true,visualOnlyDifference:'Motion reporting and exact settling for exports',experimentalCabinPipelineActive:false,experimentalM52AssemblyActive:false,wheelComponentSha256:hash(await fs.readFile('src/DesignWheels.tsx')),preserved:['Existing model and photo interior from the 0.9 archive','0.9 engine and cabin visibility/material definitions','Engine camera control and export motion settling'],recordWrites:false};
await fs.writeFile(root+'/outputs/E39-0.10.2-Wiederherstellung.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
