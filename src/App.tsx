import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  Droplets,
  FileText,
  History,
  Info,
  ListFilter,
  LoaderCircle,
  Maximize2,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { components, componentById, type ComponentId } from "./components-data";
import {
  completeTask,
  currentReading,
  formatDate,
  formatKm,
  money,
  parseNumber,
  sortedTasks,
  statusLabels,
  taskStatus,
  today,
  uid,
  validateGarage,
  type Entry,
  type Garage,
  type GarageDocument,
  type MaintenanceTask,
  type Part,
  type Profile,
} from "./domain";
import {
  cachedGarage,
  clearDraft,
  clearPrivateCache,
  getLocalFile,
  loadGarage,
  putLocalFile,
  readDraft,
  saveDraft,
  saveGarage,
  supabase,
  type Mode,
} from "./repository";
import {
  download,
  exportGarage,
  readBackup,
  storeImportedFiles,
} from "./backup";
import { baselineLook } from "./studio-domain";
const VehicleScene = lazy(() => import("./VehicleScene"));
const Studio = lazy(() => import("./Studio"));

type Tab = "garage" | "plan" | "history" | "documents";
type DialogKind =
  | "profile"
  | "reading"
  | "entry"
  | "task"
  | "complete"
  | "part"
  | "settings"
  | "credits"
  | "login";
type Dialog = {
  kind: DialogKind;
  component?: string;
  taskId?: string;
  revision?: number;
  operationId?: string;
};
const icons = {
  garage: CarFront,
  plan: Wrench,
  history: History,
  documents: FileText,
};
const tabs: Record<Tab, string> = {
  garage: "Garage",
  plan: "Plan",
  history: "Historie",
  documents: "Unterlagen",
};
const entryLabels = {
  service: "Arbeit",
  observation: "Beobachtung",
  oil: "Öl nachgefüllt",
};
const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
function Badge({ status }: { status: ReturnType<typeof taskStatus> }) {
  return (
    <span className={"badge " + status}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
function Empty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof Wrench;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={27} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
function ComponentSelect({ value }: { value?: string }) {
  return (
    <Field label="Bauteil">
      <select name="componentId" defaultValue={value ?? "overview"}>
        {components.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Dialog schließen"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function DraftForm({
  name,
  onSubmit,
  children,
  busy,
}: {
  name: string;
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
  busy: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    readDraft(name).then((draft) => {
      if (!live || !draft || !ref.current) return;
      for (const [name, value] of Object.entries(draft)) {
        const field = ref.current.elements.namedItem(name);
        if (field instanceof HTMLInputElement && field.type === "checkbox")
          field.checked = value === "on";
        else if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
        )
          field.value = value;
      }
    });
    return () => {
      live = false;
    };
  }, [name]);
  function stash() {
    if (!ref.current) return;
    const data: Record<string, string> = {};
    for (const el of Array.from(ref.current.elements)) {
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        if (el.name)
          data[el.name] =
            el instanceof HTMLInputElement && el.type === "checkbox"
              ? el.checked
                ? "on"
                : "off"
              : el.value;
      }
    }
    void saveDraft(name, data);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
      await clearDraft(name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      );
    }
  }
  return (
    <form ref={ref} onSubmit={submit} onChange={stash}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span>Entwurf bleibt auf diesem Gerät.</span>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}
          Speichern
        </button>
      </div>
    </form>
  );
}
function Stats({
  garage,
  onReading,
}: {
  garage: Garage;
  onReading: () => void;
}) {
  const r = currentReading(garage);
  const open = garage.tasks.filter((t) => !t.done);
  const due = open.filter((t) => taskStatus(t, r?.km) === "due");
  const observations = garage.entries.filter(
    (e) => e.type === "observation" && !e.resolved,
  );
  return (
    <div className="stats-strip">
      <button className="stat reading" onClick={onReading}>
        <span>KILOMETERSTAND</span>
        <strong>
          {formatKm(r?.km)} <small>km</small>
        </strong>
        <em>
          {r ? "Stand " + formatDate(r.date) : "Ersten Stand eintragen"}
          <Plus size={13} />
        </em>
      </button>
      <div className="stat">
        <span>WARTUNG</span>
        <strong className={due.length ? "amber" : ""}>
          {open.length.toString().padStart(2, "0")} <small>offen</small>
        </strong>
        <em>
          {due.length
            ? due.length + " davon fällig"
            : open.length
              ? "Deine nächsten Arbeiten"
              : "Noch kein Wartungsplan"}
        </em>
      </div>
      <div className="stat">
        <span>BEOBACHTUNGEN</span>
        <strong>
          {observations.length.toString().padStart(2, "0")} <small>offen</small>
        </strong>
        <em>
          {observations.length
            ? "Zur Prüfung festgehalten"
            : "Noch nichts eingetragen"}
        </em>
      </div>
    </div>
  );
}
function Timeline({
  entries,
  onResolve,
}: {
  entries: Entry[];
  onResolve: (id: string) => void;
}) {
  return (
    <div className="timeline">
      {[...entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => (
          <article key={e.id} className="timeline-item">
            <div className={"timeline-icon " + e.type}>
              {e.type === "oil" ? (
                <Droplets size={18} />
              ) : e.type === "service" ? (
                <Wrench size={18} />
              ) : (
                <Activity size={18} />
              )}
            </div>
            <div>
              <div className="item-eyebrow">
                {entryLabels[e.type]} · {formatDate(e.date)}
                {e.km !== null ? " · " + formatKm(e.km) + " km" : ""}
              </div>
              <h3>{e.title}</h3>
              {e.note && <p className="preserve-lines">{e.note}</p>}
              <div className="item-meta">
                <span>{componentById(e.componentId).name}</span>
                {e.litres !== null && (
                  <span>{e.litres.toLocaleString("de-DE")} l</span>
                )}
                {e.cost !== null && <span>{money(e.cost)}</span>}
                {e.type === "observation" && (
                  <button
                    className="text-button"
                    onClick={() => onResolve(e.id)}
                  >
                    {e.resolved ? (
                      <>
                        <Check size={14} />
                        Geklärt
                      </>
                    ) : (
                      "Als geklärt markieren"
                    )}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
    </div>
  );
}
function App() {
  const [tab, setTab] = useState<Tab>("garage"),
    [garageView, setGarageView] = useState<"design" | "records">("design"),
    [selected, setSelected] = useState<ComponentId>("overview"),
    [hood, setHood] = useState(false),
    [explode, setExplode] = useState(false),
    [reset, setReset] = useState(0),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [mode, setMode] = useState<Mode>("local"),
    [user, setUser] = useState<User | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [planView, setPlanView] = useState<"tasks" | "parts">("tasks"),
    [historyFilter, setHistoryFilter] = useState("all"),
    [update, setUpdate] = useState(false);
  const client = useQueryClient(),
    importRef = useRef<HTMLInputElement>(null),
    uploadRef = useRef<HTMLInputElement>(null);
  const userId = user?.id ?? "local";
  const key = ["garage", mode, userId];
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    const update = () => setUpdate(true);
    addEventListener("online", on);
    addEventListener("offline", on);
    addEventListener("e39-update-available", update);
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user);
        setMode("cloud");
      }
    });
    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setMode(session ? "cloud" : "local");
    });
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", on);
      removeEventListener("e39-update-available", update);
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await loadGarage(mode, userId);
      } catch (err) {
        if (mode === "cloud" && !navigator.onLine) {
          const cache = await cachedGarage(userId);
          if (cache) return cache;
        }
        throw err;
      }
    },
    refetchInterval: mode === "cloud" && online ? 30000 : false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const garage = query.data;
  async function commit(next: Garage, expectedRevision = garage?.revision) {
    if (busy)
      throw new Error("Bitte warte, bis die laufende Speicherung fertig ist.");
    if (!garage) throw new Error("Fahrzeugakte noch nicht geladen.");
    setBusy(true);
    try {
      const saved = await saveGarage(
        mode,
        next,
        expectedRevision ?? garage.revision,
        userId,
      );
      client.setQueryData(key, saved);
      setNotice(
        mode === "cloud"
          ? "In deiner Garage gespeichert."
          : "Auf diesem Gerät gespeichert.",
      );
      return saved;
    } catch (err) {
      const fresh = await query.refetch();
      setDialog((previous) =>
        previous
          ? { ...previous, revision: fresh.data?.revision ?? previous.revision }
          : previous,
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }
  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Das hat nicht funktioniert.");
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function choose(id: ComponentId) {
    setSelected(id);
    if (
      components.find((c) => c.id === id)?.group === "Motorraum" ||
      id === "engine" ||
      id === "cooling"
    )
      setHood(true);
    if (id !== "oil-filter") setExplode(false);
  }
  const open = (kind: DialogKind, extras: Partial<Dialog> = {}) =>
    setDialog({
      kind,
      component: selected,
      revision: garage?.revision,
      operationId: uid(),
      ...extras,
    });
  async function upload(file: File) {
    if (!garage) return;
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowed.includes(file.type) || file.size > 10485760 || !file.size)
      throw new Error(
        "Bitte JPG, PNG, WebP oder PDF mit maximal 10 MB wählen.",
      );
    const id = uid();
    const path = userId + "/" + id;
    const doc: GarageDocument = {
      id,
      name: file.name,
      mime: file.type as GarageDocument["mime"],
      bytes: file.size,
      date: today(),
      entryId: null,
      path,
      location: mode === "cloud" ? "cloud" : "local",
    };
    if (mode === "cloud") {
      if (!supabase) throw new Error("Online-Verbindung fehlt.");
      const { error } = await supabase.storage
        .from("e39-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
    } else await putLocalFile(id, file);
    try {
      await commit({ ...garage, documents: [doc, ...garage.documents] });
    } catch (err) {
      if (mode === "cloud") {
        const latest = await query.refetch();
        if (latest.data?.documents.some((d) => d.id === id)) return;
        // An unknown write outcome must not remove a file referenced by a committed row.
        if (latest.data && !latest.error)
          await supabase?.storage.from("e39-documents").remove([path]);
      }
      throw err;
    }
  }
  async function getDocument(doc: GarageDocument) {
    if (doc.location === "cloud") {
      const { data, error } = await supabase!.storage
        .from("e39-documents")
        .download(doc.path);
      if (error || !data) throw new Error("Beleg konnte nicht geladen werden.");
      download(data, doc.name);
    } else {
      const blob = await getLocalFile(doc.id);
      if (!blob)
        throw new Error(
          "Dieser Beleg fehlt auf dem Gerät. Bitte aus einer vollständigen ZIP-Sicherung wiederherstellen.",
        );
      download(blob, doc.name);
    }
  }
  async function restore(file: File) {
    if (!garage) return;
    const imported = await readBackup(file);
    if (mode === "cloud")
      throw new Error(
        "Sicherungen bitte im lokalen Modus öffnen. Ein Cloud-Import wird erst nach Prüfung der Belege unterstützt.",
      );
    const files = new Map<string, Blob>();
    const documents = imported.state.documents.map((d) => {
      const id = uid();
      files.set(id, imported.files.get(d.id)!);
      return { ...d, id, location: "local" as const, path: id };
    });
    await storeImportedFiles(files);
    await commit({ ...imported.state, revision: garage.revision, documents });
  }
  const r = garage ? currentReading(garage) : undefined,
    c = componentById(selected);
  const relevantEntries =
    garage?.entries.filter((e) => e.componentId === selected) ?? [];
  const relevantTasks =
    garage?.tasks.filter(
      (t) => !t.done && (selected === "overview" || t.componentId === selected),
    ) ?? [];
  const completion = garage?.tasks.find((t) => t.id === dialog?.taskId);
  const submit = async (data: FormData) => {
    if (!garage || !dialog) return;
    const s = (name: string) => String(data.get(name) ?? "").trim();
    const num = (name: string) => parseNumber(data.get(name));
    const day = s("date") || today();
    let next = garage;
    if (dialog.kind === "profile") {
      const profile: Profile = {
        name: s("name") || "Mein E39",
        year: num("year"),
        gearbox: s("gearbox") as Profile["gearbox"],
        paint: s("paint"),
        hoodPaint: s("hoodPaint"),
        notes: s("notes"),
      };
      next = { ...garage, profile };
    }
    if (dialog.kind === "reading") {
      const km = num("km");
      if (km === null || !Number.isInteger(km))
        throw new Error("Bitte einen ganzen Kilometerstand eintragen.");
      if (day > today())
        throw new Error(
          "Ein gemessener Kilometerstand darf nicht in der Zukunft liegen.",
        );
      next = {
        ...garage,
        readings: [
          ...garage.readings,
          { id: dialog.operationId ?? uid(), date: day, km, note: s("note") },
        ],
      };
    }
    if (dialog.kind === "entry") {
      const type = s("type") as Entry["type"];
      const litres = num("litres");
      if (type === "oil" && (!litres || litres > 20))
        throw new Error(
          "Bitte die nachgefüllte Ölmenge zwischen 0 und 20 Litern angeben.",
        );
      next = {
        ...garage,
        entries: [
          {
            id: dialog.operationId ?? uid(),
            type,
            date: day,
            km: num("km"),
            title: s("title") || (type === "oil" ? "Öl nachgefüllt" : ""),
            note: s("note"),
            componentId: s("componentId"),
            cost: num("cost"),
            litres: type === "oil" ? litres : null,
            resolved: false,
            taskId: null,
          },
          ...garage.entries,
        ],
      };
    }
    if (dialog.kind === "task") {
      const task: MaintenanceTask = {
        id: dialog.operationId ?? uid(),
        title: s("title"),
        componentId: s("componentId"),
        note: s("note"),
        dueDate: s("dueDate") || null,
        dueKm: num("dueKm"),
        intervalMonths: num("intervalMonths"),
        intervalKm: num("intervalKm"),
        source: s("source"),
        done: false,
        completedEntryId: null,
      };
      if ((task.intervalKm || task.intervalMonths) && !task.source)
        throw new Error(
          "Bitte die Quelle des Intervalls eintragen, z. B. Fahrzeugunterlagen oder eigene Festlegung.",
        );
      next = { ...garage, tasks: [...garage.tasks, task] };
    }
    if (dialog.kind === "complete" && completion)
      next = completeTask(garage, completion.id, {
        date: day,
        km: num("km"),
        cost: num("cost"),
        note: s("note"),
      });
    if (dialog.kind === "part") {
      if (s("url") && !safeUrl(s("url")))
        throw new Error(
          "Bitte einen vollständigen http- oder https-Link verwenden.",
        );
      const part: Part = {
        id: dialog.operationId ?? uid(),
        taskId: s("taskId") || null,
        name: s("name"),
        quantity: num("quantity") ?? 1,
        partNumber: s("partNumber"),
        url: s("url"),
        price: num("price"),
        fitChecked: data.get("fitChecked") === "on",
        bought: false,
      };
      next = { ...garage, parts: [...garage.parts, part] };
    }
    validateGarage(next);
    await commit(next, dialog.revision);
    setDialog(null);
  };
  return (
    <div
      className={
        "app-shell" +
        (tab === "garage" && garageView === "design" ? " studio-shell" : "")
      }
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#garage"
          onClick={(e) => {
            e.preventDefault();
            setTab("garage");
            setGarageView("design");
          }}
          aria-label="E39 Garage Start"
        >
          <span className="brand-mark">
            <CarFront size={23} />
          </span>
          <span>
            E39<span className="brand-sub">GARAGE</span>
          </span>
        </a>
        <div className="sidebar-label">DEIN FAHRZEUG</div>
        <nav aria-label="Hauptnavigation">
          {(Object.keys(tabs) as Tab[]).map((id) => {
            const Icon = icons[id];
            return (
              <button
                key={id}
                aria-label={tabs[id]}
                title={tabs[id]}
                className={tab === id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setTab(id);
                  if (id === "garage") setGarageView("design");
                }}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{tabs[id]}</span>
                {id === "plan" && garage?.tasks.some((t) => !t.done) && (
                  <i className="nav-dot" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            aria-label="Einstellungen"
            onClick={() => open("settings")}
          >
            <Settings size={19} />
            <span>Einstellungen</span>
          </button>
          <button className="build-info" onClick={() => open("credits")}>
            <span className="status-dot" />
            TUNING-GARAGE<span>V. 0.11</span>
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Meine Garage <ChevronRight size={13} />
            <span>BMW E39 530i</span>
          </div>
          <button
            className="connection"
            aria-label="Garagen-Einstellungen öffnen"
            onClick={() => open("settings")}
          >
            {mode === "cloud" ? (
              online ? (
                <Cloud size={15} />
              ) : (
                <CloudOff size={15} />
              )
            ) : (
              <span className="local-dot" />
            )}
            <span>
              {mode === "cloud"
                ? online
                  ? "Online-Garage"
                  : "Offline · letzter Stand"
                : "Lokal auf diesem Gerät"}
            </span>
            <ChevronDown size={12} />
          </button>
        </header>
        {update && (
          <div className="update-banner">
            Eine neue Version ist bereit.
            <button
              onClick={() => dispatchEvent(new Event("e39-apply-update"))}
            >
              Jetzt aktualisieren
            </button>
          </div>
        )}
        {!garage ? (
          <div className="loading-page">
            {query.isPending ? (
              <>
                <LoaderCircle className="spin" />
                <p>Deine Garage wird geöffnet …</p>
              </>
            ) : (
              <>
                <CloudOff />
                <h2>Die Akte ist gerade nicht erreichbar.</h2>
                <p>{query.error?.message}</p>
                <button className="button" onClick={() => void query.refetch()}>
                  Erneut laden
                </button>
                {mode === "cloud" && (
                  <button
                    className="text-button"
                    onClick={() => setMode("local")}
                  >
                    Lokale Garage öffnen
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {tab === "garage" && garageView === "records" && (
              <div
                className="garage-view-toggle"
                role="group"
                aria-label="Garagenansicht"
              >
                <button
                  aria-pressed={false}
                  onClick={() => setGarageView("design")}
                >
                  Gestalten
                </button>
                <button aria-pressed={true}>Fahrzeugakte</button>
              </div>
            )}
            {tab === "garage" && garageView === "design" && (
              <Suspense
                fallback={
                  <div className="loading-page">
                    Gestaltungsansicht wird geladen …
                  </div>
                }
              >
                <Studio
                  key={mode + ":" + userId}
                  garage={garage}
                  busy={busy}
                  draftKey={"studio:" + mode + ":" + userId}
                  onCommit={commit}
                  onNotice={setNotice}
                  onRecords={() => setGarageView("records")}
                  onHistory={(component) => {
                    setHistoryFilter(component);
                    setTab("history");
                  }}
                  onUpload={upload}
                  onDocuments={() => setTab("documents")}
                  onPlan={() => setTab("plan")}
                />
              </Suspense>
            )}
            {!(tab === "garage" && garageView === "design") && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      <span /> DEINE MASCHINE. DEINE GESCHICHTE.
                    </div>
                    <h1>
                      {tab === "garage" ? (
                        <>
                          BMW E39 <span>530i</span>
                        </>
                      ) : (
                        tabs[tab]
                      )}
                    </h1>
                    <p>
                      {tab === "garage"
                        ? "Ein Klassiker. Deine ganz eigene Geschichte."
                        : tab === "plan"
                          ? "Was als Nächstes ansteht – und was du dafür brauchst."
                          : tab === "history"
                            ? "Jede Arbeit und jede Beobachtung an einem Ort."
                            : "Rechnungen, Fotos und alles, was zu deinem E39 gehört."}
                    </p>
                  </div>
                  <button
                    className="button subtle profile-button"
                    aria-label="Fahrzeugprofil bearbeiten"
                    onClick={() => open("profile")}
                  >
                    <Settings size={16} />
                    <span>{garage.profile.name}</span>
                  </button>
                </div>
                {tab === "garage" && (
                  <>
                    <Stats garage={garage} onReading={() => open("reading")} />
                    <div className="garage-layout">
                      <section className="vehicle-stage">
                        <div className="stage-header">
                          <span className="eyebrow">01 / FAHRZEUGANSICHT</span>
                          <span className="stage-badge">
                            {hood ? "MOTORRAUM" : "EXTERIEUR"}
                          </span>
                        </div>
                        <div className="stage-title">
                          <span>530i</span>
                          <small>E39 · LIMOUSINE</small>
                        </div>
                        <Suspense
                          fallback={
                            <div className="scene-canvas scene-fallback">
                              3D-Ansicht wird geladen …
                            </div>
                          }
                        >
                          <VehicleScene
                            selected={selected}
                            onSelect={choose}
                            hood={hood}
                            explode={explode}
                            paint={garage.profile.paint}
                            hoodPaint={garage.profile.hoodPaint}
                            look={baselineLook(garage.profile, garage.studio)}
                            reset={reset}
                          />
                        </Suspense>
                        <div className="stage-controls">
                          <button
                            className={"stage-button " + (hood ? "active" : "")}
                            onClick={() => {
                              setHood((v) => !v);
                              setExplode(false);
                            }}
                          >
                            <CarFront size={17} />
                            {hood ? "Haube schließen" : "Motorraum öffnen"}
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => setReset((v) => v + 1)}
                            aria-label="Ansicht zurücksetzen"
                          >
                            <RotateCcw size={18} />
                          </button>
                        </div>
                        <div className="stage-footer">
                          <span>
                            <Maximize2 size={12} />
                            Ziehen zum Drehen · Scrollen zum Zoomen
                          </span>
                          <span>
                            3D-REFERENZMODELL <Info size={12} />
                          </span>
                        </div>
                      </section>
                      <section className="component-panel">
                        <div className="panel-eyebrow">
                          <span className="eyebrow">02 / IM DETAIL</span>
                          <span className="blue-dot" />
                        </div>
                        <select
                          className="component-select"
                          aria-label="Bauteil auswählen"
                          value={selected}
                          onChange={(e) =>
                            choose(e.target.value as ComponentId)
                          }
                        >
                          {["Fahrzeug", "Motorraum"].map((group) => (
                            <optgroup key={group} label={group}>
                              {components
                                .filter((c) => c.group === group)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="component-subtitle">{c.subtitle}</p>
                        <p className="component-description">{c.description}</p>
                        {selected === "oil-filter" && (
                          <button
                            className={
                              "button full " + (explode ? "primary" : "")
                            }
                            onClick={() => setExplode((v) => !v)}
                          >
                            <Maximize2 size={17} />
                            {explode
                              ? "Teile zusammenführen"
                              : "Explosionsansicht öffnen"}
                          </button>
                        )}
                        <div className="component-facts">
                          {c.facts.slice(0, 2).map((f) => (
                            <div key={f}>
                              <ChevronRight size={13} />
                              {f}
                            </div>
                          ))}
                        </div>
                        <div className="panel-divider" />
                        <div className="section-label">
                          DEINE AKTE{" "}
                          <span>
                            {relevantEntries.length.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <div className="component-record">
                          {relevantEntries.length ? (
                            <>
                              <strong>{relevantEntries[0].title}</strong>
                              <span>{formatDate(relevantEntries[0].date)}</span>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setHistoryFilter(selected);
                                  setTab("history");
                                }}
                              >
                                Einträge ansehen <ArrowRight size={14} />
                              </button>
                            </>
                          ) : (
                            <p>
                              Hier ist noch nichts dokumentiert.
                              <br />
                              Der erste Eintrag macht den Anfang.
                            </p>
                          )}
                        </div>
                        <button
                          className="button full"
                          onClick={() => open("entry")}
                        >
                          <Plus size={17} />
                          Eintrag hinzufügen
                        </button>
                        <details className="reference-note">
                          <summary>
                            Über die Darstellung <Info size={12} />
                          </summary>
                          <p>{c.reference}</p>
                          <button
                            className="text-button"
                            onClick={() => open("credits")}
                          >
                            Modell & Quellen
                          </button>
                        </details>
                      </section>
                    </div>
                    <section className="below-stage">
                      <div className="section-title">
                        <div>
                          <span className="eyebrow">DEIN NÄCHSTER SCHRITT</span>
                          <h2>
                            {relevantTasks.length
                              ? "Als Nächstes an deinem E39"
                              : "Deine Garage wächst mit dir."}
                          </h2>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setTab("plan")}
                        >
                          Zum Plan <ArrowUpRight size={17} />
                        </button>
                      </div>
                      {relevantTasks.length ? (
                        <div className="next-tasks">
                          {relevantTasks.slice(0, 3).map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              garage={garage}
                              onComplete={() =>
                                open("complete", { taskId: t.id })
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="starter-cards">
                          <button onClick={() => open("reading")}>
                            <span className="starter-number">01</span>
                            <div>
                              <strong>Kilometerstand festhalten</strong>
                              <p>Der Ausgangspunkt für deinen Wartungsplan.</p>
                            </div>
                            <ArrowUpRight size={20} />
                          </button>
                          <button onClick={() => open("task")}>
                            <span className="starter-number">02</span>
                            <div>
                              <strong>Erste Arbeit planen</strong>
                              <p>
                                Was steht an? Mach es zu deinem nächsten
                                Schritt.
                              </p>
                            </div>
                            <ArrowUpRight size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setTab("documents");
                              uploadRef.current?.click();
                            }}
                          >
                            <span className="starter-number">03</span>
                            <div>
                              <strong>Geschichte sammeln</strong>
                              <p>
                                Rechnungen und Fotos sicher bei deinem Wagen.
                              </p>
                            </div>
                            <ArrowUpRight size={20} />
                          </button>
                        </div>
                      )}
                    </section>
                  </>
                )}
                {tab === "plan" && (
                  <>
                    <div className="toolbar">
                      <div className="segmented">
                        <button
                          className={planView === "tasks" ? "selected" : ""}
                          onClick={() => setPlanView("tasks")}
                        >
                          Arbeiten{" "}
                          <span>
                            {garage.tasks.filter((t) => !t.done).length}
                          </span>
                        </button>
                        <button
                          className={planView === "parts" ? "selected" : ""}
                          onClick={() => setPlanView("parts")}
                        >
                          Einkaufsliste{" "}
                          <span>
                            {garage.parts.filter((p) => !p.bought).length}
                          </span>
                        </button>
                      </div>
                      <button
                        className="button primary"
                        onClick={() =>
                          open(planView === "tasks" ? "task" : "part")
                        }
                      >
                        <Plus size={17} />
                        {planView === "tasks"
                          ? "Arbeit planen"
                          : "Teil ergänzen"}
                      </button>
                    </div>
                    {planView === "tasks" ? (
                      garage.tasks.length ? (
                        <div className="task-grid">
                          {sortedTasks(garage).map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              garage={garage}
                              onComplete={() =>
                                open("complete", { taskId: t.id })
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon={Wrench}
                          title="Der Plan ist noch offen."
                          action={
                            <button
                              className="button"
                              onClick={() => open("task")}
                            >
                              <Plus size={16} />
                              Erste Arbeit planen
                            </button>
                          }
                        >
                          Trage ein, was du angehen möchtest. Mit Datum oder
                          Kilometerziel wird daraus dein persönlicher
                          Wartungsplan.
                        </Empty>
                      )
                    ) : garage.parts.length ? (
                      <div className="parts-list">
                        {garage.parts.map((p) => (
                          <article className="part-row" key={p.id}>
                            <button
                              aria-label={
                                p.bought
                                  ? "Als noch nicht gekauft markieren"
                                  : "Als gekauft markieren"
                              }
                              className={
                                "check-button " + (p.bought ? "checked" : "")
                              }
                              disabled={busy}
                              onClick={() =>
                                void act(() =>
                                  commit({
                                    ...garage,
                                    parts: garage.parts.map((x) =>
                                      x.id === p.id
                                        ? { ...x, bought: !x.bought }
                                        : x,
                                    ),
                                  }),
                                )
                              }
                            >
                              {p.bought && <Check size={17} />}
                            </button>
                            <div>
                              <h3>
                                {p.quantity} × {p.name}
                              </h3>
                              <p>
                                {p.partNumber || "Teilenummer noch offen"} ·{" "}
                                {p.fitChecked
                                  ? "Passform geprüft"
                                  : "Passform noch prüfen"}
                              </p>
                              {p.taskId && (
                                <small>
                                  {
                                    garage.tasks.find((t) => t.id === p.taskId)
                                      ?.title
                                  }
                                </small>
                              )}
                            </div>
                            {p.price !== null && (
                              <strong>{money(p.price * p.quantity)}</strong>
                            )}
                            {safeUrl(p.url) && (
                              <a
                                className="icon-button"
                                aria-label={"Shop für " + p.name + " öffnen"}
                                href={safeUrl(p.url)!}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ArrowUpRight size={19} />
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={ShoppingBag}
                        title="Was brauchst du für den nächsten Schritt?"
                      >
                        Sammele Teile, Preise und Links. Die Passform bestätigst
                        du nach Abgleich mit deinem Fahrzeug.
                      </Empty>
                    )}
                    <p className="quiet-note">
                      Fälligkeit: Datum oder Kilometerziel – was zuerst erreicht
                      wird. „Bald fällig“ bedeutet höchstens 30 Tage oder 1.000
                      km. Fehlende Angaben bleiben offen.
                    </p>
                  </>
                )}
                {tab === "history" && (
                  <>
                    <div className="toolbar">
                      <label className="filter-select">
                        <ListFilter size={17} />
                        <select
                          aria-label="Historie filtern"
                          value={historyFilter}
                          onChange={(e) => setHistoryFilter(e.target.value)}
                        >
                          <option value="all">Alle Bauteile</option>
                          {components.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button primary"
                        onClick={() => open("entry")}
                      >
                        <Plus size={17} />
                        Eintrag hinzufügen
                      </button>
                    </div>
                    {garage.entries.filter(
                      (e) =>
                        historyFilter === "all" ||
                        e.componentId === historyFilter,
                    ).length ? (
                      <Timeline
                        entries={garage.entries.filter(
                          (e) =>
                            historyFilter === "all" ||
                            e.componentId === historyFilter,
                        )}
                        onResolve={(id) =>
                          void act(() =>
                            commit({
                              ...garage,
                              entries: garage.entries.map((e) =>
                                e.id === id
                                  ? { ...e, resolved: !e.resolved }
                                  : e,
                              ),
                            }),
                          )
                        }
                      />
                    ) : (
                      <Empty
                        icon={History}
                        title="Die Geschichte beginnt hier."
                      >
                        Dokumentiere eine erledigte Arbeit, eine Beobachtung
                        oder eine Öl-Nachfüllung. Später weißt du genau, wann
                        was passiert ist.
                      </Empty>
                    )}
                    {garage.readings.length > 0 && (
                      <details className="reading-history">
                        <summary>
                          Kilometerstände ({garage.readings.length})
                        </summary>
                        {[...garage.readings]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((r) => (
                            <div key={r.id}>
                              <span>{formatDate(r.date)}</span>
                              <strong>{formatKm(r.km)} km</strong>
                              <p>{r.note}</p>
                            </div>
                          ))}
                      </details>
                    )}
                  </>
                )}
                {tab === "documents" && (
                  <>
                    <div className="toolbar">
                      <span className="muted">
                        {garage.documents.length} Unterlagen · JPG, PNG, WebP,
                        PDF · bis 10 MB
                      </span>
                      <button
                        className="button primary"
                        onClick={() => uploadRef.current?.click()}
                        disabled={busy}
                      >
                        <Upload size={16} />
                        Unterlage hinzufügen
                      </button>
                    </div>
                    {garage.documents.length ? (
                      <div className="document-grid">
                        {garage.documents.map((doc) => (
                          <button
                            className="document-card"
                            key={doc.id}
                            onClick={() => void act(() => getDocument(doc))}
                          >
                            <FileText size={30} />
                            <strong>{doc.name}</strong>
                            <span>
                              {formatDate(doc.date)} ·{" "}
                              {(doc.bytes / 1024).toFixed(0)} KB
                            </span>
                            <em>
                              Herunterladen <ArrowDownToLine size={15} />
                            </em>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={BookOpen}
                        title="Alles, was zu deinem Wagen gehört."
                        action={
                          <button
                            className="button"
                            onClick={() => uploadRef.current?.click()}
                          >
                            <Upload size={16} />
                            Ersten Beleg hinzufügen
                          </button>
                        }
                      >
                        Rechnungen, Fotos und Berichte bleiben hier zusammen.
                        Lokal gespeicherte Belege gehören nur zu diesem Browser,
                        bis du sie als ZIP sicherst.
                      </Empty>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        <footer className="page-footer">
          <span>
            E39 GARAGE <i /> GEMACHT FÜR DEINEN KLASSIKER.
          </span>
          <button onClick={() => open("credits")}>
            Modell & Quellen <ArrowUpRight size={12} />
          </button>
        </footer>
      </main>
      <input
        ref={uploadRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void act(() => upload(file));
          e.target.value = "";
        }}
      />
      <input
        ref={importRef}
        hidden
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void act(() => restore(file));
          e.target.value = "";
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Info size={17} />
          {notice}
          <button aria-label="Meldung schließen" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            {
              profile: "Dein E39",
              reading: "Kilometerstand eintragen",
              entry: "In die Akte eintragen",
              task: "Nächste Arbeit planen",
              complete: "Arbeit dokumentieren",
              part: "Teil auf die Einkaufsliste",
              settings: "Deine Garage",
              credits: "Modell & Quellen",
              login: "Deine private Garage",
            }[dialog.kind]
          }
          onClose={() => setDialog(null)}
        >
          {["profile", "reading", "entry", "task", "complete", "part"].includes(
            dialog.kind,
          ) &&
            garage && (
              <DraftForm
                name={
                  mode +
                  ":" +
                  userId +
                  ":" +
                  dialog.kind +
                  ":" +
                  (dialog.taskId ?? dialog.component)
                }
                onSubmit={submit}
                busy={busy}
              >
                {dialog.kind === "profile" && (
                  <>
                    <Field label="Name deines Wagens">
                      <input
                        name="name"
                        defaultValue={garage.profile.name}
                        maxLength={70}
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Baujahr">
                        <input
                          name="year"
                          type="number"
                          min="1995"
                          max="2004"
                          defaultValue={garage.profile.year ?? ""}
                          placeholder="Noch offen"
                        />
                      </Field>
                      <Field label="Getriebe">
                        <select
                          name="gearbox"
                          defaultValue={garage.profile.gearbox}
                        >
                          <option value="unknown">Noch offen</option>
                          <option value="manual">Schaltgetriebe</option>
                          <option value="automatic">Automatik</option>
                        </select>
                      </Field>
                    </div>
                    <div className="form-grid">
                      <Field label="Lack in der 3D-Ansicht">
                        <input
                          type="color"
                          name="paint"
                          defaultValue={garage.profile.paint}
                        />
                      </Field>
                      <Field label="Farbe der Motorhaube">
                        <input
                          type="color"
                          name="hoodPaint"
                          defaultValue={garage.profile.hoodPaint}
                        />
                      </Field>
                    </div>
                    <Field label="Ausstattung, Umbauten & Notizen">
                      <textarea
                        name="notes"
                        rows={4}
                        defaultValue={garage.profile.notes}
                      />
                    </Field>
                    <p className="quiet-note">
                      Farben verändern nur die Modellansicht. Modell und
                      Motorisierung stammen aus deiner Angabe: E39 530i
                      Limousine.
                    </p>
                  </>
                )}
                {dialog.kind === "reading" && (
                  <>
                    <div className="form-grid">
                      <Field label="Abgelesen am">
                        <input
                          type="date"
                          name="date"
                          required
                          max={today()}
                          defaultValue={today()}
                        />
                      </Field>
                      <Field label="Kilometerstand">
                        <input
                          name="km"
                          required
                          type="number"
                          min="0"
                          step="1"
                          placeholder={r ? String(r.km) : "z. B. 245000"}
                        />
                      </Field>
                    </div>
                    {r && (
                      <p className="quiet-note">
                        Letzter Stand: {formatKm(r.km)} km am{" "}
                        {formatDate(r.date)}. Historische Angaben sind möglich.
                      </p>
                    )}
                    <Field label="Notiz (optional)">
                      <textarea name="note" rows={3} />
                    </Field>
                  </>
                )}
                {dialog.kind === "entry" && (
                  <>
                    <Field label="Art des Eintrags">
                      <select name="type">
                        <option value="service">Erledigte Arbeit</option>
                        <option value="observation">Beobachtung</option>
                        <option value="oil">Öl nachgefüllt</option>
                      </select>
                    </Field>
                    <Field label="Titel">
                      <input
                        name="title"
                        required
                        maxLength={160}
                        placeholder="Was hast du gemacht oder beobachtet?"
                      />
                    </Field>
                    <ComponentSelect value={dialog.component} />
                    <DateKm />
                    <Field label="Beschreibung">
                      <textarea
                        name="note"
                        rows={4}
                        placeholder="Beobachtung, Befund oder ausgeführte Arbeit …"
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Kosten in € (optional)">
                        <input name="cost" inputMode="decimal" />
                      </Field>
                      <Field label="Ölmenge in l (nur Nachfüllung)">
                        <input name="litres" inputMode="decimal" />
                      </Field>
                    </div>
                  </>
                )}
                {dialog.kind === "task" && (
                  <>
                    <Field label="Geplante Arbeit">
                      <input
                        name="title"
                        maxLength={160}
                        required
                        placeholder="z. B. Öl und Filter wechseln"
                      />
                    </Field>
                    <ComponentSelect value={dialog.component} />
                    <div className="form-grid">
                      <Field label="Fällig am (optional)">
                        <input name="dueDate" type="date" />
                      </Field>
                      <Field label="Fällig bei km (optional)">
                        <input name="dueKm" type="number" min="0" step="1" />
                      </Field>
                    </div>
                    <details className="interval-details">
                      <summary>Wiederholendes Intervall ergänzen</summary>
                      <div className="form-grid">
                        <Field label="Alle … Monate">
                          <input
                            type="number"
                            name="intervalMonths"
                            min="1"
                            max="120"
                          />
                        </Field>
                        <Field label="Alle … km">
                          <input
                            type="number"
                            name="intervalKm"
                            min="1"
                            step="1"
                          />
                        </Field>
                      </div>
                      <Field label="Quelle des Intervalls">
                        <input
                          name="source"
                          placeholder="Fahrzeugunterlagen / eigene Festlegung"
                        />
                      </Field>
                    </details>
                    <Field label="Notizen">
                      <textarea name="note" rows={3} />
                    </Field>
                  </>
                )}
                {dialog.kind === "complete" && (
                  <>
                    <p className="completion-title">{completion?.title}</p>
                    <DateKm />
                    <Field label="Was wurde gemacht?">
                      <textarea
                        name="note"
                        rows={4}
                        required
                        placeholder="Teile, Öl, Befund, Werkstatt …"
                      />
                    </Field>
                    <Field label="Kosten in € (optional)">
                      <input name="cost" inputMode="decimal" />
                    </Field>
                    {(completion?.intervalKm || completion?.intervalMonths) && (
                      <p className="quiet-note">
                        Beim Speichern wird genau eine Folgeaufgabe aus Datum
                        und Kilometerstand dieser Arbeit angelegt.
                      </p>
                    )}
                  </>
                )}
                {dialog.kind === "part" && (
                  <>
                    <Field label="Teil / Produkt">
                      <input name="name" maxLength={160} required />
                    </Field>
                    <div className="form-grid">
                      <Field label="Anzahl">
                        <input
                          name="quantity"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue="1"
                          required
                        />
                      </Field>
                      <Field label="Stückpreis in € (optional)">
                        <input name="price" inputMode="decimal" />
                      </Field>
                    </div>
                    <Field label="Teilenummer (optional)">
                      <input name="partNumber" maxLength={100} />
                    </Field>
                    <Field label="Shop-Link (optional)">
                      <input name="url" type="url" placeholder="https://…" />
                    </Field>
                    <Field label="Gehört zu einer Arbeit">
                      <select name="taskId">
                        <option value="">Ohne Zuordnung</option>
                        {garage.tasks
                          .filter((t) => !t.done)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <label className="checkbox-label">
                      <input type="checkbox" name="fitChecked" />
                      Passform mit meinem Fahrzeug geprüft
                    </label>
                  </>
                )}
              </DraftForm>
            )}
          {dialog.kind === "settings" && (
            <div className="modal-content">
              <div className="privacy-card">
                <ShieldCheck size={24} />
                <div>
                  <strong>
                    {mode === "cloud"
                      ? "Private Online-Garage"
                      : "Lokale Garage"}
                  </strong>
                  <p>
                    {mode === "cloud"
                      ? "Nur dein angemeldetes Konto darf diese Fahrzeugakte öffnen."
                      : "Deine Einträge liegen in diesem Browser. Eine ZIP-Sicherung enthält Akte und Belege."}
                  </p>
                </div>
              </div>
              <button
                className="button full"
                disabled={busy || !garage}
                onClick={() => garage && void act(() => exportGarage(garage))}
              >
                <Download size={17} />
                Vollständige ZIP-Sicherung laden
              </button>
              <button
                className="button full"
                disabled={busy || mode === "cloud"}
                onClick={() => importRef.current?.click()}
              >
                <Upload size={17} />
                ZIP-Sicherung hier wiederherstellen
              </button>
              <p className="quiet-note">
                Wiederherstellen ersetzt die aktuelle lokale Akte. Sichere
                deinen Stand vorher. Browserdaten können vom Gerät gelöscht
                werden.
              </p>
              {mode === "cloud" ? (
                <button
                  className="button full"
                  onClick={() =>
                    void act(async () => {
                      await supabase?.auth.signOut();
                      await clearPrivateCache(userId);
                      client.removeQueries({ queryKey: ["garage", "cloud"] });
                      setDialog(null);
                    })
                  }
                >
                  Abmelden & privaten Zwischenspeicher leeren
                </button>
              ) : (
                <button className="button full" onClick={() => open("login")}>
                  <Cloud size={17} />
                  Online-Garage anmelden
                </button>
              )}
              <button className="text-button" onClick={() => open("profile")}>
                Fahrzeugprofil bearbeiten <ArrowRight size={15} />
              </button>
            </div>
          )}
          {dialog.kind === "login" && (
            <Login configured={!!supabase} onSuccess={setNotice} />
          )}
          {dialog.kind === "credits" && (
            <div className="modal-content credits">
              <p>
                Karosserie-Grundmodell:{" "}
                <a
                  href="https://sketchfab.com/3d-models/bmw-e39-5-series-1995-2004-4a918a985c0a4ea89ac3d65e1f95c0b7"
                  target="_blank"
                  rel="noreferrer"
                >
                  BMW E39 5-Series 1995–2004
                </a>{" "}
                von{" "}
                <a
                  href="https://sketchfab.com/szymonpasterczyk"
                  target="_blank"
                  rel="noreferrer"
                >
                  Merc_TV
                </a>
                , lizenziert unter{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                .
              </p>
              <p>
                M-Technik-Front aus{" "}
                <a href="https://sketchfab.com/3d-models/bmw-5-series-e39-mk4-1995-2003-a6a2a783c59b47e1b9d56e08bebcdfc9" target="_blank" rel="noreferrer">BMW 5 Series E39 MK4 1995–2003</a>
                {" "}von Merc_TV, CC BY 4.0. Anordnung und Materialien angepasst,
                neutrales Kennzeichen ergänzt. Die weitergehende ursprüngliche
                Rechtekette des Uploads ist unbestätigt.
              </p>
              <p>
                Für diese Garage wurden Varianten entfernt, eine Limousine
                zusammengestellt und Lackflächen, Räder, Bremsen, Leuchten und
                Cockpit angepasst. Die sichtbare Fahrzeugbasis einschließlich
                Kabine und Motorraum entspricht wieder Version 0.9. Der Motor
                besteht aus vereinfachten, auswählbaren Anschauungsbauteilen
                mit Ölfilter-Explosionsansicht. Er ist keine genaue
                Rekonstruktion deines M54.
              </p>
              <p>
                Das Modell ist eine visuelle Referenz. Baujahr, Ausstattung,
                Felgen und technische Details deines Wagens sind noch
                abzugleichen. Die Darstellung liefert keine Sensordaten und
                keine Montagewerte.
              </p>
              <p>
                Fotohalle: <a href="https://polyhaven.com/a/autoshop_01" target="_blank" rel="noreferrer">Autoshop 01</a> von Oliksiy Yakovlyev / Poly Haven, CC0. Die Aufnahme dient als Hintergrund und Beleuchtung, sie zeigt nicht deine eigene Garage.
              </p>
              <p>
                Die Fahrzeugakte enthält deine eigenen Angaben.
                Wartungsintervalle werden mit ihrer Quelle oder als eigene
                Festlegung erfasst.
              </p>
              <span className="eyebrow">E39 GARAGE · VERSION 0.10.2</span>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function DateKm() {
  return (
    <div className="form-grid">
      <Field label="Datum">
        <input
          name="date"
          type="date"
          required
          max={today()}
          defaultValue={today()}
        />
      </Field>
      <Field label="Kilometerstand (falls bekannt)">
        <input
          name="km"
          type="number"
          min="0"
          step="1"
          placeholder="Unbekannt"
        />
      </Field>
    </div>
  );
}
function TaskCard({
  task,
  garage,
  onComplete,
}: {
  task: MaintenanceTask;
  garage: Garage;
  onComplete: () => void;
}) {
  return (
    <article className={"task-card " + (task.done ? "task-done" : "")}>
      <div className="task-card-top">
        <span>{componentById(task.componentId).name}</span>
        <Badge status={taskStatus(task, currentReading(garage)?.km)} />
      </div>
      <h3>{task.title}</h3>
      <div className="task-target">
        {task.dueDate && (
          <span>
            <CalendarDays size={14} />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.dueKm !== null && <span>{formatKm(task.dueKm)} km</span>}
        {!task.dueDate && task.dueKm === null && <span>Termin noch offen</span>}
      </div>
      {task.note && <p className="preserve-lines">{task.note}</p>}
      {task.source && <small>Intervallquelle: {task.source}</small>}
      {!task.done && (
        <button className="text-button" onClick={onComplete}>
          <Check size={15} />
          Als erledigt dokumentieren
        </button>
      )}
    </article>
  );
}
function Login({
  configured,
  onSuccess,
}: {
  configured: boolean;
  onSuccess: (message: string) => void;
}) {
  const [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const data = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: String(data.get("email")),
      options: { shouldCreateUser: true, emailRedirectTo: location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      setSent(true);
      onSuccess("Anmeldelink angefordert. Bitte dein E-Mail-Postfach prüfen.");
    }
  }
  return (
    <div className="modal-content">
      <div className="login-graphic">
        <Cloud size={36} />
        <ShieldCheck size={20} />
      </div>
      <p>
        Deine private Fahrzeugakte auf PC und Android. Die Anmeldung erfolgt
        über einen Link in deinem E-Mail-Postfach.
      </p>
      {configured ? (
        <form onSubmit={submit}>
          <Field label="E-Mail deines freigeschalteten Kontos">
            <input type="email" name="email" autoComplete="email" required />
          </Field>
          <button className="button primary full" disabled={loading || sent}>
            {loading
              ? "Wird angefordert …"
              : sent
                ? "Bitte Postfach prüfen"
                : "Anmeldelink senden"}
            <ArrowRight size={16} />
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="quiet-note">
            Nur die freigeschaltete E-Mail kann sich hier anmelden. Lokale
            Einträge werden beim Anmelden nicht automatisch hochgeladen.
          </p>
        </form>
      ) : (
        <div className="privacy-card">
          <Info size={22} />
          <p>
            Die Online-Verbindung wird noch eingerichtet. Deine lokale Garage
            ist bereits nutzbar. Sichere sie über Einstellungen als ZIP.
          </p>
        </div>
      )}
    </div>
  );
}
export default App;
