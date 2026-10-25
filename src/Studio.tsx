import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FolderOpen,
  ImagePlus,
  Layers,
  Paintbrush,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { currentReading, formatDate, uid, type Garage } from "./domain";
import { createLookProject } from "./studio-actions";
import {
  baselineLook,
  differences,
  finishNames,
  lookSchema,
  lookSummary,
  lookIdeas,
  photoLook,
  saveLookDraft,
  wheelFinishes,
  wheelStyles,
  type CameraView,
  type Look,
} from "./studio-domain";
import { getLocalFile, readDraft, saveDraft, supabase } from "./repository";
import { download } from "./backup";
import "./studio.css";
import "./catalog.css";
import { rememberCatalogItem } from "./catalog-actions";
import type { CatalogCategory, CatalogItem } from "./catalog-domain";
import PartsSearch from "./PartsSearch";
import TuningControls from "./TuningControls";
import RenderControls, { type RenderResult } from "./RenderControls";
import {
  defaultRender,
  renderSchema,
  exportSize,
  formats,
  renderFilename,
  type RenderSettings,
  type Capture,
} from "./render-domain";
import "./render.css";
import "./garage-ui.css";
import type { ExportBlender } from './export-blender';
const CatalogPanel = lazy(() => import("./CatalogPanel"));
const VehicleScene = lazy(() => import("./VehicleScene"));
type Category =
  "wheels" | "height" | "paint" | "details" | "bodykit" | "interior";
type Panel = "design" | "record" | "photos" | "project";
type View = "work" | "baseline" | "A" | "B";
type Props = {
  garage: Garage;
  busy: boolean;
  draftKey: string;
  onCommit: (next: Garage, revision: number) => Promise<Garage>;
  onNotice: (text: string) => void;
  onRecords: () => void;
  onHistory: (component: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDocuments: () => void;
  onPlan: () => void;
};
const categories: { id: Category; name: string; icon: typeof Circle }[] = [
  { id: "wheels", name: "Räder", icon: Circle },
  { id: "height", name: "Höhe", icon: SlidersHorizontal },
  { id: "paint", name: "Lack", icon: Paintbrush },
  { id: "bodykit", name: "Anbauteile", icon: Wrench },
  { id: "interior", name: "Innenraum", icon: Layers },
  { id: "details", name: "Details", icon: Sparkles },
];
const colors = [
  { hex: "#254b87", name: "Blau" },
  { hex: "#191f27", name: "Schwarz" },
  { hex: "#c0c6ce", name: "Silber" },
  { hex: "#e2e3df", name: "Weiß" },
  { hex: "#224c43", name: "Dunkelgrün" },
  { hex: "#5c2432", name: "Bordeaux" },
  { hex: "#59606b", name: "Stahlgrau" },
  { hex: "#6c8292", name: "Gletscherblau" },
  { hex: "#133968", name: "Nachtblau" },
  { hex: "#785d7b", name: "Violett" },
  { hex: "#a63d30", name: "Rot" },
  { hex: "#ce9662", name: "Kupfer" },
];
const categoryComponent = {
  wheels: "wheels",
  height: "suspension",
  paint: "body",
  details: "body",
  bodykit: "body",
  interior: "body",
};
function RimIcon({ style }: { style: Look["wheelStyle"] }) {
  const design = wheelStyles.find((wheel) => wheel.id === style);
  const count = design ? design.spokes / design.split : 5;
  const profile = design?.profile ?? "straight";
  const split = design?.split === 2;
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <circle
        cx="36"
        cy="36"
        r="31"
        fill="#111820"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="36"
        cy="36"
        r="26"
        fill="none"
        stroke="currentColor"
        opacity=".5"
      />
      {profile === "disc" && <circle cx="36" cy="36" r="23" fill="currentColor" opacity=".7" />}
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`rotate(${(i * 360) / count} 36 36)`}>
          <path
            d={
              profile === "photo"
                ? "M33 32 Q33 23 25 12 L28 10 Q35 20 36 31 M39 32 Q39 23 47 12 L44 10 Q37 20 36 31"
                : split && profile === "straight"
                ? "M33 32 L29 12 L33 10 L36 32 M39 32 L43 12 L39 10 L36 32"
                : profile === "mesh"
                  ? "M34 33 L24 12 M38 33 L48 12"
                  : profile === "y"
                    ? "M36 32 L36 23 M36 23 L29 12 M36 23 L43 12"
                    : profile === "blade"
                      ? "M35 32 Q27 21 32 11 L39 11 Q32 21 38 32 Z"
                      : profile === "disc" || profile === "slot"
                        ? "M33 14 L39 14 L39 20 L33 20 Z"
                  : "M36 32 L36 10"
            }
            fill={profile === "blade" ? "currentColor" : profile === "disc" || profile === "slot" ? "#111820" : "none"}
            stroke={profile === "disc" || profile === "slot" ? "#111820" : "currentColor"}
            strokeWidth={count > 12 ? 1.6 : 2.5}
          />
        </g>
      ))}
      <circle cx="36" cy="36" r="7" fill="#1a2532" stroke="currentColor" />
    </svg>
  );
}
function Swatches({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="studio-swatches" role="group" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c.hex}
          type="button"
          aria-label={`${label}: ${c.name}`}
          aria-pressed={value === c.hex}
          title={c.name}
          style={{ "--swatch": c.hex } as React.CSSProperties}
          onClick={() => onChange(c.hex)}
        >
          {value === c.hex && <Check size={16} />}
        </button>
      ))}
      <label className="custom-color" title="Eigene Farbe">
        <span>+</span>
        <input
          type="color"
          aria-label={`${label}: eigene Farbe`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
function Photos({
  garage,
  onUpload,
  onDocuments,
}: {
  garage: Garage;
  onUpload: Props["onUpload"];
  onDocuments: () => void;
}) {
  const [images, setImages] = useState<
      { id: string; name: string; url: string }[]
    >([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const docs = garage.documents
    .filter((d) => d.mime.startsWith("image/"))
    .slice(0, 6);
  const docKey = docs.map((d) => d.id).join(":");
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setLoading(true);
    setError("");
    void Promise.all(
      docs.map(async (doc) => {
        let blob: Blob | undefined;
        if (doc.location === "local") blob = await getLocalFile(doc.id);
        else {
          const result = await supabase?.storage
            .from("e39-documents")
            .download(doc.path);
          if (result?.error) throw result.error;
          blob = result?.data ?? undefined;
        }
        if (!blob) throw new Error("Ein Foto konnte nicht geladen werden.");
        const url = URL.createObjectURL(blob);
        urls.push(url);
        if (cancelled) URL.revokeObjectURL(url);
        return { id: doc.id, name: doc.name, url };
      }),
    )
      .then((result) => {
        if (!cancelled) setImages(result);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Fotos gerade nicht erreichbar. Öffne die Unterlagen oder lade ein Foto erneut.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // Only file identities change the loaded images; no scene settings do.
  }, [docKey]);
  return (
    <div className="studio-photo-panel">
      <p className="studio-kicker">DEIN WAGEN ALS REFERENZ</p>
      <h2>So steht er da.</h2>
      <p>
        Deine Fotos bleiben in deiner Fahrzeugakte. Vergleiche damit
        Proportionen, Farbe und Details.
      </p>
      {loading && <p role="status">Fotos werden geladen …</p>}
      {error && <p role="alert">{error}</p>}
      <div className="reference-gallery">
        {images.map((i) => (
          <a href={i.url} target="_blank" rel="noreferrer" key={i.id}>
            <img src={i.url} alt={i.name} loading="lazy" />
            <span>{i.name}</span>
          </a>
        ))}
      </div>
      {!docs.length && (
        <div className="studio-empty">
          <Camera size={30} />
          <p>
            Front, Seite und Heck helfen dir beim Vergleichen. Füge dein erstes
            Referenzfoto hinzu.
          </p>
        </div>
      )}
      <button className="studio-primary" onClick={() => input.current?.click()}>
        <ImagePlus size={16} />
        Foto hinzufügen
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            await onUpload(file);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Foto konnte nicht gespeichert werden.",
            );
          }
        }}
      />
      <button className="studio-link" onClick={onDocuments}>
        Alle Unterlagen öffnen <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
export default function Studio({
  garage,
  busy,
  draftKey,
  onCommit,
  onNotice,
  onRecords,
  onHistory,
  onUpload,
  onDocuments,
  onPlan,
}: Props) {
  const baseline = baselineLook(garage.profile, garage.studio);
  const [look, setLook] = useState<Look>(() => baseline),
    [view, setView] = useState<View>("work"),
    [category, setCategory] = useState<Category>("wheels"),
    [panel, setPanel] = useState<Panel>("design"),
    [camera, setCamera] = useState<CameraView>("front"),
    [reset, setReset] = useState(0),
    [name, setName] = useState("Mein Garage-Look"),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [captureReady, setCaptureReady] = useState(false),
    [product, setProduct] = useState(""),
    [url, setUrl] = useState(""),
    [price, setPrice] = useState(""),
    [partNumber, setPartNumber] = useState("");
  const [mode, setMode] = useState<"design" | "render">("design");
  const [renderSettings, setRenderSettings] =
    useState<RenderSettings>(defaultRender);
  const [renderReady, setRenderReady] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [exportingScene,setExportingScene]=useState(false);
  const sceneExporter=useRef<ExportBlender|null>(null);
  const registerExporter=useCallback((fn:ExportBlender|null)=>{sceneExporter.current=fn;},[]);
  async function downloadScene(){
    if(!sceneExporter.current||exportingScene)return;
    setExportingScene(true);setRenderError('');
    try{download(await sceneExporter.current(renderSettings),'E39-Cycles-Paket.zip');onNotice('Dein Look als Cycles-Paket exportiert. ZIP entpacken und lokal mit Blender rendern.');}
    catch(error){setRenderError(error instanceof Error?error.message:'Die Szene konnte nicht exportiert werden.');}
    finally{setExportingScene(false);}
  }
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState("");
  const [savingRender, setSavingRender] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const revision = useRef(garage.revision),
    pending = useRef(false),
    capture = useRef<Capture | null>(null);
  const [catalogCategory, setCatalogCategory] =
    useState<CatalogCategory | null>(null);
  function openCatalog(value: CatalogCategory) {
    setCatalogCategory(value);
    document.querySelector(".parts-catalog")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  function showCatalogSelection(selector: string) {
    requestAnimationFrame(() => {
      document.querySelector(selector)?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
  }
  const projectId = useRef(uid()),
    studioIdentity = useRef(JSON.stringify(garage.studio));
  const scratch = useRef({ look, name, product, url, price, partNumber });
  scratch.current = { look, name, product, url, price, partNumber };
  useEffect(() => {
    projectId.current = uid();
  }, [look, name, product, url, price, partNumber]);
  useEffect(() => {
    if (JSON.stringify(garage.studio) === studioIdentity.current)
      revision.current = garage.revision;
  }, [garage.revision, garage.studio]);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const registerCapture = useCallback((fn: Capture | null) => {
    capture.current = fn;
    setCaptureReady(!!fn);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void readDraft(draftKey + ":render-v1")
      .then((d) => {
        if (cancelled) return;
        if (d?.settings) {
          const parsed = renderSchema.safeParse(JSON.parse(d.settings));
          if (parsed.success) setRenderSettings(parsed.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRenderReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!renderReady) return;
    const timer = setTimeout(() => {
      void saveDraft(draftKey + ":render-v1", {
        settings: JSON.stringify(renderSettings),
      }).catch(() =>
        setRenderError(
          "Die Studioeinstellungen konnten auf diesem Gerät nicht gespeichert werden.",
        ),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [draftKey, renderReady, renderSettings]);
  useEffect(() => {
    const url = renderResult?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [renderResult?.url]);
  useEffect(() => {
    let cancelled = false;
    void readDraft(draftKey)
      .then((draft) => {
        if (cancelled) return;
        if (draft?.look) {
          try {
            setLook(lookSchema.parse(JSON.parse(draft.look)));
            setName(draft.name?.slice(0, 60) || "Mein nächster Look");
            setProduct(draft.product?.slice(0, 160) || "");
            setUrl(draft.url?.slice(0, 2000) || "");
            setPrice(draft.price?.slice(0, 30) || "");
            setPartNumber(draft.partNumber?.slice(0, 100) || "");
            if (Number.isSafeInteger(Number(draft.revision)))
              revision.current = Number(draft.revision);
          } catch {
            /* An invalid scratch draft never replaces a saved look. */
          }
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void saveDraft(draftKey, {
        look: JSON.stringify(look),
        name,
        product,
        url,
        price,
        partNumber,
        revision: String(revision.current),
      }).catch(() =>
        setSaveError(
          "Der Zwischenstand konnte nicht auf diesem Gerät gesichert werden.",
        ),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [
    look,
    name,
    product,
    url,
    price,
    partNumber,
    ready,
    draftKey,
    garage.revision,
  ]);
  const shown =
    view === "baseline"
      ? baseline
      : view === "work"
        ? look
        : (garage.studio.drafts.find((d) => d.id === view)?.look ?? look);
  const shownName =
    view === "baseline"
      ? "Ausgangslook"
      : view === "work"
        ? name
        : (garage.studio.drafts.find((d) => d.id === view)?.name ?? name);
  const component = categoryComponent[category];
  const entries = garage.entries
    .filter((e) => e.componentId === component)
    .sort((a, b) => b.date.localeCompare(a.date));
  const changes = differences(baseline, look);
  const editable = view === "work";
  function change(patch: Partial<Look>) {
    setLook((current) => ({ ...current, ...patch }));
    setView("work");
    if (patch.frontBumper !== undefined || patch.frontLip !== undefined) setCamera("front");
    else if (patch.rearBumper !== undefined || patch.spoiler !== undefined) setCamera("rear");
    else if (patch.sideSkirts !== undefined || patch.lowering !== undefined) setCamera("side");
    else if (patch.wheelStyle !== undefined || patch.wheelSize !== undefined || patch.wheelFinish !== undefined || patch.caliper !== undefined) setCamera("wheel");
    else if (patch.interiorTrim !== undefined || patch.upholstery !== undefined || patch.steeringWheel !== undefined || patch.shiftKnob !== undefined) setCamera("interior");
  }
  async function persist(next: Garage, message: string) {
    if (pending.current || busy) return;
    pending.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await onCommit(next, revision.current);
      revision.current = saved.revision;
      studioIdentity.current = JSON.stringify(saved.studio);
      onNotice(message);
      const latest = scratch.current;
      await saveDraft(draftKey, {
        ...latest,
        look: JSON.stringify(latest.look),
        revision: String(saved.revision),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Speichern nicht möglich. Dein Entwurf bleibt erhalten.";
      setSaveError(message);
      onNotice(message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  async function saveSlot(id: "A" | "B") {
    await persist(
      { ...garage, studio: saveLookDraft(garage.studio, id, name, look) },
      `Entwurf ${id} gespeichert.`,
    );
  }
  async function downloadView() {
    if (!capture.current) return;
    try {
      const blob = await capture.current();
      download(
        blob,
        `E39-${shownName.replace(/[^a-zA-Z0-9_-]/g, "-")}-${cameraRef.current}.png`,
      );
      onNotice("3D-Vorschau als PNG gespeichert.");
    } catch {
      onNotice(
        "Das Bild konnte noch nicht erstellt werden. Warte, bis das Modell geladen ist.",
      );
    }
  }
  async function renderImage() {
    if (!capture.current || rendering) return;
    setRendering(true);
    setRenderError("");
    try {
      const size = exportSize(renderSettings),
        filename = renderFilename(shownName, renderSettings);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const blob = await capture.current(size);
      if (!mounted.current) return;
      setRenderResult({
        url: URL.createObjectURL(blob),
        blob,
        name: filename,
        ...size,
      });
      download(blob, filename);
      onNotice(`Bild mit ${size.width} × ${size.height} Pixeln gerendert.`);
    } catch (err) {
      setRenderError(
        err instanceof Error
          ? err.message
          : "Das Bild konnte nicht gerendert werden. Versuche die kleinere Bildgröße.",
      );
    } finally {
      if (mounted.current) setRendering(false);
    }
  }
  async function saveRender() {
    if (!renderResult || savingRender) return;
    setSavingRender(true);
    setRenderError("");
    try {
      await onUpload(
        new File([renderResult.blob], renderResult.name, { type: "image/png" }),
      );
    } catch (err) {
      setRenderError(
        err instanceof Error
          ? err.message
          : "Das Bild konnte nicht abgelegt werden.",
      );
    } finally {
      setSavingRender(false);
    }
  }
  async function createProject() {
    try {
      const next = createLookProject(
        garage,
        look,
        name,
        component,
        projectId.current,
        { name: product, url, price, partNumber },
      );
      if (next === garage) {
        onNotice("Diese Umbauidee ist bereits im Plan.");
        return;
      }
      await persist(
        next,
        "Umbauidee im Plan angelegt. Die Fahrzeughistorie bleibt unverändert.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Der Plan konnte nicht angelegt werden.";
      setSaveError(message);
      onNotice(message);
    }
  }
  function selectPart(id: string) {
    const next: Category =
      id === "wheels" || id === "brakes"
        ? "wheels"
        : id === "suspension"
          ? "height"
          : camera === "interior"
            ? "interior"
            : "bodykit";
    setCategory(next);
    setPanel("design");
    if (next === "wheels") setCamera("wheel");
  }
  return (
    <div
      className={`design-studio ${mode === "render" ? "render-mode" : ""} ${rendering ? "is-rendering" : ""}`}
      data-environment={renderSettings.environment}
    >
      <header className="studio-heading">
        <div>
          <p className="studio-kicker">
            BMW E39 · 530i / {mode === "render" ? "FOTOSTUDIO" : "WERKSTATT"}
          </p>
          <h1>
            {mode === "render" ? "Dein Look im Licht." : "Tuning-Garage."}
          </h1>
        </div>
        <button
          className="catalog-open-button"
          onClick={() =>
            openCatalog(category === "bodykit" ? "lip" : "wheels")
          }
        >
          <Sparkles size={16} />
          Händlerangebote
        </button>
        <button
          className="studio-secondary"
          aria-label="Fahrzeugakte öffnen"
          onClick={onRecords}
        >
          <FolderOpen size={16} />
          <span>Fahrzeugakte</span>
          <ArrowUpRight size={14} />
        </button>
      </header>
      <div className="studio-mode-bar">
        <div role="group" aria-label="Studiomodus">
          <button
            disabled={rendering}
            aria-pressed={mode === "design"}
            onClick={() => setMode("design")}
          >
            <SlidersHorizontal size={16} />
            Umbauen
          </button>
          <button
            disabled={rendering}
            aria-pressed={mode === "render"}
            onClick={() => setMode("render")}
          >
            <Camera size={16} />
            Foto & 4K
          </button>
        </div>
        <span>
          {mode === "render"
            ? "Dein Look. Dein Licht. Dein Bild."
            : "Teile wählen. Direkt am Wagen sehen."}
        </span>
      </div>
      {mode === "design" && (
        <details className="garage-presets">
        <summary><Sparkles size={14} /> Look-Ideen ausprobieren <ChevronRight size={14} /></summary>
        <section className="studio-ideas" aria-label="Look-Ideen">
          <div>
            <span className="studio-kicker">EINEN LOOK AUSPROBIEREN</span>
            <p>Deine Entwürfe A und B bleiben erhalten.</p>
          </div>
          <div>
            {lookIdeas(baseline).map((idea) => (
              <button
                key={idea.id}
                aria-label={`Look-Idee ${idea.name}`}
                onClick={() => {
                  setLook({ ...idea.look });
                  setName(idea.name);
                  setView("work");
                  setCategory("wheels");
                  setPanel("design");
                }}
              >
                <i style={{ background: idea.look.paint }} />
                <RimIcon style={idea.look.wheelStyle} />
                <span>
                  <strong>{idea.name}</strong>
                  <small>{idea.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
        </details>
      )}
      <div className="studio-workspace">
        <section
          className="studio-viewport"
          aria-label={mode === "render" ? "Render-Vorschau" : "E39 gestalten"}
          style={
            mode === "render"
              ? {
                  aspectRatio: formats.find(
                    (f) => f.id === renderSettings.format,
                  )!.ratio,
                }
              : undefined
          }
        >
          <div className="studio-scene-label">
            <span className="studio-live-dot" />
            <span>{shownName}</span>
            <span className="studio-preview-label">3D-DESIGNSTUDIE</span>
          </div>
          <div className="studio-wordmark" aria-hidden="true">
            530<span>i</span>
            <small>E39 · DEINE LIMOUSINE</small>
          </div>
          <Suspense
            fallback={
              <div className="studio-loading">Dein E39 wird geladen …</div>
            }
          >
            <VehicleScene
              selected={
                category === "wheels"
                  ? "wheels"
                  : category === "height"
                    ? "suspension"
                    : "body"
              }
              onSelect={selectPart}
              hood={camera === "engine"}
              explode={false}
              paint={shown.paint}
              hoodPaint={shown.hoodPaint}
              look={shown}
              studio
              renderMode={mode === "render"}
              renderSettings={
                mode === "render"
                  ? renderSettings
                  : {
                      ...renderSettings,
                      environment: "workshop",
                      reflection: false,
                    }
              }
              cameraView={camera}
              reset={reset}
              onCaptureReady={registerCapture}
              onExportReady={registerExporter}
            />
          </Suspense>
          <div
            className="studio-cameras"
            role="group"
            aria-label="Kameraperspektive"
          >
            {(
              [
                { id: "front", name: "Vorne" },
                { id: "side", name: "Seite" },
                { id: "rear", name: "Hinten" },
                { id: "wheel", name: "Rad" },
                { id: "interior", name: "Cockpit" },
                { id: "engine", name: "Motorraum" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                onClick={() => setCamera(v.id)}
                aria-pressed={camera === v.id}
                aria-label={v.name}
              >
                {v.id==='engine'?<><span className="camera-engine-full">Motorraum</span><span className="camera-engine-short" aria-hidden="true">Motor</span></>:v.name}
              </button>
            ))}
            <button
              aria-label="Ansicht zurücksetzen"
              onClick={() => {
                setCamera("front");
                setReset((n) => n + 1);
              }}
            >
              <RotateCcw size={15} />
            </button>
            <button
              aria-label="3D-Ansicht als PNG herunterladen"
              title="Ansicht als PNG"
              disabled={!captureReady}
              onClick={downloadView}
            >
              <Download size={16} />
            </button>
          </div>
          <div
            className="studio-view-switch"
            role="group"
            aria-label="Look vergleichen"
          >
            <button
              className={view === "baseline" ? "active" : ""}
              onClick={() => setView("baseline")}
            >
              Ausgangslook
            </button>
            <button
              className={view === "work" ? "active" : ""}
              onClick={() => setView("work")}
            >
              In Arbeit
            </button>
            {garage.studio.drafts.map((d) => (
              <button
                key={d.id}
                className={view === d.id ? "active" : ""}
                onClick={() => setView(d.id)}
              >
                Entwurf {d.id}
              </button>
            ))}
          </div>
          <div className="studio-stage-hint">
            Ziehen zum Drehen · Scrollen zum Zoomen · Teile anklicken
          </div>
        </section>
        <aside
          className="studio-controls"
          aria-label="Gestaltungseinstellungen"
        >
          {mode === "render" ? (
            <>
              <div className="render-look-picker">
                <label htmlFor="render-look">
                  Deinen Look ins Studio holen
                </label>
                <select
                  id="render-look"
                  value={view}
                  disabled={rendering}
                  onChange={(e) => setView(e.target.value as View)}
                >
                  <option value="work">In Arbeit · {name}</option>
                  <option value="baseline">Ausgangslook</option>
                  {garage.studio.drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <RenderControls
                settings={renderSettings}
                onChange={(patch) =>
                  setRenderSettings((current) =>
                    renderSchema.parse({ ...current, ...patch }),
                  )
                }
                camera={camera}
                onCamera={setCamera}
                ready={captureReady && renderReady}
                rendering={rendering}
                  exportingScene={exportingScene}
                  onExportScene={()=>void downloadScene()}
                onRender={() => void renderImage()}
                result={renderResult}
                onSave={() => void saveRender()}
                saving={savingRender}
                onDownload={() => {
                  if (renderResult)
                    download(renderResult.blob, renderResult.name);
                }}
                error={renderError}
              />
            </>
          ) : (
            <>
              <div
                className="studio-panel-tabs"
                role="group"
                aria-label="Detailbereich"
              >
                <button
                  aria-pressed={panel === "design"}
                  onClick={() => setPanel("design")}
                >
                  Gestalten
                </button>
                <button
                  aria-pressed={panel === "record"}
                  onClick={() => setPanel("record")}
                >
                  Bauteilakte
                </button>
                <button
                  aria-pressed={panel === "photos"}
                  onClick={() => setPanel("photos")}
                >
                  <Camera size={14} />
                  Fotos
                </button>
              </div>
              {panel === "design" && (
                <>
                  <div className="studio-control-heading">
                    <p className="studio-kicker">TEILE AUSWÄHLEN</p>
                    <h2>{categories.find((c) => c.id === category)!.name}</h2>
                    <p>
                      {category === "wheels"
                        ? "Eine andere Felge verändert den ganzen Auftritt."
                        : category === "height"
                          ? "Finde die Proportionen, die dir gefallen."
                          : category === "paint"
                            ? "Dein Blau behalten oder etwas Neues ausprobieren."
                            : category === "bodykit"
                              ? "Front und Heck durchschalten. Die Kamera folgt deiner Auswahl."
                              : category === "interior"
                                ? "Lenkrad, Schaltknauf, Leisten und Polster zusammenstellen."
                                : "Licht, Zierleisten und Bremsen abstimmen."}
                    </p>
                  </div>
                  {!editable && (
                    <div className="studio-comparison-note">
                      <Layers size={16} />
                      <p>
                        Du vergleichst gerade <strong>{shownName}</strong>. Die
                        Kamera bleibt dabei gleich.
                      </p>
                      <p>{lookSummary(shown)}</p>
                      <button
                        onClick={() => {
                          setLook({ ...shown });
                          setView("work");
                        }}
                      >
                        Diesen Look bearbeiten
                      </button>
                    </div>
                  )}
                  <fieldset
                    className="studio-fields"
                    disabled={!editable || !ready}
                  >
                    {(category === "bodykit" || category === "interior") && (
                      <TuningControls
                        look={look}
                        change={change}
                        interior={category === "interior"}
                      />
                    )}
                    {category === "wheels" && (
                      <>
                        <div className="garage-part-stepper" role="group" aria-label="Felgendesign wechseln">
                          <button aria-label="Vorherige Felge" onClick={() => { const i = wheelStyles.findIndex((w) => w.id === look.wheelStyle); change({ wheelStyle: wheelStyles[(i - 1 + wheelStyles.length) % wheelStyles.length].id }); }}><ChevronLeft size={20} /></button>
                          <span><strong>{wheelStyles.find((w) => w.id === look.wheelStyle)?.name}</strong><small>{wheelStyles.findIndex((w) => w.id === look.wheelStyle) + 1} / {wheelStyles.length} Designs</small></span>
                          <button aria-label="Nächste Felge" onClick={() => { const i = wheelStyles.findIndex((w) => w.id === look.wheelStyle); change({ wheelStyle: wheelStyles[(i + 1) % wheelStyles.length].id }); }}><ChevronRight size={20} /></button>
                        </div>
                        <div className="rim-options">
                          {wheelStyles.map((w) => (
                            <button
                              key={w.id}
                              className={
                                look.wheelStyle === w.id ? "selected" : ""
                              }
                              aria-pressed={look.wheelStyle === w.id}
                              onClick={() => change({ wheelStyle: w.id })}
                            >
                              <RimIcon style={w.id} />
                              <span>{w.name}</span>
                              {look.wheelStyle === w.id && <Check size={14} />}
                            </button>
                          ))}
                        </div>
                        <p className="studio-caption">
                          {
                            wheelStyles.find((w) => w.id === look.wheelStyle)!
                              .detail
                          }
                        </p>
                        <label className="studio-label">Felgenoberfläche</label>
                        <div className="finish-options">
                          {(["silver", "graphite", "bronze"] as const).map(
                            (f) => (
                              <button
                                key={f}
                                aria-pressed={look.wheelFinish === f}
                                onClick={() => change({ wheelFinish: f })}
                              >
                                <i style={{ background: wheelFinishes[f] }} />
                                {finishNames[f]}
                              </button>
                            ),
                          )}
                        </div>
                        <label className="studio-label">Optische Größe</label>
                        <div className="studio-segmented">
                          {([17, 18, 19] as const).map((size) => (
                            <button
                              key={size}
                              aria-pressed={look.wheelSize === size}
                              onClick={() => change({ wheelSize: size })}
                            >
                              {size} Zoll
                            </button>
                          ))}
                        </div>
                        <p className="studio-caption">
                          Eigene Felgendesigns. Größen und Reifenproportionen
                          dienen der Vorschau; reale Raddaten sind noch
                          unbestätigt.
                        </p>
                      </>
                    )}
                    {category === "height" && (
                      <>
                        <div className="height-value">
                          <strong>
                            {look.lowering === 0 ? "0" : `−${look.lowering}`}
                            <small>mm</small>
                          </strong>
                          <span>zur Modell-Ausgangshöhe</span>
                        </div>
                        <input
                          className="studio-range"
                          type="range"
                          aria-label="Optische Tieferlegung in Millimetern"
                          min="0"
                          max="55"
                          step="5"
                          value={look.lowering}
                          onChange={(e) =>
                            change({ lowering: Number(e.target.value) })
                          }
                        />
                        <div className="range-endpoints">
                          <span>Ausgangshöhe</span>
                          <span>−55 mm</span>
                        </div>
                        <div className="studio-segmented">
                          {[0, 20, 35, 50].map((mm) => (
                            <button
                              key={mm}
                              aria-pressed={look.lowering === mm}
                              onClick={() => change({ lowering: mm })}
                            >
                              {mm ? "−" + mm + " mm" : "0 mm"}
                            </button>
                          ))}
                        </div>
                        <p className="studio-caption">
                          Optische Annäherung. Aus der Darstellung lassen sich
                          weder Freigängigkeit noch eine reale
                          Fahrwerkseinstellung ableiten.
                        </p>
                      </>
                    )}
                    {category === "paint" && (
                      <>
                        <label className="studio-label">Karosserie</label>
                        <Swatches
                          value={look.paint}
                          label="Karosseriefarbe"
                          onChange={(paint) => change({ paint })}
                        />
                        <label className="studio-label">Motorhaube</label>
                        <Swatches
                          value={look.hoodPaint}
                          label="Haubenfarbe"
                          onChange={(hoodPaint) => change({ hoodPaint })}
                        />
                        <button
                          className="studio-secondary full"
                          onClick={() => change({ hoodPaint: look.paint })}
                        >
                          <Check size={15} />
                          Haube in Karosseriefarbe
                        </button>
                        <label className="studio-label">Oberfläche</label>
                        <div className="studio-segmented">
                          <button
                            aria-pressed={look.finish === "gloss"}
                            onClick={() => change({ finish: "gloss" })}
                          >
                            Glänzend
                          </button>
                          <button
                            aria-pressed={look.finish === "satin"}
                            onClick={() => change({ finish: "satin" })}
                          >
                            Seidenmatt
                          </button>
                        </div>
                        <p className="studio-caption">
                          Bildschirmfarben sind Näherungen. Dein echter Lackcode
                          ist noch nicht erfasst.
                        </p>
                      </>
                    )}
                    {category === "details" && (
                      <>
                        <label className="studio-label">
                          Nieren & Zierleisten
                        </label>
                        <div className="studio-segmented">
                          <button
                            aria-pressed={look.trim === "black"}
                            onClick={() => change({ trim: "black" })}
                          >
                            Schwarz
                          </button>
                          <button
                            aria-pressed={look.trim === "chrome"}
                            onClick={() => change({ trim: "chrome" })}
                          >
                            Chrom
                          </button>
                        </div>
                        <label className="studio-label">Bremssattelfarbe</label>
                        <div className="studio-segmented">
                          {(
                            [
                              { id: "graphite", name: "Dezent" },
                              { id: "red", name: "Rot" },
                              { id: "blue", name: "Blau" },
                            ] as const
                          ).map((c) => (
                            <button
                              key={c.id}
                              aria-pressed={look.caliper === c.id}
                              onClick={() => change({ caliper: c.id })}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                        <label className="studio-label">Lichtansicht</label>
                        <button
                          className="studio-secondary full"
                          aria-pressed={look.lights}
                          onClick={() => change({ lights: !look.lights })}
                        >
                          {look.lights
                            ? "Scheinwerfer ausschalten"
                            : "Scheinwerfer einschalten"}
                        </button>
                        <p className="studio-caption">
                          Gestaltungsoptionen am Referenzmodell. Verbaute
                          Ausstattung und technische Zulässigkeit werden
                          hierdurch nicht bestätigt.
                        </p>
                      </>
                    )}
                  </fieldset>
                  <PartsSearch look={shown} onOpen={openCatalog} />
                  <details className="garage-baseline">
                  <summary>Ausgangslook & Rücksetzen <RotateCcw size={13} /></summary>
                  <div className="studio-reference">
                    <span className="studio-kicker">DEIN AUSGANGSPUNKT</span>
                    <p>
                      {garage.studio.baselineConfirmed
                        ? "Dein gespeicherter Ausgangslook."
                        : "An deinen Fotos orientierte Darstellung. Lackcode, Felgentyp und reale Maße bleiben offen."}
                    </p>
                    <div>
                      <button
                        onClick={() => {
                          setLook(photoLook());
                          setName("Mein BMW");
                          setView("work");
                        }}
                      >
                        Garage-Basis laden
                      </button>
                      <button
                        disabled={saving || busy || !editable}
                        onClick={() =>
                          void persist(
                            {
                              ...garage,
                              studio: {
                                ...garage.studio,
                                baseline: { ...look },
                                baselineConfirmed: true,
                              },
                            },
                            "Ausgangslook gespeichert. Keine Wartungsdaten geändert.",
                          )
                        }
                      >
                        Als Ausgangslook speichern
                      </button>
                    </div>
                  </div>
                  </details>
                </>
              )}
              {panel === "record" && (
                <div className="studio-record-panel">
                  <p className="studio-kicker">DEINE FAHRZEUGAKTE</p>
                  <h2>
                    {category === "wheels"
                      ? "Räder & Reifen"
                      : category === "height"
                        ? "Fahrwerk"
                        : "Karosserie & Details"}
                  </h2>
                  <p>
                    Hier stehen dokumentierte Arbeiten an deinem Wagen.
                    Gespeicherte Entwürfe werden erst nach einem tatsächlichen
                    Umbau Teil der Historie.
                  </p>
                  <div className="studio-record-list">
                    {entries.slice(0, 4).map((e) => (
                      <article key={e.id}>
                        <span>{formatDate(e.date)}</span>
                        <strong>{e.title}</strong>
                        <p>{e.note.slice(0, 120)}</p>
                      </article>
                    ))}
                    {!entries.length && (
                      <div className="studio-empty">
                        <Wrench size={26} />
                        <p>
                          Für diese Baugruppe ist noch keine Arbeit
                          dokumentiert.
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    className="studio-secondary full"
                    onClick={() => onHistory(component)}
                  >
                    Historie dieser Baugruppe <ChevronRight size={15} />
                  </button>
                  <button
                    className="studio-primary"
                    onClick={() => setPanel("project")}
                  >
                    Aus dem Look einen Plan machen <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              {panel === "photos" && (
                <Photos
                  garage={garage}
                  onUpload={onUpload}
                  onDocuments={onDocuments}
                />
              )}
              {panel === "project" && (
                <div className="studio-project-panel">
                  <button
                    className="studio-link"
                    onClick={() => setPanel("design")}
                  >
                    <ArrowLeft size={14} />
                    Zurück zum Gestalten
                  </button>
                  <p className="studio-kicker">VOM ENTWURF ZUR IDEE</p>
                  <h2>Dein Umbauplan.</h2>
                  <p>
                    {changes.length
                      ? changes.join(" · ")
                      : "Verändere zuerst deinen Look."}
                  </p>
                  <label className="studio-label" htmlFor="project-product">
                    Konkretes Produkt, falls schon gefunden
                  </label>
                  <input
                    id="project-product"
                    maxLength={160}
                    placeholder="Zum Beispiel: ein bestimmter Felgensatz"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                  />
                  <label className="studio-label" htmlFor="project-url">
                    Produktlink
                  </label>
                  <input
                    id="project-url"
                    type="url"
                    maxLength={2000}
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <div className="project-fields-row">
                    <label>
                      Teilenummer
                      <input
                        maxLength={100}
                        value={partNumber}
                        onChange={(e) => setPartNumber(e.target.value)}
                      />
                    </label>
                    <label>
                      Geschätzter Preis €
                      <input
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="studio-caption">
                    Es wird eine offene Umbauidee angelegt. Ein Produkt landet
                    als ungeprüfter Eintrag in deiner Einkaufsliste. Es wird
                    nichts bestellt und nichts als verbaut markiert.
                  </p>
                  <button
                    className="studio-primary"
                    disabled={saving || busy || !changes.length}
                    onClick={() => void createProject()}
                  >
                    <Wrench size={16} />
                    Umbauidee im Plan anlegen
                  </button>
                  <button className="studio-link" onClick={onPlan}>
                    Zum vorhandenen Plan <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
        <nav className="studio-toolbelt" aria-label="Gestaltungsbereiche">
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={
                  category === c.id && panel === "design" ? "active" : ""
                }
                onClick={() => {
                  setCategory(c.id);
                  setPanel("design");
                  if (c.id === "interior") setCamera("interior");
                  else if (c.id === "height") setCamera("side");
                  else if (c.id === "wheels") setCamera("wheel");
                  else setCamera("front");
                }}
              >
                <Icon size={19} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
      {catalogCategory && (
        <Suspense fallback={<p>Teilekatalog wird geladen …</p>}>
          <CatalogPanel
            key={catalogCategory}
            category={catalogCategory}
            look={look}
            onClose={() => setCatalogCategory(null)}
            onPreview={(item) => {
              if (item.preview) {
                change(item.preview);
                setCamera(item.category === "wheels" ? "wheel" : "front");
                setCatalogCategory(null);
                showCatalogSelection(".studio-viewport");
              }
            }}
            onPlan={(item) => {
              setProduct((item.name + " · " + item.unit).slice(0, 160));
              setUrl(item.url);
              setPartNumber(item.sku);
              setPrice(
                item.offer.stale || item.offer.price === null
                  ? ""
                  : String(item.offer.price),
              );
              setPanel("project");
              setCatalogCategory(null);
              showCatalogSelection(".studio-controls");
            }}
            onRemember={async (item: CatalogItem) => {
              const next = rememberCatalogItem(garage, item);
              if (next !== garage) {
                const saved = await onCommit(next, revision.current);
                revision.current = saved.revision;
              }
              onNotice(
                "Händlerangebot vorgemerkt. Passform und Kauf bleiben offen.",
              );
            }}
          />
        </Suspense>
      )}
      <section
        className="studio-drafts"
        aria-label="Entwürfe speichern und vergleichen"
      >
        <div className="drafts-heading">
          <div>
            <p className="studio-kicker">DEINE ENTWÜRFE</p>
            <h2>Welcher Look bleibt?</h2>
          </div>
          <button
            className="studio-link"
            onClick={() => {
              setPanel("project");
              setView("work");
            }}
          >
            Umbau planen <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="draft-name">
          <label htmlFor="look-name">Name für deinen Entwurf</label>
          <input
            id="look-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span>
            {changes.length
              ? `${changes.length} Änderungen zum Ausgangslook`
              : "Entspricht dem Ausgangslook"}
          </span>
        </div>
        <div className="draft-grid">
          {(["A", "B"] as const).map((id) => {
            const draft = garage.studio.drafts.find((d) => d.id === id);
            return (
              <article key={id} className={view === id ? "active" : ""}>
                <span className="draft-letter">{id}</span>
                <button
                  className="draft-preview"
                  disabled={!draft}
                  aria-label={`Entwurf ${id} vergleichen`}
                  onClick={() => setView(id)}
                >
                  <RimIcon style={draft?.look.wheelStyle ?? "double-five"} />
                  <span>
                    <strong>{draft?.name ?? `Platz für Entwurf ${id}`}</strong>
                    <small>
                      {draft
                        ? lookSummary(draft.look)
                        : "Stelle deinen Look ein und speichere ihn hier."}
                    </small>
                  </span>
                  {draft && <i style={{ background: draft.look.paint }} />}
                </button>
                <button
                  className="draft-save"
                  disabled={saving || busy || !editable || !ready}
                  onClick={() => void saveSlot(id)}
                  aria-label={`Entwurf ${id} ${draft ? "überschreiben" : "speichern"}`}
                >
                  <Save size={15} />
                  {draft ? "Ersetzen" : "Speichern"}
                </button>
              </article>
            );
          })}
        </div>
        <p className="studio-storage-note">
          {saving
            ? "Wird gespeichert …"
            : "Einstellungen bleiben als Zwischenstand auf diesem Gerät. A und B werden mit deiner Garage gespeichert."}
        </p>
        {saveError && (
          <div className="studio-error" role="alert">
            {saveError}
            {revision.current !== garage.revision && (
              <button
                className="studio-link"
                onClick={() => {
                  revision.current = garage.revision;
                  studioIdentity.current = JSON.stringify(garage.studio);
                  setSaveError("");
                }}
              >
                Mit aktuellem Garagenstand weiterarbeiten
              </button>
            )}
          </div>
        )}
      </section>
      <div className="studio-footer">
        <span>Gestalten. Vergleichen. Deinen nächsten Schritt finden.</span>
        <span>
          {currentReading(garage)
            ? `${currentReading(garage)!.km.toLocaleString("de-DE")} km dokumentiert`
            : "Reale Fahrzeugdaten bleiben in deiner Akte."}
        </span>
      </div>
    </div>
  );
}
