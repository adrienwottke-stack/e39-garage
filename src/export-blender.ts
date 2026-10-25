import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {zipSync,strToU8} from 'fflate';
import renderScript from './blender-render.py?raw';
import modelCredits from '../public/MODEL-CREDITS.txt?raw';
import {MODEL_URL} from './model-version';
import {exportSize,type RenderSettings} from './render-domain';
import {garageLightsForExport,garageRoom} from './garage-environment';

export type ExportBlender=(settings:RenderSettings)=>Promise<Blob>;
export async function exportBlender(scene:T.Scene,camera:T.Camera,settings:RenderSettings) {
  if(settings.environment!=='workshop')throw new Error('Für das Cycles-Paket bitte die Tuning-Garage wählen.');
  const snapshot=scene.clone(true),owned:T.Material[]=[];
  try{
    snapshot.traverse(o=>{
      // Cycles receives the actual rectangular fixtures below. WebGL's ambient,
      // punctual and area approximations must not add duplicate illumination.
      if(o instanceof T.Light){o.visible=false;return;}
      if(!(o instanceof T.Mesh))return;
      const list=Array.isArray(o.material)?o.material:[o.material];
      if(list.some(m=>!(m instanceof T.MeshStandardMaterial))){o.visible=false;return;}
      const floor=o.userData.garageFloor===true||o.name==='E39_RENDER_FLOOR';
      const materials=list.map(m=>{
        // The floor's live shader samples a render target. Export its ordinary
        // opaque PBR surface; Cycles computes the reflection from geometry.
        const clone=floor?new T.MeshStandardMaterial().copy(m as T.MeshStandardMaterial):m.clone() as T.MeshStandardMaterial;
        owned.push(clone);
        if(floor){clone.alphaMap=null;clone.transparent=false;clone.opacity=1;}
        return clone;
      });
      if(floor)o.name='E39_RENDER_FLOOR';
      o.material=Array.isArray(o.material)?materials:materials[0];
    });
    const stillCamera=camera.clone();stillCamera.name='E39_RENDER_CAMERA';
    if(stillCamera instanceof T.PerspectiveCamera){const {width,height}=exportSize(settings);stillCamera.aspect=width/height;stillCamera.updateProjectionMatrix();}
    snapshot.add(stillCamera);snapshot.updateMatrixWorld(true);
    const binary=await new GLTFExporter().parseAsync(snapshot,{binary:true,onlyVisible:true});
    if(!(binary instanceof ArrayBuffer))throw new Error('Die 3D-Szene konnte nicht exportiert werden.');
    const archive=zipSync({
      'scene.glb':new Uint8Array(binary),
      'render.json':strToU8(JSON.stringify({...exportSize(settings),focal:settings.focal,cameraFov:stillCamera instanceof T.PerspectiveCamera?stillCamera.fov:undefined,lightAngle:settings.lightAngle,exposure:settings.exposure,model:MODEL_URL,sceneSource:'actual configured scene',modelRevision:'0.11',environment:{kind:'procedural-tuning-bay',room:garageRoom,lights:garageLightsForExport(settings.lightAngle),worldColor:'#202a34',worldStrength:0.25},visualBasis:'configured E39 reference geometry with procedural tuning garage',engineReference:'simplified procedural engine, illustrative only; not exact M54 CAD'},null,2)),
      'MODEL-CREDITS.txt':strToU8(modelCredits),
      'render.py':strToU8(renderScript),
      'render.ps1':strToU8('param([string]$Blender = "blender")\n$ErrorActionPreference = "Stop"\n& $Blender --background --python (Join-Path $PSScriptRoot "render.py")\nif ($LASTEXITCODE -ne 0) { throw "Blender-Rendering fehlgeschlagen." }\n'),
      'LIES-MICH.txt':strToU8('E39 Garage – lokales Cycles-Rendering\n\nZIP entpacken. Blender 4.5 LTS ist kostenlos (blender.org).\nPowerShell: .\\render.ps1 -Blender "C:\\Pfad\\zu\\blender.exe"\nErgebnis: E39-Cycles.png und die editierbare E39-Konfigurator.blend.\n128 Lichtproben, adaptive Abtastung und Entrauschung. NVIDIA OptiX wenn verfügbar, sonst CPU.\nDie Vorschau und Cycles verwenden dieselbe exportierte Fahrzeug-/Garagengeometrie und Kamera. Die sechs Lichtflächen werden aus denselben Positionen rekonstruiert. Lichtberechnung, Glas und Farbabbildung unterscheiden sich.\nDie Tuning-Garage ist lokal erzeugte 3D-Geometrie. Kein Foto-HDRI und kein weiterer Download erforderlich. Keine Fahrzeugakte, privaten Referenzfotos oder persönlichen Kennzeichen enthalten.\n\nBasismodell: BMW E39 5-Series 1995–2004, Merc_TV, CC BY 4.0\nhttps://sketchfab.com/3d-models/bmw-e39-5-series-1995-2004-4a918a985c0a4ea89ac3d65e1f95c0b7\nGeänderte Materialien, Baugruppen, Räder und Front.\n'),
    },{level:1});
    return new Blob([archive.buffer as ArrayBuffer],{type:'application/zip'});
  }finally{owned.forEach(m=>m.dispose());}
}
