import { useEffect, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  X,
  ArrowUpRight,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  catalogPrice,
  catalogResponseSchema,
  type CatalogCategory,
  type CatalogItem,
} from "./catalog-domain";
import type { Look } from "./studio-domain";
import "./catalog.css";
const availability = {
  in_stock: "Beim Händler verfügbar",
  made_to_order: "Auf Bestellung",
  out_of_stock: "Derzeit nicht lieferbar",
  unknown: "Bestand offen",
};
type Props = {
  category: CatalogCategory;
  look: Look;
  onClose: () => void;
  onPreview: (item: CatalogItem) => void;
  onPlan: (item: CatalogItem) => void;
  onRemember: (item: CatalogItem) => Promise<void>;
};
export default function CatalogPanel(p: Props) {
  const [category, setCategory] = useState(p.category),
    [query, setQuery] = useState(""),
    [size, setSize] = useState(""),
    [budget, setBudget] = useState(""),
    [onlyAvailable, setOnlyAvailable] = useState(false),
    [includeConflicts, setIncludeConflicts] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mode, setMode] = useState("catalog"),
    [budgetNote, setBudgetNote] = useState(""),
    [saved, setSaved] = useState<string[]>([]),
    [saving, setSaving] = useState("");
  const request = useRef(0),
    mounted = useRef(true),
    root = useRef<HTMLElement>(null);
  useEffect(() => {
    mounted.current = true;
    root.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  async function search(
    nextCategory = category,
    refresh = false,
    overrides: Record<string, unknown> = {},
  ) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      if (refresh) {
        const r = await fetch("/api/parts/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok)
          throw Error("Die Händlerprüfung ist gerade nicht erreichbar.");
      }
      const response = await fetch("/api/parts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          category: nextCategory,
          size: size ? Number(size) : null,
          maxPrice: budget ? Number(budget.replace(",", ".")) : null,
          onlyAvailable,
          includeConflicts,
          ...overrides,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const r = await response.json().catch(() => ({}));
        throw Error(r.error || "Die Teilesuche ist gerade nicht erreichbar.");
      }
      const data = catalogResponseSchema.parse(await response.json());
      if (!mounted.current || id !== request.current) return;
      setItems(data.items);
      setMode(data.mode || "catalog");
      setCategory(data.intent?.category || nextCategory);
      setBudgetNote(data.budgetNote || "");
    } catch (e) {
      if (mounted.current && id === request.current) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
      }
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void search(category);
  }, [category]);
  async function remember(item: CatalogItem) {
    setSaving(item.id);
    try {
      await p.onRemember(item);
      if (mounted.current) setSaved((s) => [...s, item.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vormerken nicht möglich.");
    } finally {
      if (mounted.current) setSaving("");
    }
  }
  return (
    <section
      className="parts-catalog"
      ref={root}
      aria-label="Teilekatalog und KI-Suche"
    >
      <header className="catalog-heading">
        <div>
          <p className="studio-kicker">DEINE NÄCHSTE VERÄNDERUNG</p>
          <h2>Vom Look zum echten Teil.</h2>
          <p>BMW 530i · E39 Limousine · 2001 · originale M-Technik</p>
          <small>
            Baujahr und Stoßfänger nach deiner Angabe vom 17.10.2026.
          </small>
        </div>
        <button
          className="catalog-close"
          onClick={p.onClose}
          aria-label="Teilekatalog schließen"
        >
          <X size={20} />
        </button>
      </header>
      <div className="catalog-layout">
        <div className="catalog-search">
          <div className="catalog-tabs" role="group" aria-label="Teileart">
            {(
              [
                { id: "wheels", name: "Felgen" },
                { id: "lip", name: "Frontlippen & Flaps" },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => {
                  setCategory(c.id);
                  setQuery("");
                  setSize("");
                  setBudget("");
                  setItems([]);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <label htmlFor="catalog-query">
              Was hast du mit deinem BMW vor?
            </label>
            <div className="catalog-query">
              <Sparkles size={18} />
              <input
                id="catalog-query"
                value={query}
                maxLength={400}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  category === "wheels"
                    ? "Zum Beispiel: klassische silberne Felgen bis 450 Euro"
                    : "Zum Beispiel: dezenter schwarzer Frontansatz"
                }
              />
            </div>
            <div className="catalog-filters">
              {category === "wheels" && (
                <label>
                  Größe
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    aria-label="Felgengröße filtern"
                  >
                    <option value="">Alle Größen</option>
                    {[17, 18, 19].map((n) => (
                      <option key={n} value={n}>
                        {n} Zoll
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Budget in €
                <input
                  aria-label="Maximaler Angebotspreis"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Offen"
                />
              </label>
            </div>
            <label className="catalog-check">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              Nur aktuell als verfügbar gemeldet
            </label>
            <label className="catalog-check">
              <input
                type="checkbox"
                checked={includeConflicts}
                onChange={(e) => setIncludeConflicts(e.target.checked)}
              />
              Auch Angebote mit Datenkonflikt zeigen
            </label>
            <button
              className="studio-primary catalog-submit"
              disabled={loading}
            >
              <Search size={17} />
              {loading
                ? "Angebote werden geprüft …"
                : query.trim()
                  ? "Mit KI suchen"
                  : "Angebote anzeigen"}
            </button>
          </form>
          <p className="catalog-scope">
            9 aufgenommene Angebote von 4 Händlern. Die KI ordnet deinen Wunsch
            diesen Angeboten zu. Sie sucht derzeit innerhalb dieses Katalogs.
          </p>
          <p className="catalog-scope">
            In deinem Entwurf: {p.look.wheelSize}″ ·{" "}
            {p.look.frontLip
              ? "Frontlippe angebaut"
              : "ohne zusätzliche Frontlippe"}
            . Die Vorschau zeigt nur eine ähnliche Form.
          </p>
          <button
            className="catalog-refresh"
            disabled={loading}
            onClick={() => void search(category, true)}
          >
            <RotateCcw size={14} />
            Händlerstand prüfen
          </button>
          <small>
            Gebündelte Prüfung, höchstens alle 15 Minuten. Datum und Liefertext
            stehen am Angebot.
          </small>
        </div>
        <div className="catalog-results" aria-live="polite">
          <div className="catalog-result-heading">
            <strong>
              {loading ? "Suche läuft …" : `${items.length} ${items.length === 1 ? "Angebot" : "Angebote"}`}
            </strong>
            <span>
              {mode === "semantic"
                ? "KI-Bedeutungssuche · lokal"
                : "Katalogsuche mit Filtern"}
            </span>
          </div>
          {budgetNote && <p className="catalog-budget-note">{budgetNote}</p>}
          {error && (
            <p className="studio-error" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && !items.length && (
            <div className="catalog-empty">
              <h3>Für diese Auswahl ist noch kein Angebot aufgenommen.</h3>
              <p>
                Probiere eine andere Größe oder ein offenes Budget. Fehlende
                Angebote bedeuten nicht, dass es das Teil nicht gibt.
              </p>
              <button
                onClick={() => {
                  setSize("");
                  setBudget("");
                  setOnlyAvailable(false);
                  setIncludeConflicts(false);
                  setQuery("");
                  void search(category, false, {
                    query: "",
                    size: null,
                    maxPrice: null,
                    onlyAvailable: false,
                    includeConflicts: false,
                  });
                }}
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
          {items.map((item) => (
            <article
              key={item.id}
              className={
                "catalog-card " +
                (item.fit.status === "conflict" ? "has-conflict" : "")
              }
            >
              <div className="catalog-card-top">
                <div>
                  <span className="catalog-merchant">
                    {item.merchant} · {item.brand}
                  </span>
                  <h3>{item.name}</h3>
                  <p className="catalog-sku">Art.-Nr. {item.sku}</p>
                </div>
                <div className="catalog-price">
                  <strong>{catalogPrice(item)}</strong>
                  <small>für {item.unit}</small>
                  <small>inkl. MwSt. · zzgl. Versand</small>
                </div>
              </div>
              <div className="catalog-specs">
                {item.category === "wheels" ? (
                  <>
                    <span>
                      {item.width}J × {item.diameter}″
                    </span>
                    <span>
                      {item.offset === null
                        ? "ET widersprüchlich"
                        : `ET ${item.offset}`}
                    </span>
                    <span>{item.pcd}</span>
                    <span>Nabe {item.bore} mm</span>
                  </>
                ) : (
                  <>
                    <span>{item.color}</span>
                    <span>Original M-Technik</span>
                  </>
                )}
              </div>
              <p className={"catalog-stock " + item.offer.availability}>
                {item.offer.stale ? "Letzter bekannter Stand · " : ""}
                {availability[item.offer.availability]}
              </p>
              {item.offer.delivery && (
                <p className="catalog-delivery">{item.offer.delivery}</p>
              )}
              <details className="catalog-fit">
                <summary>{item.fit.label}</summary>
                {item.fit.reasons.map((r) => (
                  <p key={r}>{r}</p>
                ))}
                <strong>Noch prüfen</strong>
                <ul>
                  {item.fit.pending.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p>{item.certificate}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Zuordnung beim Anbieter ansehen ↗
                </a>
              </details>
              <p className="catalog-checked">
                {item.offer.checkedAt
                  ? `Preis-/Bestandsstand: ${new Date(item.offer.checkedAt).toLocaleString("de-DE")}`
                  : "Noch kein bestätigter Preisstand"}
                {item.offer.stale ? " · erneute Prüfung erforderlich" : ""}
              </p>
              {item.offer.error && (
                <p className="catalog-delivery">{item.offer.error}</p>
              )}
              <div className="catalog-card-actions">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Angebot öffnen <ArrowUpRight size={14} />
                </a>
                {item.preview && item.fit.status !== "conflict" && (
                  <button onClick={() => p.onPreview(item)}>
                    Ähnliche Form ansehen
                  </button>
                )}
                <button
                  disabled={
                    !!saving ||
                    saved.includes(item.id) ||
                    item.fit.status === "conflict" ||
                    item.fit.status === "excluded"
                  }
                  onClick={() => void remember(item)}
                >
                  {saved.includes(item.id) ? (
                    <>
                      <Check size={14} />
                      Vorgemerkt
                    </>
                  ) : saving === item.id ? (
                    "Wird gespeichert …"
                  ) : (
                    "Teil vormerken"
                  )}
                </button>
                <button
                  disabled={
                    item.fit.status === "conflict" ||
                    item.fit.status === "excluded"
                  }
                  onClick={() => p.onPlan(item)}
                >
                  In Umbauplan übernehmen
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
