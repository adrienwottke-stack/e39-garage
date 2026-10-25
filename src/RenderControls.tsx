import {
  Camera,
  Download,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import {
  defaultRender,
  environments,
  exportSize,
  formats,
  type RenderSettings,
} from "./render-domain";
import type {CameraView} from './studio-domain';

export type RenderResult = {
  url: string;
  blob: Blob;
  name: string;
  width: number;
  height: number;
};
type Props = {
  settings: RenderSettings;
  onChange: (patch: Partial<RenderSettings>) => void;
  camera: string;
  onCamera: (camera: CameraView) => void;
  ready: boolean;
  rendering: boolean;
  exportingScene:boolean;
  onExportScene:()=>void;
  onRender: () => void;
  result: RenderResult | null;
  onSave: () => void;
  saving: boolean;
  onDownload: () => void;
  error: string;
};
export default function RenderControls(p: Props) {
  const { width, height } = exportSize(p.settings);
  return (
    <div className="render-controls">
      <div className="render-panel-intro">
        <span className="studio-kicker">DEIN E39 IM FOTOSTUDIO</span>
        <h2>Mach ein Bild draus.</h2>
        <p>Look wählen. Licht setzen. Perspektive finden.</p>
        <p className="render-orbit-help">
          Am Bild ziehen zum Drehen. Mit dem Mausrad oder zwei Fingern zoomen.
        </p>
      </div>
      <details className="render-hq">
        <summary>Hochwertiger mit Blender / Cycles</summary>
        <p className="studio-caption">Exportiere diesen Look und die aktuelle Kamera für eine lokale Lichtberechnung mit Cycles. Blender ist kostenlos. ZIP entpacken und die enthaltene render.ps1 mit Blender 4.5 starten; das Ergebnis ist eine PNG-Datei.</p>
        <button className="studio-secondary full" disabled={!p.ready||p.rendering||p.exportingScene||p.settings.environment!=='workshop'} onClick={p.onExportScene}>
          {p.exportingScene?'3D-Paket wird erstellt …':'Cycles-Paket herunterladen'}
        </button>
        {p.settings.environment!=='workshop'&&<p className="studio-caption">Für das Cycles-Paket bitte die Tuning-Garage wählen.</p>}
        <p className="studio-caption">Die Ausgabe verwendet dieselbe Fahrzeuggeometrie. Cycles ergänzt echte Lichtreflexionen und Eigenverschattung; Modellgrenzen bleiben sichtbar. Es werden keine persönlichen Fahrzeugdaten oder Fotos exportiert.</p>
      </details>
      <div className="render-export">
        <div>
          <Camera size={17} />
          <span>
            <strong>
              {width.toLocaleString("de-DE")} × {height.toLocaleString("de-DE")}
            </strong>
            <small>PNG · ohne Bedienelemente</small>
          </span>
        </div>
        <button
          className="studio-primary"
          disabled={!p.ready || p.rendering}
          onClick={p.onRender}
        >
          {p.rendering ? (
            <LoaderCircle className="render-spin" size={17} />
          ) : (
            <Download size={17} />
          )}{" "}
          {p.rendering
            ? "Bild wird gerendert …"
            : "Bild rendern & herunterladen"}
        </button>
      </div>
      <fieldset disabled={p.rendering}>
        <legend className="sr-only">Bildeinstellungen</legend>
        <label className="studio-label">Lichtstimmung</label>
        <div className="environment-options">
          {environments.map((e) => (
            <button
              key={e.id}
              aria-pressed={p.settings.environment === e.id}
              onClick={() => p.onChange({ environment: e.id })}
            >
              <i style={{ background: e.color }} />
              <span>
                <strong>{e.name}</strong>
                <small>{e.detail}</small>
              </span>
            </button>
          ))}
        </div>
        <label className="studio-label">Perspektive</label>
        <div className="render-segments render-camera-segments">
          {[
            { id: "front", name: "Vorne" },
            { id: "side", name: "Seite" },
            { id: "rear", name: "Hinten" },
            { id: "wheel", name: "Rad" },
            { id: "interior", name: "Cockpit" },
            { id: "engine", name: "Motorraum" },
          ].map((v) => (
            <button
              key={v.id}
              aria-pressed={p.camera === v.id}
              onClick={() =>
                p.onCamera(
                  v.id as CameraView,
                )
              }
            >
              {v.name}
            </button>
          ))}
        </div>
        <label className="studio-label">Kameralook</label>
        <div className="render-segments">
          {([35, 50, 85] as const).map((f) => (
            <button
              key={f}
              aria-pressed={p.settings.focal === f}
              onClick={() => p.onChange({ focal: f })}
            >
              {f} mm
            </button>
          ))}
        </div>
        <p className="studio-caption">
          35 mm zeigt mehr Raum. 85 mm verdichtet die Perspektive.
        </p>
        <label className="render-slider">
          Lichtrichtung <output>{p.settings.lightAngle}°</output>
          <input
            aria-label="Lichtrichtung"
            type="range"
            min={-180}
            max={180}
            step={5}
            value={p.settings.lightAngle}
            onChange={(e) => p.onChange({ lightAngle: Number(e.target.value) })}
          />
        </label>
        <label className="render-slider">
          Helligkeit <output>{p.settings.exposure.toFixed(1)}</output>
          <input
            aria-label="Helligkeit"
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={p.settings.exposure}
            onChange={(e) => p.onChange({ exposure: Number(e.target.value) })}
          />
        </label>
        <label className="render-toggle">
          <input
            type="checkbox"
            checked={p.settings.reflection}
            onChange={(e) => p.onChange({ reflection: e.target.checked })}
          />
          Spiegelnder Studioboden
        </label>
        {p.settings.environment === "workshop" && <p className="studio-caption">Matter Werkstattboden oder eine dezente Bodenreflexion für dein Foto.</p>}
        <label className="studio-label">Bildformat</label>
        <div className="render-formats">
          {formats.map((f) => (
            <button
              key={f.id}
              aria-pressed={p.settings.format === f.id}
              onClick={() => p.onChange({ format: f.id })}
            >
              <i style={{ aspectRatio: f.ratio }} />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
        <label className="studio-label">Bildgröße</label>
        <div className="render-segments">
          <button
            aria-pressed={p.settings.quality === "hd"}
            onClick={() => p.onChange({ quality: "hd" })}
          >
            Standard
          </button>
          <button
            aria-pressed={p.settings.quality === "large"}
            onClick={() => p.onChange({ quality: "large" })}
          >
            Groß · bis 4K
          </button>
        </div>
      </fieldset>
      {p.error && (
        <p className="studio-error" role="alert">
          {p.error}
        </p>
      )}
      {p.result && (
        <figure className="render-result">
          <img src={p.result.url} alt="Zuletzt gerenderte Ansicht deines E39" />
          <figcaption>
            Dein letztes Bild · {p.result.width} × {p.result.height}
          </figcaption>
          <button className="studio-link" onClick={p.onDownload}>
            <Download size={15} />
            Noch einmal herunterladen
          </button>
          <button
            className="studio-secondary full"
            disabled={p.saving || p.rendering}
            onClick={p.onSave}
          >
            <ImagePlus size={16} />
            {p.saving ? "Wird abgelegt …" : "In Unterlagen ablegen"}
          </button>
        </figure>
      )}
      <button
        className="studio-link"
        disabled={p.rendering}
        onClick={() => p.onChange(defaultRender())}
      >
        <RotateCcw size={14} />
        Studiolicht zurücksetzen
      </button>
      <p className="studio-caption">
        Das Bild entsteht direkt aus deinem 3D-Look. Die Fahrzeugdetails
        entsprechen dem aktuellen Referenzmodell. Große Bilder können auf dem
        Handy etwas länger dauern.
      </p>
    </div>
  );
}
