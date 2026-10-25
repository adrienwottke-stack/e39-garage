// Original design studies in the existing E39 reference envelope. These are
// visual configurations, never identified products or certified fitment data.
export const bumperIds = [
  "photo", "standard", "street-clean", "street-slit", "street-sport", "street-touring",
  "club-wide", "club-twin", "club-mesh", "club-duct", "heritage-slat", "heritage-round",
  "heritage-deep", "heritage-smooth", "aero-sweep", "aero-bridge", "aero-split", "aero-tunnel",
  "track-open", "track-vent", "track-low", "track-endurance",
] as const;
export type BumperId = typeof bumperIds[number];
export type BumperFamily = "Basis" | "Street" | "Club" | "Heritage" | "Aero" | "Track";
export type FrontSpec = {
  id: BumperId; name: string; detail: string; family: BumperFamily;
  width: number; height: number; bottom: number; taper: number; radius: number;
  vent: "round" | "slit" | "duct" | "none"; ventWidth: number; ventHeight: number;
  grille: "mesh" | "horizontal" | "vertical"; dividers: number; lip: number;
};
function front(id: BumperId, name: string, family: BumperFamily, detail: string,
  width: number, height: number, taper: number, vent: FrontSpec["vent"], ventWidth: number,
  ventHeight: number, grille: FrontSpec["grille"], dividers: number, lip: number,
  bottom = .19, radius = .022): FrontSpec {
  return { id, name, family, detail, width, height, bottom, taper, radius, vent, ventWidth, ventHeight, grille, dividers, lip };
}
export const frontBumpers: FrontSpec[] = [
  front("photo", "Sport-Basis", "Basis", "Breite Öffnung und runde Nebelleuchten", .89, .162, -.07, "round", .262, .108, "mesh", 2, 0),
  front("standard", "Serienform", "Basis", "Ursprüngliche Front des Referenzmodells", .64, .08, 0, "slit", .22, .06, "horizontal", 0, 0),
  front("street-clean", "Clean 01", "Street", "Schmale ruhige Öffnung, geschlossene Flanken", .80, .105, .04, "none", .18, .07, "horizontal", 0, .008, .205, .035),
  front("street-slit", "Slit 02", "Street", "Flache seitliche Schlitze und feine Querstreben", .76, .115, -.05, "slit", .24, .045, "horizontal", 0, .012, .2, .018),
  front("street-sport", "Sport 03", "Street", "Trapezöffnung, runde Leuchten und breite Lippe", .91, .155, -.10, "round", .19, .12, "mesh", 2, .024, .18, .03),
  front("street-touring", "Touring 04", "Street", "Geteilte Mitte, längliche seitliche Lufteinlässe", .79, .135, .08, "slit", .23, .078, "vertical", 1, .014, .195),
  front("club-wide", "Wide 01", "Club", "Breites offenes Maul mit kompakten Bremskanälen", 1.01, .18, -.06, "duct", .18, .13, "mesh", 0, .025, .178),
  front("club-twin", "Twin 02", "Club", "Zwei mittige Kanäle und glatte Außenflanken", .94, .17, .05, "none", .18, .10, "horizontal", 1, .03, .18, .014),
  front("club-mesh", "Mesh 03", "Club", "Tiefe Wabenfläche mit drei vertikalen Stegen", .92, .19, -.12, "slit", .20, .065, "mesh", 3, .021, .172, .016),
  front("club-duct", "Duct 04", "Club", "Hohe äußere Bremskanäle und kompakte Mitte", .69, .174, .10, "duct", .26, .167, "vertical", 0, .035, .18, .012),
  front("heritage-slat", "Slat 01", "Heritage", "Breite Querlamellen und kleine Rundöffnungen", .82, .105, 0, "round", .17, .09, "horizontal", 0, .006, .207, .032),
  front("heritage-round", "Round 02", "Heritage", "Große runde Zusatzleuchten, weiche Mittelöffnung", .69, .137, -.035, "round", .25, .14, "mesh", 0, .009, .195, .045),
  front("heritage-deep", "Deep 03", "Heritage", "Tiefe umlaufende Schürze und schmale Kanäle", .84, .144, .10, "slit", .21, .055, "horizontal", 2, .04, .17, .008),
  front("heritage-smooth", "Smooth 04", "Heritage", "Glatte Flanken mit rund ausgeformter Mitte", .73, .125, -.10, "none", .18, .1, "vertical", 0, .004, .21, .046),
  front("aero-sweep", "Sweep 01", "Aero", "Pfeilförmige Öffnung und schlanke Außenkanäle", .97, .15, -.15, "slit", .21, .055, "mesh", 0, .035, .18, .01),
  front("aero-bridge", "Bridge 02", "Aero", "Breite Öffnung mit kräftiger zentraler Brücke", 1.02, .17, .08, "none", .18, .1, "horizontal", 1, .028, .178, .012),
  front("aero-split", "Split 03", "Aero", "Drei getrennte Kanäle mit offenem Außenprofil", .89, .183, -.035, "duct", .22, .15, "vertical", 2, .042, .17, .01),
  front("aero-tunnel", "Tunnel 04", "Aero", "Hohe Mittelöffnung und schmale tiefe Seitentunnel", .82, .193, .135, "duct", .19, .175, "mesh", 0, .03, .17, .014),
  front("track-open", "Open 01", "Track", "Maximale offene Mitte ohne Nebelleuchten", 1.10, .193, -.08, "none", .16, .1, "mesh", 0, .047, .165, .012),
  front("track-vent", "Vent 02", "Track", "Hohe Außenkanäle, fünf feine Kühlerstege", .81, .185, -.10, "duct", .28, .175, "vertical", 0, .038, .168, .01),
  front("track-low", "Low 03", "Track", "Sehr breiter flacher Einlass und tiefer Abschluss", 1.08, .126, .12, "slit", .16, .07, "horizontal", 3, .052, .165, .006),
  front("track-endurance", "Endurance 04", "Track", "Bremskanäle, geteilte Kühlöffnung, umlaufende Lippe", .92, .205, .08, "round", .19, .145, "mesh", 1, .044, .165, .012),
];

export type RearSpec = {
  id: BumperId; name: string; detail: string; family: BumperFamily;
  width: number; height: number; bottom: number; taper: number; radius: number;
  exhaust: "left" | "single" | "dual" | "quad" | "center" | "hidden";
  fins: number; vent: "none" | "slit" | "tall"; lip: number;
};
function rear(id: BumperId, name: string, family: BumperFamily, detail: string,
  width: number, height: number, taper: number, exhaust: RearSpec["exhaust"], fins: number,
  vent: RearSpec["vent"], lip: number, bottom = .20, radius = .025): RearSpec {
  return { id, name, family, detail, width, height, bottom, taper, radius, exhaust, fins, vent, lip };
}
export const rearBumpers: RearSpec[] = [
  rear("photo", "Sport-Basis", "Basis", "Ruhiger geformter Einsatz, zwei Endrohre links", 1.30, .12, .12, "left", 0, "none", 0, .215),
  rear("standard", "Serienform", "Basis", "Ursprüngliche Heckschürze des Referenzmodells", 1.1, .08, 0, "single", 0, "none", 0),
  rear("street-clean", "Clean 01", "Street", "Schmaler schwarzer Einsatz, verdeckter Auspuff", 1.15, .09, .05, "hidden", 0, "none", .006, .225, .035),
  rear("street-slit", "Slit 02", "Street", "Flacher Einsatz mit seitlichen Entlüftungsschlitzen", 1.22, .10, -.06, "left", 0, "slit", .01, .215),
  rear("street-sport", "Sport 03", "Street", "Breite Schürze und symmetrische Endrohre", 1.35, .15, .12, "dual", 2, "none", .018, .20),
  rear("street-touring", "Touring 04", "Street", "Rund ausgeformter Einsatz, einzelnes ovales Endrohr", 1.05, .13, -.08, "single", 0, "none", .012, .213, .045),
  rear("club-wide", "Wide 01", "Club", "Breiter Diffusorkanal und vier Endrohre", 1.42, .175, .13, "quad", 2, "none", .025, .19),
  rear("club-twin", "Twin 02", "Club", "Zwei weite Auspufföffnungen, ruhige Mitte", 1.31, .14, -.10, "dual", 0, "slit", .024, .20, .018),
  rear("club-mesh", "Mesh 03", "Club", "Hohe Seitenschlitze und vier kurze Leitrippen", 1.25, .17, .18, "left", 4, "tall", .021, .19, .012),
  rear("club-duct", "Duct 04", "Club", "Hoher Diffusor, zentraler Doppelauspuff", 1.28, .185, -.12, "center", 2, "tall", .031, .185),
  rear("heritage-slat", "Slat 01", "Heritage", "Schmale klassische Abschlusskante, Doppelrohr links", 1.16, .10, 0, "left", 0, "slit", .006, .23, .015),
  rear("heritage-round", "Round 02", "Heritage", "Weich gerundeter Einsatz und zwei runde Endrohre", 1.2, .13, -.06, "dual", 0, "none", .008, .215, .052),
  rear("heritage-deep", "Deep 03", "Heritage", "Tiefe glatte Schürze und breites linkes Endrohr", 1.34, .165, .08, "single", 0, "none", .036, .185, .01),
  rear("heritage-smooth", "Smooth 04", "Heritage", "Kompakte saubere Einfassung ohne sichtbare Endrohre", .99, .115, -.12, "hidden", 0, "none", .004, .225, .045),
  rear("aero-sweep", "Sweep 01", "Aero", "Nach außen ansteigender Kanal mit drei Rippen", 1.38, .16, -.18, "dual", 3, "slit", .032, .19, .012),
  rear("aero-bridge", "Bridge 02", "Aero", "Breite mittige Brücke über zentralem Auspuff", 1.44, .18, .15, "center", 0, "none", .027, .185, .015),
  rear("aero-split", "Split 03", "Aero", "Drei Diffusorkanäle und vier Endrohre", 1.34, .19, .10, "quad", 2, "tall", .04, .18, .008),
  rear("aero-tunnel", "Tunnel 04", "Aero", "Tiefe Tunnel mit schmalen vertikalen Außenöffnungen", 1.21, .205, -.15, "dual", 4, "tall", .03, .178, .01),
  rear("track-open", "Open 01", "Track", "Sehr breiter offener Einsatz mit Zentralrohren", 1.49, .20, .12, "center", 4, "none", .045, .175, .01),
  rear("track-vent", "Vent 02", "Track", "Hohe Entlüftungen, kompakter Einsatz und vier Rohre", 1.12, .19, -.10, "quad", 3, "tall", .036, .18, .01),
  rear("track-low", "Low 03", "Track", "Flacher breiter Diffusor mit vier kurzen Rippen", 1.47, .12, .18, "dual", 4, "slit", .05, .175, .006),
  rear("track-endurance", "Endurance 04", "Track", "Drei große Kanäle, hohe Flanken und Doppelrohr links", 1.39, .215, -.14, "left", 2, "tall", .042, .175, .012),
];

export const wheelStyleIds = ["photo", "double-five", "radial", "mesh", "reference", "five-solid", "six-spoke", "seven-spoke", "ten-spoke", "split-six", "y-five", "y-seven", "turbine", "turbine-fine", "aero-disc", "aero-slot", "dish-five", "basket-deep", "forged-five", "rally-multi"] as const;
export type WheelStyleId = typeof wheelStyleIds[number];
export type WheelSpec = { id: WheelStyleId; name: string; detail: string; spokes: number; split: number; width: number; sweep: number; dish: number; profile: "straight" | "y" | "mesh" | "blade" | "disc" | "slot" | "photo"; bolts?: boolean };
export const wheelDesigns: WheelSpec[] = [
  { id: "photo", name: "Sport-Doppel", detail: "Fünf geschwungene Speichenpaare", spokes: 5, split: 2, width: .014, sweep: 0, dish: .04, profile: "photo" },
  { id: "double-five", name: "Split 5", detail: "Fünf schmale Speichenpaare", spokes: 5, split: 2, width: .012, sweep: .005, dish: .025, profile: "straight" },
  { id: "radial", name: "Radial 20", detail: "Zwanzig filigrane gerade Speichen", spokes: 20, split: 1, width: .006, sweep: 0, dish: .02, profile: "straight" },
  { id: "mesh", name: "Cross 10", detail: "Zehn gekreuzte Speichenpaare", spokes: 10, split: 2, width: .006, sweep: .043, dish: .035, profile: "mesh", bolts: true },
  { id: "reference", name: "Modell-Basis", detail: "Ursprüngliche Felge des Referenzmodells", spokes: 5, split: 1, width: .023, sweep: 0, dish: .015, profile: "straight" },
  { id: "five-solid", name: "Solid 5", detail: "Fünf breite, gerade Flächenspeichen", spokes: 5, split: 1, width: .032, sweep: 0, dish: .018, profile: "straight" },
  { id: "six-spoke", name: "Six", detail: "Sechs kräftige Speichen mit tiefer Mitte", spokes: 6, split: 1, width: .023, sweep: 0, dish: .043, profile: "straight" },
  { id: "seven-spoke", name: "Seven", detail: "Sieben weiche leicht geschwungene Speichen", spokes: 7, split: 1, width: .019, sweep: .017, dish: .03, profile: "blade" },
  { id: "ten-spoke", name: "Ten", detail: "Zehn schlanke Speichen ohne Teilung", spokes: 10, split: 1, width: .013, sweep: 0, dish: .03, profile: "straight" },
  { id: "split-six", name: "Split 6", detail: "Sechs offene Speichenpaare", spokes: 6, split: 2, width: .009, sweep: .009, dish: .035, profile: "straight" },
  { id: "y-five", name: "Y 5", detail: "Fünf ab der Mitte verzweigte Y-Speichen", spokes: 5, split: 2, width: .012, sweep: .024, dish: .042, profile: "y" },
  { id: "y-seven", name: "Y 7", detail: "Sieben fein verzweigte Y-Speichen", spokes: 7, split: 2, width: .008, sweep: .019, dish: .034, profile: "y" },
  { id: "turbine", name: "Turbine 9", detail: "Neun breite gerichtete Turbinenschaufeln", spokes: 9, split: 1, width: .026, sweep: .052, dish: .017, profile: "blade" },
  { id: "turbine-fine", name: "Turbine 16", detail: "Sechzehn schmale gedrehte Schaufeln", spokes: 16, split: 1, width: .012, sweep: .047, dish: .024, profile: "blade" },
  { id: "aero-disc", name: "Aero 5", detail: "Geschlossene Scheibe mit fünf runden Lüftungen", spokes: 5, split: 1, width: .035, sweep: 0, dish: .012, profile: "disc" },
  { id: "aero-slot", name: "Aero Slot", detail: "Scheibenrad mit acht langen Lüftungsschlitzen", spokes: 8, split: 1, width: .019, sweep: .018, dish: .015, profile: "slot" },
  { id: "dish-five", name: "Deep 5", detail: "Breite Fünfspeiche mit poliertem Tiefbett", spokes: 5, split: 1, width: .029, sweep: -.017, dish: .065, profile: "blade", bolts: true },
  { id: "basket-deep", name: "Basket 12", detail: "Dichtes Kreuzmuster mit zwölf Speichenpaaren", spokes: 12, split: 2, width: .0055, sweep: .055, dish: .058, profile: "mesh", bolts: true },
  { id: "forged-five", name: "Concave 5", detail: "Fünf stark konkave, nach außen breite Speichen", spokes: 5, split: 1, width: .02, sweep: .011, dish: .07, profile: "y" },
  { id: "rally-multi", name: "Rally 15", detail: "Fünfzehn gerade robuste Motorsport-Speichen", spokes: 15, split: 1, width: .01, sweep: -.006, dish: .045, profile: "straight" },
];
export const trimNames = { silver: "silberne", dark: "dunkle", brushed: "gebürstete", walnut: "Nussbaum-", "piano-black": "schwarze Hochglanz-", carbon: "Carbon-" };
export const upholsteryNames = { anthracite: "Anthrazit", cognac: "Cognac", ivory: "Elfenbein", burgundy: "Bordeaux", alcantara: "Dunkles Alcantara", tartan: "Karoeinsätze" };
export const steeringNames = { oem: "Serienlenkrad", sport: "Sportlenkrad", "flat-bottom": "Abgeflachtes Lenkrad", "three-spoke": "Dreispeichenlenkrad" };
export const shiftNames = { leather: "Lederknauf", short: "Kurzer Lederknauf", billet: "Aluminiumknauf", wood: "Holzknauf" };
