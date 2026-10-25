import { useState } from "react";
import type { Look } from "./studio-domain";
import { frontBumpers, rearBumpers, trimNames, upholsteryNames, steeringNames, shiftNames, type BumperId, type FrontSpec, type RearSpec } from "./tuning-parts";
import { frontStudyShapes, rearStudyShapes, exhaustCenters } from "./tuning-parts-geometry";
import type { Shape } from "three";
import "./tuning-parts.css";

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { id: T; name: string; detail?: string }[]; onChange: (value: T) => void;
}) {
  return <fieldset className="parts-choice"><legend>{label}</legend><div className="parts-choice-grid">{options.map(o => <button type="button" key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}><strong>{o.name}</strong>{o.detail && <small>{o.detail}</small>}</button>)}</div></fieldset>;
}
function svgPath(shape: Shape) {
  const points = shape.getPoints(32);
  return points.map((p, i) => `${i ? "L" : "M"}${(120 + p.x * 111).toFixed(2)},${(88 - (p.y - .14) * 160).toFixed(2)}`).join(" ") + " Z";
}
export function BumperPreview({ spec, rear = false, color }: { spec: FrontSpec | RearSpec; rear?: boolean; color: string }) {
  const shapes = rear ? rearStudyShapes(spec as RearSpec) : frontStudyShapes(spec as FrontSpec);
  return <svg viewBox="0 0 240 102" aria-hidden="true" className="part-bumper-preview">
    <defs><linearGradient id={`part-${rear ? "rear" : "front"}-${spec.id}`} x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".36" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></linearGradient></defs>
    <path d="M22 94H218" stroke="#8cabc2" strokeOpacity=".15" />
    <path d={svgPath(shapes.shell)} fill={color} stroke="#a7bed1" strokeWidth=".6" />
    <path d={svgPath(shapes.shell)} fill={`url(#part-${rear ? "rear" : "front"}-${spec.id})`} />
    <path d={svgPath(shapes.mouth)} fill="#101920" stroke="#728798" strokeWidth=".45" />
    {shapes.vents.map((shape, i) => <path key={i} d={svgPath(shape)} fill="#0b1319" stroke="#728798" strokeWidth=".35" />)}
    {rear ? <>
      {exhaustCenters((spec as RearSpec).exhaust).map(x => <ellipse key={x} cx={120 + x * 111} cy={88 - (.239 - .14) * 160} rx="4.7" ry="4.2" fill="#090e12" stroke="#b3bdc5" strokeWidth="1.4" />)}
      {Array.from({ length: (spec as RearSpec).fins }, (_, i) => <path key={i} d={`M${120 + (spec.width * .56 * ((i + 1) / ((spec as RearSpec).fins + 1) - .5)) * 111},${88 - (spec.bottom - .14) * 160}v-10`} stroke="#a2b4c2" strokeWidth="1.7" />)}
    </> : <>
      {Array.from({ length: (spec as FrontSpec).dividers }, (_, i) => <path key={i} d={`M${120 + spec.width * ((i + 1) / ((spec as FrontSpec).dividers + 1) - .5) * 111},${88 - (spec.bottom - .14) * 160}v${-spec.height * 160}`} stroke={color} strokeWidth={(spec as FrontSpec).dividers === 1 ? 3 : 1.6} />)}
      {(spec as FrontSpec).vent === "round" && shapes.vents.map((shape, i) => { const p = shape.getPoints(24), x = (Math.min(...p.map(q => q.x)) + Math.max(...p.map(q => q.x))) / 2; return <circle key={i} cx={120 + x * 111} cy={88 - (spec.bottom + .025 + (spec as FrontSpec).ventHeight / 2 - .14) * 160} r="4.7" fill="#8fabb7" stroke="#19232b" strokeWidth="2" />; })}
    </>}
    {spec.lip > 0 && <path d="M25 90Q120 96 215 90" stroke="#899aa7" strokeWidth={1 + spec.lip * 32} fill="none" />}
  </svg>;
}
function BumperBrowser({ value, onChange, rear, color }: { value: BumperId; onChange: (id: BumperId) => void; rear?: boolean; color: string }) {
  const options: (FrontSpec | RearSpec)[] = rear ? rearBumpers : frontBumpers;
  const selected = options.find(p => p.id === value)!;
  const index = options.findIndex(p => p.id === value);
  const familyOptions = options.filter(p => p.family === selected.family);
  const families = [...new Set(options.map(p => p.family))];
  const adjacent = [-1, 0, 1].map(offset => options[(index + offset + options.length) % options.length]);
  return <div className="parts-browser">
    <div className="parts-browser-heading"><span>{rear ? "Heckstoßfänger" : "Frontstoßfänger"}</span><small>{String(index + 1).padStart(2, "0")} / {options.length}</small></div>
    <div className="parts-family-row"><label>Stilfamilie<select value={selected.family} onChange={e => onChange(options.find(p => p.family === e.target.value)!.id)}>{families.map(f => <option key={f}>{f}</option>)}</select></label><label>Design<select value={value} onChange={e => onChange(e.target.value as BumperId)}>{familyOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    <div className="parts-current"><BumperPreview spec={selected} rear={rear} color={color} /><div><strong>{selected.name}</strong><small>{selected.detail}</small></div></div>
    <div className="parts-stepper"><button type="button" aria-label={`Vorheriger ${rear ? "Heck" : "Front"}stoßfänger`} onClick={() => onChange(adjacent[0].id)}>← Zurück</button><span>{selected.family} · Designstudie</span><button type="button" aria-label={`Nächster ${rear ? "Heck" : "Front"}stoßfänger`} onClick={() => onChange(adjacent[2].id)}>Weiter →</button></div>
    <div className="parts-filmstrip">{adjacent.map(p => <button type="button" key={p.id} aria-pressed={p.id === value} aria-label={`${rear ? "Heck" : "Front"}: ${p.family} ${p.name}`} onClick={() => onChange(p.id)}><BumperPreview spec={p} rear={rear} color={color} /><span>{p.name}</span></button>)}</div>
    <p className="parts-hint">22 Formen durchschalten. Die Karosserie zeigt jede Auswahl direkt.</p>
  </div>;
}
export default function TuningControls({ look, change, interior }: { look: Look; change: (patch: Partial<Look>) => void; interior?: boolean }) {
  const [category, setCategory] = useState<"front" | "rear" | "extras">("front");
  if (interior) return <div className="parts-interior">
    <Choice label="Interieurleisten" value={look.interiorTrim} options={Object.entries(trimNames).map(([id, name]) => ({ id: id as Look["interiorTrim"], name: ({ silver: "Silber", dark: "Dunkel", brushed: "Aluminium", walnut: "Nussbaum", "piano-black": "Piano Black", carbon: "Carbon" } as Record<string, string>)[id], detail: `${name.replace(/-$/, "")} Leisten` }))} onChange={interiorTrim => change({ interiorTrim })} />
    <Choice label="Sitze und Türpolster" value={look.upholstery} options={Object.entries(upholsteryNames).map(([id, name]) => ({ id: id as Look["upholstery"], name }))} onChange={upholstery => change({ upholstery })} />
    <Choice label="Lenkrad" value={look.steeringWheel} options={Object.entries(steeringNames).map(([id, name]) => ({ id: id as Look["steeringWheel"], name }))} onChange={steeringWheel => change({ steeringWheel })} />
    <Choice label="Schaltknauf" value={look.shiftKnob} options={Object.entries(shiftNames).map(([id, name]) => ({ id: id as Look["shiftKnob"], name }))} onChange={shiftKnob => change({ shiftKnob })} />
    <p className="studio-caption">Material- und Formstudien für deinen Entwurf.</p>
  </div>;
  return <>
    <div className="parts-category-tabs" role="group" aria-label="Anbauteil-Kategorie">{([{ id: "front", name: "Front", count: 22 }, { id: "rear", name: "Heck", count: 22 }, { id: "extras", name: "Details", count: null }] as const).map(c => <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => { setCategory(c.id); if (c.id === "front") change({ frontBumper: look.frontBumper }); if (c.id === "rear") change({ rearBumper: look.rearBumper }); }}><span>{c.name}</span>{c.count && <small>{c.count}</small>}</button>)}</div>
    {category === "front" && <BumperBrowser value={look.frontBumper} onChange={frontBumper => change({ frontBumper })} color={look.paint} />}
    {category === "rear" && <BumperBrowser value={look.rearBumper} onChange={rearBumper => change({ rearBumper })} rear color={look.paint} />}
    {category === "extras" && <>
      <label className="studio-label">Abschluss und Seitenlinie</label><div className="tuning-toggles">{([{ key: "frontLip", name: "Frontlippe", detail: "Durchgehender dunkler Abschluss" }, { key: "sideSkirts", name: "Schwelleransätze", detail: "Schlanke Linie zwischen den Rädern" }] as const).map(p => <button type="button" key={p.key} aria-pressed={look[p.key]} onClick={() => change({ [p.key]: !look[p.key] })}><span><strong>{p.name}</strong><small>{p.detail}</small></span><b>{look[p.key] ? "− Abnehmen" : "+ Anbauen"}</b></button>)}</div>
      <Choice label="Heckspoiler" value={look.spoiler} options={[{ id: "none", name: "Ohne Spoiler" }, { id: "lip", name: "Dezente Lippe" }, { id: "ducktail", name: "Ducktail" }]} onChange={spoiler => change({ spoiler })} />
      <Choice label="Spiegelkappen" value={look.mirrors} options={[{ id: "body", name: "Wagenfarbe" }, { id: "black", name: "Schwarz" }]} onChange={mirrors => change({ mirrors })} />
    </>}
    <p className="studio-caption">Eigene Designstudien. Passende Kaufteile lassen sich anschließend separat suchen.</p>
  </>;
}
