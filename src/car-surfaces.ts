import * as THREE from "three";

export function createRoundel() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "#111820";
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c7cfd4";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 128, 81, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#edf2f4";
  ctx.fillRect(40, 40, 176, 176);
  ctx.fillStyle = "#318bc8";
  ctx.fillRect(40, 40, 88, 88);
  ctx.fillRect(128, 128, 88, 88);
  ctx.restore();
  ctx.strokeStyle = "#c7cfd4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f7f9fb";
  ctx.font = "bold 33px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [text, angle] of [
    ["B", -0.63],
    ["M", 0],
    ["W", 0.63],
  ] as const) {
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(angle);
    ctx.fillText(text, 0, -101);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// The supplied mesh has no UVs. Project each small emblem onto its own plane,
// leaving cached source geometry untouched so other scenes keep their materials.
export function emblemGeometry(source: THREE.BufferGeometry, name: string) {
  const geometry = source.clone();
  const position = geometry.getAttribute("position");
  const values: number[] = [];
  const vertical = /hood/.test(name)
    ? new THREE.Vector3(0, 0.52, -0.85)
    : new THREE.Vector3(0, 1, 0);
  const horizontal = /wheel/.test(name)
    ? new THREE.Vector3(0, 0, -1)
    : new THREE.Vector3(/trunk/.test(name) ? -1 : 1, 0, 0);
  const p = new THREE.Vector3();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    const x = p.dot(horizontal),
      y = p.dot(vertical);
    values.push(x, y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const uv = values.map(
    (v, i) =>
      (v - (i % 2 ? minY : minX)) /
      Math.max(0.00001, i % 2 ? maxY - minY : maxX - minX),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}
