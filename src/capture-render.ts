import * as THREE from "three";
import type { CaptureOptions } from "./render-domain";

// Capture at the requested pixel size, then restore the live canvas even if
// allocation or PNG encoding fails. No second WebGL context is allocated.
export async function captureRender(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: CaptureOptions = {},
  renderFrame?: (width:number,height:number) => void,
) {
  const size = gl.getSize(new THREE.Vector2()),
    ratio = gl.getPixelRatio();
  const width = options.width ?? Math.round(size.x * ratio),
    height = options.height ?? Math.round(size.y * ratio);
  const context = gl.getContext();
  const maxEdge = Math.min(
    gl.capabilities.maxTextureSize,
    context.getParameter(context.MAX_RENDERBUFFER_SIZE),
  );
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > maxEdge ||
    height > maxEdge ||
    width * height > 8_400_000
  )
    throw new Error(
      "Diese Bildgröße ist auf deinem Gerät nicht verfügbar. Wähle die kleinere Größe.",
    );
  const perspective = camera instanceof THREE.PerspectiveCamera ? camera : null;
  const aspect = perspective?.aspect;
  try {
    gl.setPixelRatio(1);
    gl.setSize(width, height, false);
    if (perspective) {
      perspective.aspect = width / height;
      perspective.updateProjectionMatrix();
    }
    if(renderFrame)renderFrame(width,height);else gl.render(scene, camera);
    const blob = await new Promise<Blob>((resolve, reject) =>
      gl.domElement.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(
                new Error(
                  "Das PNG konnte nicht erstellt werden. Versuche eine kleinere Bildgröße.",
                ),
              ),
        "image/png",
      ),
    );
    if (gl.getContext().isContextLost())
      throw new Error(
        "Die Grafikverbindung wurde unterbrochen. Lade die Ansicht neu und wähle eine kleinere Bildgröße.",
      );
    return blob;
  } finally {
    gl.setPixelRatio(ratio);
    gl.setSize(size.x, size.y, false);
    if (perspective && aspect !== undefined) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
    }
    if(renderFrame)renderFrame(Math.round(size.x*ratio),Math.round(size.y*ratio));else gl.render(scene, camera);
  }
}
