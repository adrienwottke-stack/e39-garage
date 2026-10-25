export const vehicleDefaults = {
  series: "E39",
  model: "530i",
  body: "Limousine",
  year: 2001,
  bumper: "mtech",
  source:
    "Nutzerangabe vom 17.10.2026: Baujahr 2001, originale M-Technik-Stoßstange",
};
export function compatibility(item, vehicle = vehicleDefaults) {
  const reasons = [item.evidence],
    pending = [];
  if (item.conflicts.length)
    return {
      status: "conflict",
      label: "Händlerangaben widersprüchlich",
      reasons,
      pending: item.conflicts,
    };
  if (
    !item.models.includes(vehicle.series) ||
    vehicle.year < item.years[0] ||
    vehicle.year > item.years[1]
  )
    return {
      status: "excluded",
      label: "Fahrzeugzuordnung passt nicht",
      reasons,
      pending: ["Baureihe oder Baujahr weicht ab."],
    };
  if (item.category === "lip") {
    if (vehicle.bumper !== item.bumper)
      return {
        status: vehicle.bumper === "unknown" ? "unknown" : "excluded",
        label: "Stoßfängerzuordnung offen oder abweichend",
        reasons,
        pending: ["Originale M-Technik-Stoßstange erforderlich."],
      };
    reasons.push(
      "Dein Baujahr 2001 liegt im genannten Bereich; originale M-Technik ist von dir bestätigt.",
    );
    pending.push(
      "Anbauanleitung, Befestigung, Bodenfreiheit und Dokument für genau diesen Artikel prüfen.",
    );
    return {
      status: "conditional",
      label: "M-Technik-Zuordnung passt",
      reasons,
      pending,
    };
  }
  if (item.pcd !== "5x120" || item.bore < 74.1)
    return {
      status: "excluded",
      label: "Anschlussmaße weichen ab",
      reasons,
      pending: ["Lochkreis oder Mittenloch passt nicht zur E39-Zuordnung."],
    };
  pending.push(
    "Gutachten für 530i / Fahrzeugtyp und Achslasten abgleichen.",
    "Reifen, Achszuordnung, Freigängigkeit und vorhandenes Fahrwerk prüfen.",
  );
  if (item.width >= 9)
    pending.push(
      "Breite Ausführung: nicht pauschal für Vorder- und Hinterachse übernehmen.",
    );
  return {
    status: "conditional",
    label: "E39 gelistet · Radfreigabe offen",
    reasons,
    pending,
  };
}
export function parseIntent(input, category) {
  const text = input.toLocaleLowerCase("de-DE");
  const sizes = [...text.matchAll(/\b(1[7-9])\s*(?:zoll|["″])/g)];
  const excludedSizes = sizes
    .filter((m) =>
      /(?:kein(?:e|en)?|ohne|nicht)\s*$/.test(text.slice(0, m.index)),
    )
    .map((m) => Number(m[1]));
  const size = sizes
    .filter((m) => !excludedSizes.includes(Number(m[1])))
    .at(-1);
  const amount =
    "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,5}(?:[.,]\\d{1,2})?)";
  const number = (value) =>
    Number(value.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  const max = text.match(
    new RegExp(
      "(?:bis(?:\\s+zu)?|max(?:imal)?\\.?|unter|höchstens)\\s*" +
        amount +
        "\\s*(?:€|eur|euro)?",
    ),
  );
  const min = text.match(
    /(?:mindestens|ab)\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)/,
  );
  const excludes = [],
    wantedColors = [];
  for (const color of ["bronze", "schwarz", "silber"]) {
    if (new RegExp(`(?:kein(?:e|en)?|ohne|nicht)\\s+${color}`).test(text))
      excludes.push(color);
    else if (text.includes(color)) wantedColors.push(color);
  }
  const inferred = /frontlippe|splitter|frontansatz|frontflaps/.test(text)
    ? "lip"
    : /felge|räder|kreuzspeich|vielspeich/.test(text)
      ? "wheels"
      : category;
  return {
    category: inferred,
    size: size ? Number(size[1]) : null,
    maxPrice: max ? number(max[1]) : null,
    minPrice: min ? Number(min[1].replace(",", ".")) : null,
    budgetUnit: /\bsatz\b|vier\s+felgen|4\s*felgen/.test(text)
      ? "set"
      : "offer",
    excludes,
    wantedColors,
    excludedSizes,
    bumperRequested: /ohne\s+m[\s-]*(?:paket|technik)|serienstoßstange/.test(
      text,
    )
      ? "standard"
      : null,
  };
}
export function filterItems(
  items,
  intent,
  { onlyAvailable = false, includeConflicts = false } = {},
) {
  return items.filter((i) => {
    if (
      i.category !== intent.category ||
      (!includeConflicts && i.conflicts.length)
    )
      return false;
    if (intent.size && i.category === "wheels" && i.diameter !== intent.size)
      return false;
    if (i.category === "wheels" && intent.excludedSizes?.includes(i.diameter))
      return false;
    if (
      i.category === "lip" &&
      intent.bumperRequested &&
      i.bumper !== intent.bumperRequested
    )
      return false;
    if (
      intent.excludes.some((c) =>
        i.color.toLocaleLowerCase("de-DE").includes(c),
      )
    )
      return false;
    if (
      intent.wantedColors?.length &&
      !intent.wantedColors.some((c) =>
        i.color.toLocaleLowerCase("de-DE").includes(c),
      )
    )
      return false;
    if (
      onlyAvailable &&
      (i.offer?.availability !== "in_stock" || i.offer?.stale)
    )
      return false;
    const price = i.offer?.price;
    const compare =
      price == null
        ? null
        : intent.budgetUnit === "set" && i.category === "wheels"
          ? (price / i.quantity) * 4
          : price;
    if (
      (intent.maxPrice !== null || intent.minPrice !== null) &&
      (compare === null || i.offer.stale)
    )
      return false;
    if (intent.maxPrice !== null && compare > intent.maxPrice) return false;
    if (intent.minPrice !== null && compare < intent.minPrice) return false;
    return true;
  });
}
export function lexicalScores(items, query) {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return items.map((i) =>
    words.reduce(
      (s, w) =>
        s +
        Number(
          `${i.name} ${i.style} ${i.color} ${i.sku}`.toLowerCase().includes(w),
        ),
      0,
    ),
  );
}
