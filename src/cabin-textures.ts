import * as T from "three";
import { cabinFit, gaugeAngle } from "./cabin-geometry";

function canvasTexture(name: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  draw(c.getContext("2d")!);
  const t = new T.CanvasTexture(c); t.name = name; t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createGaugeTexture(gauge: typeof cabinFit.gauges[number]) {
  return canvasTexture(`E39 ${gauge.key} printed dial reference zero`, 512, 512, ctx => {
    ctx.fillStyle = "#111418"; ctx.fillRect(0, 0, 512, 512);
    const radius = 240, cx = 256, cy = 256;
    const drawMark = (fraction: number, major: boolean) => {
      const a = gaugeAngle(fraction), inner = radius * (major ? .81 : .87), outer = radius * .93;
      ctx.strokeStyle = gauge.key === "rpm" && fraction > 6 / 7 ? "#ae322f" : "#c6c7c3";
      ctx.lineWidth = major ? 3 : 1.5; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy - Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy - Math.sin(a) * outer); ctx.stroke();
    };
    const divisions = gauge.major * (gauge.key === "speed" ? 2 : 5);
    for (let i = 0; i <= divisions; i++) drawMark(i / divisions, i % (divisions / gauge.major) === 0);
    ctx.fillStyle = "#c7c8c4"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = gauge.radius > .03 ? "26px Arial" : "38px Arial";
    if (gauge.radius > .03) for (let i = 0; i <= gauge.major; i++) {
      const a = gaugeAngle(i / gauge.major);
      ctx.fillText(String(Math.round(i * gauge.max / gauge.major)), cx + Math.cos(a) * radius * .69, cy - Math.sin(a) * radius * .69);
    }
    else {
      const a = gaugeAngle(0), b = gaugeAngle(1);
      ctx.fillText(gauge.key === "fuel" ? "0" : "C", cx + Math.cos(a) * radius * .66, cy - Math.sin(a) * radius * .66);
      ctx.fillText(gauge.key === "fuel" ? "1" : "H", cx + Math.cos(b) * radius * .66, cy - Math.sin(b) * radius * .66);
    }
    ctx.font = gauge.radius > .03 ? "20px Arial" : "28px Arial";
    ctx.fillStyle = "#939994"; ctx.fillText(gauge.label, 256, gauge.radius > .03 ? 330 : 190);
    if (gauge.key === "speed") {
      // The odometer stays an unlit blank: no invented mileage or warning state.
      ctx.fillStyle = "#080c0e"; ctx.fillRect(159, 365, 194, 39);
    }
  });
}

export function createRadioLabels() {
  return canvasTexture("E39 aftermarket radio printed button labels", 1024, 448, ctx => {
    ctx.clearRect(0, 0, 1024, 448);
    ctx.fillStyle = "#969b99"; ctx.font = "15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const labels = [["NAV", "BAND", "DVD", "MEDIA", "MENU"], ["▲", "▶", "◀", "EQ", "BACK"]];
    for (let side = 0; side < 2; side++) labels[side].forEach((label, i) => ctx.fillText(label, side ? 960 : 64, 60 + i * 53));
    ctx.font = "12px Arial"; ctx.fillText("VOL", 64, 405); ctx.fillText("TUNE", 960, 405);
  });
}

export function createClimateLabels() {
  return canvasTexture("E39 climate printed control legends unlit display", 1024, 448, ctx => {
    ctx.clearRect(0, 0, 1024, 448);
    ctx.fillStyle = "#9da19c"; ctx.font = "25px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const left = ["▲", "▼", "AUTO", "MAX"], right = ["▲", "▼", "A/C", "REST"];
    [left, right].forEach((labels, side) => labels.forEach((label, i) => ctx.fillText(label, side ? 938 : 86, 50 + i * 83)));
    ctx.font = "20px Arial";
    ["−", "+", "AUTO", "↺", "OFF"].forEach((label, i) => ctx.fillText(label, 302 + i * 105, 340));
    for (const x of [290, 720]) {
      ctx.strokeStyle = "#a2a39f"; ctx.lineWidth = 3; ctx.strokeRect(x - 32, 152, 64, 34);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 14, 184); ctx.lineTo(x + i * 14, 154); ctx.lineTo(x + i * 14 - 5, 160); ctx.stroke(); }
    }
  });
}

export function createGearPattern() {
  return canvasTexture("E39 manual five speed shift pattern", 512, 512, ctx => {
    ctx.fillStyle = "#13171b"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#c1c7cb"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(154, 212); ctx.lineTo(358, 212);
    for (const x of [154, 256, 358]) { ctx.moveTo(x, 145); ctx.lineTo(x, x === 358 ? 212 : 292); } ctx.stroke();
    ctx.fillStyle = "#cbd0d0"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "50px Arial";
    ["1", "3", "5"].forEach((v, i) => ctx.fillText(v, 154 + i * 102, 99));
    ["2", "4"].forEach((v, i) => ctx.fillText(v, 154 + i * 102, 340));
    ctx.font = "42px Arial"; ctx.fillText("R", 76, 100); ctx.beginPath(); ctx.moveTo(80, 143); ctx.lineTo(80, 212); ctx.lineTo(154, 212); ctx.stroke();
    ["#5895c0", "#2b4473", "#b94747"].forEach((color, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(204 + i * 25, 405); ctx.lineTo(227 + i * 25, 405); ctx.lineTo(205 + i * 25, 453); ctx.lineTo(182 + i * 25, 453); ctx.fill(); });
    ctx.fillStyle = "#c3c8cb"; ctx.font = "italic bold 53px Arial"; ctx.fillText("M", 323, 430);
  });
}
