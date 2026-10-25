import { useState } from "react";
import type { Look } from "./studio-domain";

export function partQueries(look: Look) {
  return [
    {
      id: "wheels",
      name: "Felgen",
      query: `BMW E39 Limousine 530i ${look.wheelSize} Zoll ${look.wheelStyle === "mesh" ? "Kreuzspeiche" : look.wheelStyle === "radial" ? "Vielspeiche" : "Doppelspeiche"} Felgen`,
    },
    {
      id: "front",
      name: "Frontstoßfänger",
      query: "BMW E39 Limousine 530i Sport Frontstoßstange Nebelscheinwerfer",
    },
    {
      id: "lip",
      name: "Frontlippe",
      query: "BMW E39 Frontlippe Sport Stoßstange",
    },
    {
      id: "spoiler",
      name: "Heckspoiler",
      query: `BMW E39 Limousine ${look.spoiler === "ducktail" ? "Ducktail" : "Spoilerlippe"} Heckspoiler`,
    },
    {
      id: "interior",
      name: "Interieurleisten",
      query: `BMW E39 Limousine Interieurleisten ${look.interiorTrim === "silver" ? "Aluminium Silber" : "Schwarz"}`,
    },
  ];
}
export default function PartsSearch({
  look,
  onOpen,
}: {
  look: Look;
  onOpen: (category: "wheels" | "lip") => void;
}) {
  const [selected, setSelected] = useState("wheels");
  const queries = partQueries(look),
    item = queries.find((q) => q.id === selected)!;
  return (
    <details className="parts-search">
      <summary>Passende Händlerangebote suchen</summary>
      <button className="studio-primary full" onClick={() => onOpen("wheels")}>
        Felgenangebote & KI-Suche
      </button>
      <button className="studio-secondary full" onClick={() => onOpen("lip")}>
        Frontlippen für deine M-Technik
      </button>
      <p>Starte mit einer Suche zu deinem Entwurf.</p>
      <label className="studio-label" htmlFor="part-search-category">
        Welches Teil?
      </label>
      <select
        id="part-search-category"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {queries.map((q) => (
          <option key={q.id} value={q.id}>
            {q.name}
          </option>
        ))}
      </select>
      <p className="parts-query">{item.query}</p>
      <div>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={
            "https://www.google.com/search?q=" + encodeURIComponent(item.query)
          }
        >
          Im Web suchen ↗
        </a>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={
            "https://www.ebay.de/sch/i.html?_nkw=" +
            encodeURIComponent(item.query)
          }
        >
          Bei eBay suchen ↗
        </a>
      </div>
      <p className="studio-caption">
        Weitere Web-Suchlinks. Konkrete Angebote mit Preisstand und
        Fahrzeugzuordnung findest du im Teilekatalog oben.
      </p>
    </details>
  );
}
