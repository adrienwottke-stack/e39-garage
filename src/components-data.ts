export type ComponentId =
  | "overview"
  | "body"
  | "wheels"
  | "brakes"
  | "suspension"
  | "engine"
  | "cooling"
  | "exhaust"
  | "valve-cover"
  | "intake"
  | "air-filter"
  | "oil-filter"
  | "radiator"
  | "expansion-tank"
  | "fan"
  | "belt";
export interface VehicleComponent {
  id: ComponentId;
  name: string;
  group: "Fahrzeug" | "Motorraum";
  subtitle: string;
  description: string;
  facts: string[];
  reference: string;
}
export const components: VehicleComponent[] = [
  {
    id: "overview",
    name: "Dein E39",
    group: "Fahrzeug",
    subtitle: "BMW 530i · Limousine",
    description:
      "Hier entsteht die Geschichte deines Wagens. Jede dokumentierte Arbeit, Beobachtung und Rechnung bleibt mit ihm verbunden.",
    facts: [
      "Modell: BMW E39 530i",
      "Motorfamilie: M54 · Reihensechszylinder",
      "Individueller Zustand: noch nicht erfasst",
    ],
    reference:
      "Fahrzeugmodell aus deiner Angabe. Baujahr, Getriebe und Umbauten bitte im Profil ergänzen.",
  },
  {
    id: "body",
    name: "Karosserie",
    group: "Fahrzeug",
    subtitle: "Lack, Bleche & Anbauteile",
    description:
      "Fotos, Lackarbeiten, Rostbeobachtungen und Änderungen an der Karosserie sammelst du hier.",
    facts: [
      "Fotos mit Datum machen Veränderungen nachvollziehbar",
      "Modellansicht und tatsächlichen Fahrzeugzustand getrennt beurteilen",
    ],
    reference:
      "Die Ansicht ist ein aufbereitetes E39-Referenzmodell; die genaue Ausführung ist noch mit deinem Fahrzeug abzugleichen.",
  },
  {
    id: "wheels",
    name: "Räder & Reifen",
    group: "Fahrzeug",
    subtitle: "Vier Kontaktpunkte zur Straße",
    description:
      "Dokumentiere Reifensatz, Größe, Alter, Wechsel und Beobachtungen. Die dargestellten Felgen sind zunächst Modellbestand.",
    facts: [
      "Reifengröße aus Fahrzeugunterlagen übernehmen",
      "Wechsel mit Datum und Kilometerstand erfassen",
    ],
    reference:
      "Montierte Felgen und Bereifung deines Wagens sind noch nicht bestätigt.",
  },
  {
    id: "brakes",
    name: "Bremsen",
    group: "Fahrzeug",
    subtitle: "Scheiben, Beläge & Flüssigkeit",
    description:
      "Hier gehören Arbeiten und Beobachtungen an der Bremsanlage hin. Die Akte zeigt dokumentierte Fakten und offene Prüfungen.",
    facts: [
      "Vorder- und Hinterachse in der Notiz unterscheiden",
      "Verwendete Teilenummern zur Arbeit hinterlegen",
    ],
    reference:
      "Das 3D-Modell ersetzt keine Prüfung der tatsächlichen Bremsanlage.",
  },
  {
    id: "suspension",
    name: "Fahrwerk",
    group: "Fahrzeug",
    subtitle: "Lenkung, Dämpfung & Lagerung",
    description:
      "Behalte Lager, Lenker, Dämpfer und Achsvermessungen im Blick. Geräusche und Fahreindrücke lassen sich hier mit Datum festhalten.",
    facts: [
      "Ort und Fahrsituation bei Geräuschen notieren",
      "Vermessungsprotokolle unter Unterlagen ablegen",
    ],
    reference:
      "Eine Beobachtung ist ein Anlass zur Prüfung; ihre Ursache bleibt bis zum Befund offen.",
  },
  {
    id: "engine",
    name: "Motor",
    group: "Fahrzeug",
    subtitle: "M54 · 3,0 Liter · Reihensechszylinder",
    description:
      "Öffne den Motorraum und wähle eine Komponente. Zu jeder Baugruppe findest du deine Arbeiten und Beobachtungen.",
    facts: [
      "Motorraum mit acht auswählbaren Baugruppen",
      "Wartungshistorie und Belege direkt zugeordnet",
    ],
    reference:
      "Wiederhergestellter Motorraum aus Version 0.9 mit vereinfachten, auswählbaren Baugruppen und Ölfilter-Explosionsansicht. Die Darstellung dient der Orientierung, nicht als exaktes M54-Modell oder Montagevorlage.",
  },
  {
    id: "cooling",
    name: "Kühlsystem",
    group: "Fahrzeug",
    subtitle: "Kühler, Lüfter & Ausgleichsbehälter",
    description:
      "Hier sammelst du Kühlmittelarbeiten, ersetzte Komponenten und deine Beobachtungen zum Temperaturverhalten.",
    facts: [
      "Nachfüllungen und verwendetes Kühlmittel dokumentieren",
      "Prüfergebnisse und Werkstattberichte ergänzen",
    ],
    reference:
      "Modellansicht ohne Verbindung zu Sensoren. Es wird keine aktuelle Temperatur gemessen.",
  },
  {
    id: "exhaust",
    name: "Abgasanlage",
    group: "Fahrzeug",
    subtitle: "Vom Motor bis zum Endschalldämpfer",
    description:
      "Dokumentiere Arbeiten, verbaute Teile und Beobachtungen zu Klang, Geruch oder Undichtigkeiten.",
    facts: [
      "Änderungen mit Teilenummer und Beleg hinterlegen",
      "Rauchfarbe, Zeitpunkt und Betriebszustand beschreiben",
    ],
    reference:
      "Die Abgasausführung des Referenzmodells muss mit deinem Wagen abgeglichen werden.",
  },
  {
    id: "valve-cover",
    name: "Ventildeckel",
    group: "Motorraum",
    subtitle: "Oberer Abschluss des Zylinderkopfs",
    description:
      "Der Ventildeckel verschließt den oberen Motorbereich. Arbeiten an Deckel und Dichtungen dokumentierst du hier.",
    facts: [
      "Reinigung und Dichtungsarbeiten unterscheiden",
      "Ölspuren mit Foto und Ort dokumentieren",
    ],
    reference:
      "Referenzmodell und eigene, vereinfachte Ergänzungen; kein maßhaltiges Reparatur-CAD.",
  },
  {
    id: "intake",
    name: "Ansaugbrücke",
    group: "Motorraum",
    subtitle: "Luftverteilung zu den sechs Zylindern",
    description:
      "Die Ansaugbrücke verteilt die angesaugte Luft. Halte Arbeiten, Prüfungen und Beobachtungen am Ansaugsystem fest.",
    facts: [
      "Ausgebaute Teile fotografieren",
      "Befund und Vermutung getrennt notieren",
    ],
    reference:
      "Vereinfachte Reihensechszylinder-Darstellung aus Version 0.9. Bauteilpositionen und Ausführung am tatsächlichen M54 prüfen.",
  },
  {
    id: "air-filter",
    name: "Luftfilterkasten",
    group: "Motorraum",
    subtitle: "Filterung der Ansaugluft",
    description:
      "Hier wird die angesaugte Luft gefiltert. Filterwechsel und die verwendete Teilenummer gehören in diese Akte.",
    facts: [
      "Filtereinsatz und Gehäuse sind verschiedene Teile",
      "Wechseldatum und Kilometerstand dokumentieren",
    ],
    reference:
      "Intervall aus deinen Fahrzeugunterlagen oder eigener Festlegung übernehmen.",
  },
  {
    id: "oil-filter",
    name: "Ölfiltergehäuse",
    group: "Motorraum",
    subtitle: "Deckel, Filtereinsatz & Dichtung",
    description:
      "Der Filtereinsatz hält Verunreinigungen im Ölkreislauf zurück. In der Detailansicht kannst du die drei dargestellten Teile auseinanderziehen.",
    facts: [
      "Deckel · Filtereinsatz · Dichtung",
      "Ölwechsel mit Öl und Filterteilenummer dokumentieren",
      "Explosionsansicht zeigt den grundsätzlichen Aufbau",
    ],
    reference:
      "Die ergänzte Explosionsansicht ist schematisch und enthält keine Montageanweisung oder Drehmomentangaben.",
  },
  {
    id: "radiator",
    name: "Kühler",
    group: "Motorraum",
    subtitle: "Wärmeabgabe an die Umgebung",
    description:
      "Der Kühler gibt Wärme aus dem Kühlmittel an die Luft ab. Tauschaktionen und Beobachtungen werden hier gesammelt.",
    facts: [
      "Kühlmittelarbeiten mit zuordnen",
      "Sichtbare Spuren und Prüfergebnis getrennt erfassen",
    ],
    reference: "Vereinfachte Anschauungsgeometrie ohne thermische Simulation.",
  },
  {
    id: "expansion-tank",
    name: "Ausgleichsbehälter",
    group: "Motorraum",
    subtitle: "Volumenausgleich im Kühlkreislauf",
    description:
      "Im Behälter wird die Ausdehnung des Kühlmittels ausgeglichen. Dokumentiere Behältertausch, Nachfüllung und Prüfungen.",
    facts: [
      "Nachfüllmenge und Produkt notieren",
      "Zugehörige Arbeiten am Kühlsystem verknüpfen",
    ],
    reference:
      "Anschauungsmodell; es wird kein tatsächlicher Füllstand angezeigt.",
  },
  {
    id: "fan",
    name: "Lüfter",
    group: "Motorraum",
    subtitle: "Luftstrom durch den Kühler",
    description:
      "Der Lüfter unterstützt den Luftstrom. Geräusche, ihre Dauer und die dazugehörige Betriebssituation lassen sich hier festhalten.",
    facts: [
      "Kaltstart und warmen Betrieb getrennt beschreiben",
      "Dauer und Situation eines Geräuschs notieren",
    ],
    reference:
      "Keine Fahrzeuganbindung. Eine Animation wäre eine Erklärung und kein aktueller Betriebszustand.",
  },
  {
    id: "belt",
    name: "Riementrieb",
    group: "Motorraum",
    subtitle: "Antrieb der Nebenaggregate",
    description:
      "Riemen, Rollen und Spanner übertragen den Antrieb auf Nebenaggregate. Erfasse hier die ausgeführten Arbeiten.",
    facts: [
      "Ersetzte Rollen und Riemen einzeln benennen",
      "Datum und Kilometerstand zur Arbeit ergänzen",
    ],
    reference:
      "Vereinfachte Darstellung; der konkrete Riemenverlauf ist keine Montagevorlage.",
  },
];
export const componentById = (id: string) =>
  components.find((c) => c.id === id) ?? components[0];
