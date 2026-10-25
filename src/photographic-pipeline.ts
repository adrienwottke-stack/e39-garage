import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {automotiveLighting} from './automotive-lighting';

// Same light/shadow pipeline for the moving preview and the actual PNG.
export class PhotographicPipeline {
  private composer:EffectComposer;
  private ao:GTAOPass;
  private output:OutputPass;
  private width=0;
  private height=0;
  constructor(renderer:T.WebGLRenderer, scene:T.Scene, camera:T.Camera) {
    const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2});
    this.composer=new EffectComposer(renderer,target);
    this.composer.setPixelRatio(1);
    this.composer.addPass(new RenderPass(scene,camera));
    this.ao=new GTAOPass(scene,camera,1,1);
    this.ao.updateGtaoMaterial(automotiveLighting.ao);
    this.ao.blendIntensity=automotiveLighting.aoBlend;
    this.composer.addPass(this.ao);
    this.output=new OutputPass();this.composer.addPass(this.output);
  }
  render(width:number,height:number) {
    if(width!==this.width||height!==this.height){this.composer.setSize(width,height);this.width=width;this.height=height;}
    this.composer.render();
  }
  dispose(){this.ao.gtaoMaterial.dispose();this.ao.dispose();this.output.dispose();this.composer.dispose();}
}
