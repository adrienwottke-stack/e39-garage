import { DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace } from "three";

// A local wall-light footprint, shared with glTF through an ordinary emissive
// map. No extra realtime lights or transparent atmosphere cards are needed.
export function garageAccentTexture(hex: string) {
  const width = 64, height = 64, data = new Uint8Array(width * height * 4);
  const color = [0, 2, 4].map(offset => parseInt(hex.replace("#", "").slice(offset, offset + 2), 16));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (x + 0.5) / width * 2 - 1, dy = (y + 0.5) / height * 2 - 1;
    const gradient = Math.pow(Math.max(0, 1 - dx * dx), 1.6) * Math.pow(Math.max(0, 1 - dy * dy), 1.9);
    const offset = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = color[channel] * gradient;
    data[offset + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
