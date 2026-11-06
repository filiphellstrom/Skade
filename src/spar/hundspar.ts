/**
 * Hundspår från Garmin (Alpha 100 och nyare, 2026-11-07).
 *
 * Alpha-handenheten exporterar GPX via USB:
 * - En fil per halsband, t.ex. "Aston.gpx": ett <trk> med halsbandets
 *   namn i Alpha som <name>, punkter var ~2,5–3 s, bara lat/lon/tid.
 * - Förarens eget spår, "Current.gpx" ("Aktuellt spår"): ett <trk> med
 *   ett segment per dag, punkter var ~13 s, med höjd.
 *
 * Hunden avgörs av DREVEN, inte av halsbandets namn: samma halsband kan
 * sitta på Aston på förmiddagen och Astrid på eftermiddagen. Punkterna
 * under ett drev (från släpp, om det finns, till drevslut) blir drevets
 * hundspår och får drevets hund. Halsbandets namn används bara för att
 * välja mellan flera halsband som har spår under samma drev.
 *
 * Ren beräkningskod utan React Native-beroenden, testas med `npm test`.
 */

export interface SparPunkt {
  lat: number;
  lon: number;
  /** Unix-tid i sekunder. */
  t: number;
}

export interface GarminSpar {
  /** <name> i filen - halsbandets namn i Alpha, eller "Aktuellt spår: …". */
  namn: string;
  /** Förarens eget spår (handenhetens "Aktuellt spår"), inte ett halsband. */
  forare: boolean;
  /** Alla segment ihopslagna, sorterade på tid. */
  punkter: SparPunkt[];
}

export interface GarminFil {
  /** creator-attributet, t.ex. "Alpha 100 EMEA/APAC". */
  enhet: string;
  spar: GarminSpar[];
}

/** Ett drev som spår ska fördelas på. */
export interface DrevFonster {
  id: string;
  hundId: string;
  hundNamn: string;
  /** Spårets början: släpp om det finns, annars upptag (drevstart). */
  fran: number;
  /** Drevslut. */
  till: number;
}

const FORARE_NAMN = /^\s*(aktuellt spår|current track|aktuell spor|nykyinen jälki)/i;

function avkoda(text: string): string {
  return text
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

function attribut(tagg: string, namn: string): number | null {
  const m = tagg.match(new RegExp(`\\s${namn}\\s*=\\s*["']([^"']+)["']`));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/**
 * Tolkar en GPX-fil från en Garmin-handenhet. Punkter utan tid eller med
 * ogiltiga koordinater hoppas över (de går inte att koppla till ett drev).
 * Kastar fel om filen inte är GPX.
 */
export function tolkaGarminGpx(xml: string): GarminFil {
  if (!/<gpx[\s>]/.test(xml)) {
    throw new Error("Filen är ingen GPX-fil.");
  }
  const creator = xml.match(/<gpx\b[^>]*\screator\s*=\s*["']([^"']*)["']/);
  const spar: GarminSpar[] = [];
  const trkRe = /<trk\b[^>]*>([\s\S]*?)<\/trk>/g;
  let m: RegExpExecArray | null;
  while ((m = trkRe.exec(xml))) {
    const inre = m[1];
    const huvud = inre.split(/<trkseg\b/)[0];
    const namnM = huvud.match(/<name>([\s\S]*?)<\/name>/);
    const namn = namnM ? avkoda(namnM[1]) : "";
    const punkter: SparPunkt[] = [];
    const pRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(inre))) {
      const lat = attribut(pm[1], "lat");
      const lon = attribut(pm[1], "lon");
      const tid = (pm[2] ?? "").match(/<time>([^<]+)<\/time>/);
      if (lat === null || lon === null || !tid) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      const ms = Date.parse(tid[1].trim());
      if (!Number.isFinite(ms)) continue;
      punkter.push({ lat, lon, t: Math.round(ms / 1000) });
    }
    if (punkter.length === 0) continue;
    punkter.sort((a, b) => a.t - b.t);
    spar.push({ namn, forare: FORARE_NAMN.test(namn), punkter });
  }
  return { enhet: creator ? avkoda(creator[1]) : "", spar };
}

/** Avstånd i meter (haversine). */
export function avstandMeter(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Sträcka i meter utan GPS-brus: ett steg räknas först när positionen
 * flyttat sig mer än `brus` meter från senast räknade punkt. Annars
 * växer sträckan medan hunden står still (31 okt: 25,6 km rått, 23,7 km
 * filtrerat).
 */
export function stracka(punkter: SparPunkt[], brus = 8): number {
  if (punkter.length < 2) return 0;
  let summa = 0;
  let sist = punkter[0];
  for (let i = 1; i < punkter.length; i++) {
    const d = avstandMeter(sist, punkter[i]);
    if (d > brus) {
      summa += d;
      sist = punkter[i];
    }
  }
  return summa;
}

/** Punkterna inom [fran, till] (sekunder, inklusive). */
export function inomTid(punkter: SparPunkt[], fran: number, till: number): SparPunkt[] {
  return punkter.filter((p) => p.t >= fran && p.t <= till);
}

/**
 * Förarens position vid tiden t: närmaste punkt i tid, om den ligger
 * inom `maxGlapp` sekunder. Förarens spår har glesare punkter (~13 s).
 */
export function positionVid(punkter: SparPunkt[], t: number, maxGlapp = 120): SparPunkt | null {
  if (punkter.length === 0) return null;
  let lo = 0;
  let hi = punkter.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (punkter[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  const kandidater = [punkter[lo], punkter[lo - 1]].filter(Boolean) as SparPunkt[];
  let bast: SparPunkt | null = null;
  for (const k of kandidater) {
    if (!bast || Math.abs(k.t - t) < Math.abs(bast.t - t)) bast = k;
  }
  return bast && Math.abs(bast.t - t) <= maxGlapp ? bast : null;
}

/** Hundens största avstånd från föraren (meter), eller null utan förarspår. */
export function maxAvstandFranForare(hund: SparPunkt[], forare: SparPunkt[]): number | null {
  if (forare.length === 0 || hund.length === 0) return null;
  let max: number | null = null;
  for (const p of hund) {
    const f = positionVid(forare, p.t);
    if (!f) continue;
    const d = avstandMeter(p, f);
    if (max === null || d > max) max = d;
  }
  return max;
}

/** Jämförbar nyckel för namn (skiftläge och mellanslag spelar ingen roll). */
function namnNyckel(s: string): string {
  return s.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

export interface DrevSpar {
  drevId: string;
  hundId: string;
  /** Halsbandets namn i filen spåret kom från. */
  halsband: string;
  punkter: SparPunkt[];
}

export interface Fordelning {
  drevSpar: DrevSpar[];
  /** Drev där flera halsband hade spår och inget namn matchade hunden. */
  oklara: { drevId: string; halsband: string[] }[];
  /** Drev utan några halsbandspunkter i filerna. */
  utanSpar: string[];
}

/**
 * Fördelar halsbandsspåren på dreven. För varje drev tas punkterna inom
 * drevets fönster. Har bara ett halsband punkter där blir det drevets
 * spår, oavsett halsbandets namn. Har flera det, väljs det halsband vars
 * namn är drevets hund; finns inget sådant blir drevet "oklart" och får
 * inget spår (hellre inget än fel hund).
 *
 * `minPunkter`: färre punkter än så räknas inte som ett spår (enstaka
 * punkter när ett halsband slås på eller av).
 */
export function fordelaPaDrev(
  halsband: GarminSpar[],
  drev: DrevFonster[],
  minPunkter = 5,
): Fordelning {
  const drevSpar: DrevSpar[] = [];
  const oklara: Fordelning["oklara"] = [];
  const utanSpar: string[] = [];
  for (const d of drev) {
    const kandidater = halsband
      .filter((h) => !h.forare)
      .map((h) => ({ halsband: h.namn, punkter: inomTid(h.punkter, d.fran, d.till) }))
      .filter((k) => k.punkter.length >= minPunkter);
    if (kandidater.length === 0) {
      utanSpar.push(d.id);
      continue;
    }
    let vald = kandidater.length === 1 ? kandidater[0] : null;
    if (!vald) {
      const matchar = kandidater.filter((k) => namnNyckel(k.halsband) === namnNyckel(d.hundNamn));
      if (matchar.length === 1) vald = matchar[0];
    }
    if (!vald) {
      oklara.push({ drevId: d.id, halsband: kandidater.map((k) => k.halsband) });
      continue;
    }
    drevSpar.push({ drevId: d.id, hundId: d.hundId, halsband: vald.halsband, punkter: vald.punkter });
  }
  return { drevSpar, oklara, utanSpar };
}

/**
 * Jaktdagens del av ett spår (förarens eller ett helt halsband): punkter
 * på jaktdagens lokala datum, begränsade till första drevfönstrets början
 * minus `marginal` och sista drevslutet plus `marginal`. Saknas drev tas
 * hela dagen. Förarens fil innehåller alla dagar sedan den rensades, och
 * ibland bilresor - därför begränsningen.
 *
 * `dagStart`/`dagSlut`: jaktdagens lokala dygn som Unix-sekunder.
 */
export function dagensDel(
  punkter: SparPunkt[],
  dagStart: number,
  dagSlut: number,
  drev: { fran: number; till: number }[],
  marginal = 60 * 60,
): SparPunkt[] {
  let fran = dagStart;
  let till = dagSlut;
  if (drev.length > 0) {
    fran = Math.max(dagStart, Math.min(...drev.map((d) => d.fran)) - marginal);
    till = Math.min(dagSlut, Math.max(...drev.map((d) => d.till)) + marginal);
  }
  return inomTid(punkter, fran, till);
}

/**
 * Kompakt lagring: [[lat, lon, t], …] med 6 decimaler (~0,1 m). En
 * jaktdag med 5 800 punkter blir ~200 kB text.
 */
export function packa(punkter: SparPunkt[]): string {
  return JSON.stringify(punkter.map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6, p.t]));
}

export function packaUpp(json: string | null): SparPunkt[] {
  if (!json) return [];
  try {
    const rader = JSON.parse(json) as unknown;
    if (!Array.isArray(rader)) return [];
    return rader
      .filter((r): r is [number, number, number] => Array.isArray(r) && r.length >= 3)
      .map(([lat, lon, t]) => ({ lat, lon, t }));
  } catch {
    return [];
  }
}

/** Spår med fler punkter än `max` glesas ut för kartan (första och sista behålls). */
export function glesa<T>(punkter: T[], max = 1500): T[] {
  if (punkter.length <= max) return punkter;
  const steg = (punkter.length - 1) / (max - 1);
  const ut: T[] = [];
  for (let i = 0; i < max; i++) ut.push(punkter[Math.round(i * steg)]);
  return ut;
}
