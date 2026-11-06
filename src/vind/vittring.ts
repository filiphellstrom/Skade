import { blaserMot } from "./riktning";
import { tillLatLon, vrid } from "./geo";
import type { LatLon, Meter } from "./geo";

/**
 * Vittringszonen - första versionen av modellen (2026-11-06).
 *
 * VAD DET ÄR: en geometrisk uppskattning av åt vilket håll och ungefär
 * hur brett vittring från en punkt förs med vinden. Det är INTE en
 * spridningsberäkning med terräng, skog eller termik, och kanterna är
 * inga fysiska gränser. Zonen ritas därför som tre mjuka lager i stället
 * för en skarp kant.
 *
 * Det som modellen tar hänsyn till:
 *  1. Vindriktning (prognos) → zonen läggs nedströms, i riktningen vinden
 *     blåser MOT (blaserMot() i riktning.ts).
 *  2. Medelvind (prognos) → längden när "Auto" är valt.
 *  3. Byighet (byvind/medelvind, prognos) → bredare zon.
 *  4. Svag vind → bredare zon (svag vind vrider och virvlar mer).
 *  5. Prognosens osäkerhet: hur långt fram prognosen gäller och hur mycket
 *     riktningen skiftar timmarna före och efter vald tid → bredare zon.
 *  6. Avståndet: zonen vidgas linjärt med avståndet från startpunkten,
 *     och de inre (starkare) lagren är kortare än det yttre.
 *
 * Det som INTE är modellerat (ännu): terräng och höjdskillnader, skog och
 * öppna ytor, lokala vindar (sjöbris, kalluftsflöden i dalar), termik och
 * temperaturskiktning. Konstanterna nedan är rimliga antaganden för
 * visualisering, inte uppmätta värden - de är samlade här för att kunna
 * justeras efter erfarenhet i fält.
 */

export interface VindLage {
  /** Meteorologisk riktning, varifrån vinden kommer (grader). */
  franGrader: number;
  /** Medelvind, m/s. */
  medelvind: number;
  /** Byvind, m/s, om prognosen har den. */
  byvind: number | null;
}

export interface Osakerhet {
  /** Timmar från prognosens hämtning/körning till vald tid (0 = nu). */
  prognosTimmar: number;
  /** Största riktningsskillnaden (grader) mot timmen före/efter, om känd. */
  riktningsskifte: number | null;
}

export interface ZonInstallning {
  /** Längd i meter, eller "auto" (styrs av medelvinden). */
  langd: number | "auto";
  /** Breddfaktor, 1 = modellens bredd. */
  bredd: number;
}

export interface ZonLager {
  punkter: LatLon[];
  /** 0-1, hur stark (ogenomskinlig) lagret ritas. */
  styrka: number;
}

export type OsakerhetsNiva = "lag" | "medel" | "hog";

export interface Vittringszon {
  start: LatLon;
  /** Kartriktning zonen pekar (vart vinden blåser), grader. */
  riktning: number;
  langdMeter: number;
  /** Spridning (1 standardavvikelse) i grader, efter breddfaktorn. */
  spridningGrader: number;
  niva: OsakerhetsNiva;
  /** Yttersta lagret först (ritas underst). */
  lager: ZonLager[];
  /** Mittlinjen från start till zonens slut. */
  mittlinje: LatLon[];
  svagVind: boolean;
}

// --- Antaganden (justerbara) -------------------------------------------

/** Auto-längd: 150 m + 70 m per m/s, mellan 150 och 900 m. */
export const LANGD_BAS = 150;
export const LANGD_PER_MS = 70;
export const LANGD_MIN = 150;
export const LANGD_MAX = 900;
/** Under detta räknas vinden som svag och vridande. */
export const SVAG_VIND = 1.0;
/** Zonens radie runt själva startpunkten, meter. */
const START_RADIE = 12;
/** Bredden får aldrig bli mer än så här (halvvinkel), annars blir det en cirkel. */
const MAX_HALVVINKEL = 65;

/** Lager: antal standardavvikelser åt varje sida, andel av längden, styrka. */
const LAGER = [
  { sigma: 1.6, langd: 1.0, styrka: 0.16 },
  { sigma: 1.0, langd: 0.85, styrka: 0.26 },
  { sigma: 0.5, langd: 0.6, styrka: 0.4 },
];

/** Längd när "Auto" är valt. */
export function autoLangd(medelvind: number): number {
  const v = Math.max(0, medelvind);
  return Math.min(LANGD_MAX, Math.max(LANGD_MIN, LANGD_BAS + LANGD_PER_MS * v));
}

/**
 * Riktningens spridning (1 standardavvikelse, grader) ur vind och
 * prognososäkerhet. Två delar som läggs ihop kvadratiskt:
 *  - turbulens: grund 10°, + byighet över det normala, + svag vind
 *  - prognos: 4° + 0,6° per timme framåt (max 20°), + halva skiftet
 *    mellan timmarna runt vald tid
 */
export function riktningsspridning(vind: VindLage, osakerhet: Osakerhet): number {
  const u = Math.max(0, vind.medelvind);
  let turb = 10;
  if (vind.byvind !== null && u > 0.3) {
    const byfaktor = vind.byvind / u;
    // Byvind är normalt 1,3-1,5 gånger medelvinden. Först över det
    // räknas vinden som ovanligt byig.
    turb += Math.min(20, Math.max(0, 15 * (byfaktor - 1.3)));
  }
  turb += 15 * Math.max(0, 1 - u / 3);
  if (u < SVAG_VIND) turb = Math.max(turb, 45);

  const prog =
    Math.min(20, 4 + 0.6 * Math.max(0, osakerhet.prognosTimmar)) +
    0.5 * (osakerhet.riktningsskifte ?? 0);

  return Math.min(70, Math.max(8, Math.hypot(turb, prog)));
}

export function osakerhetsNiva(spridning: number): OsakerhetsNiva {
  if (spridning < 18) return "lag";
  if (spridning < 32) return "medel";
  return "hog";
}

/**
 * En lagerform i lokala meter, med framåt = +y (nedströms) och
 * höger = +x. Kilformad med rundad spets och en liten halvcirkel bakom
 * startpunkten.
 */
function lagerform(langd: number, halvvinkel: number): Meter[] {
  const tan = Math.tan((Math.min(halvvinkel, MAX_HALVVINKEL) * Math.PI) / 180);
  const halvbredd = (y: number) => START_RADIE + y * tan;
  const steg = 10;
  const hoger: Meter[] = [];
  for (let i = 0; i <= steg; i++) {
    const y = (langd * i) / steg;
    hoger.push({ x: halvbredd(y), y });
  }
  // Rundad ände: halv ellips från höger till vänster kant.
  const slutBredd = halvbredd(langd);
  const djup = Math.min(slutBredd * 0.5, langd * 0.25);
  const ande: Meter[] = [];
  for (let i = 1; i < 8; i++) {
    const v = (Math.PI * i) / 8;
    ande.push({ x: slutBredd * Math.cos(v), y: langd + djup * Math.sin(v) });
  }
  const vanster = hoger.map((p) => ({ x: -p.x, y: p.y })).reverse();
  // Halvcirkel bakom startpunkten, från vänster tillbaka till höger.
  const bak: Meter[] = [];
  for (let i = 1; i < 6; i++) {
    const v = Math.PI + (Math.PI * i) / 6;
    bak.push({ x: -START_RADIE * Math.cos(v - Math.PI), y: START_RADIE * Math.sin(v) });
  }
  return [...hoger, ...ande, ...vanster, ...bak];
}

/** Bygger zonen. Returnerar null om vinddata saknas - då ritas ingen zon. */
export function beraknaVittringszon(
  start: LatLon,
  vind: VindLage | null,
  osakerhet: Osakerhet,
  installning: ZonInstallning,
): Vittringszon | null {
  if (
    !vind ||
    !Number.isFinite(vind.franGrader) ||
    !Number.isFinite(vind.medelvind)
  ) {
    return null;
  }
  const riktning = blaserMot(vind.franGrader);
  const langd =
    installning.langd === "auto" ? autoLangd(vind.medelvind) : installning.langd;
  const bredd = Math.max(0.2, installning.bredd);
  const spridning = riktningsspridning(vind, osakerhet) * bredd;

  const lager: ZonLager[] = LAGER.map((l) => ({
    styrka: l.styrka,
    punkter: lagerform(langd * l.langd, spridning * l.sigma).map((p) =>
      tillLatLon(start, vrid(p, riktning)),
    ),
  }));

  return {
    start,
    riktning,
    langdMeter: langd,
    spridningGrader: spridning,
    niva: osakerhetsNiva(spridning),
    lager,
    mittlinje: [start, tillLatLon(start, vrid({ x: 0, y: langd }, riktning))],
    svagVind: vind.medelvind < SVAG_VIND,
  };
}
