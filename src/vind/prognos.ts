import { vinkelskillnad } from "./riktning";

/**
 * Vindprognos - gemensam form för alla datakällor, och SMHI som första
 * källa (2026-11-06).
 *
 * VAL AV KÄLLA: SMHI:s öppna prognos snow1g v1 (samma källa som vädret
 * per drev i src/utils/vader.ts). Gratis, ingen nyckel, CC BY 4.0 - får
 * användas kommersiellt med SMHI angiven som källa. Rutnät ca 2,5 km,
 * timvis de första dygnen, uppdateras flera gånger per dygn. Open-Meteo
 * kräver betalning vid kommersiell användning och är avfört. MET Norway
 * Locationforecast bygger på samma typ av 2,5 km-modell (MEPS) och kan
 * läggas till som reserv bakom samma gränssnitt (VindKalla).
 *
 * Ingenting här hittar på värden: saknas ett värde i svaret blir det
 * null, och SMHI:s markör 9999 räknas som saknat.
 */

export interface VindSteg {
  /** Prognosens giltighetstid, unix-sekunder. */
  tid: number;
  /** Varifrån vinden kommer, grader. */
  franGrader: number | null;
  /** Medelvind m/s. */
  medelvind: number | null;
  /** Byvind m/s. */
  byvind: number | null;
}

export interface VindPrognos {
  /** Maskinnamn, sparas i databasen ("smhi"). */
  kalla: string;
  /** Visas för användaren, t.ex. "SMHI". */
  kallaNamn: string;
  /** Licenstext att visa, t.ex. "Källa: SMHI (CC BY 4.0)". */
  attribution: string;
  /** Positionen som efterfrågades (avrundad). */
  lat: number;
  lon: number;
  /** Beräkningspunkten källan faktiskt använde, om den anges. */
  rutLat: number | null;
  rutLon: number | null;
  /** Modellkörningens starttid, om källan anger den. */
  referensTid: number | null;
  /** När källan publicerade/godkände prognosen, om den anges. */
  publiceradTid: number | null;
  /** När Skade hämtade prognosen. */
  hamtadAt: number;
  steg: VindSteg[];
}

/** En utbytbar datakälla. */
export interface VindKalla {
  id: string;
  namn: string;
  hamta(lat: number, lon: number): Promise<VindPrognos>;
}

/** Positioner avrundas till 2 decimaler (ca 1 km) innan de skickas ut. */
export const avrundaPosition = (v: number) => Math.round(v * 100) / 100;

const SMHI_SAKNAS = 9999;

function tal(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v !== SMHI_SAKNAS ? v : null;
}

function tid(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Tolkar ett svar från SMHI snow1g point. Tål både [lon, lat] och
 * [[lon, lat]] i geometry, och saknade tidsfält.
 */
export function tolkaSmhi(
  json: unknown,
  lat: number,
  lon: number,
  hamtadAt: number,
): VindPrognos {
  const j = (json ?? {}) as {
    referenceTime?: string;
    approvedTime?: string;
    createdTime?: string;
    geometry?: { coordinates?: unknown };
    timeSeries?: { time?: string; validTime?: string; data?: Record<string, unknown> }[];
  };
  let rutLat: number | null = null;
  let rutLon: number | null = null;
  const k = j.geometry?.coordinates;
  const par = Array.isArray(k) && Array.isArray(k[0]) ? k[0] : k;
  if (Array.isArray(par) && par.length >= 2) {
    rutLon = tal(par[0]);
    rutLat = tal(par[1]);
  }
  const steg: VindSteg[] = [];
  for (const s of j.timeSeries ?? []) {
    const t = tid(s.time ?? s.validTime);
    if (t === null) continue;
    const d = s.data ?? {};
    const riktning = tal(d.wind_from_direction);
    steg.push({
      tid: t,
      franGrader: riktning === null ? null : ((riktning % 360) + 360) % 360,
      medelvind: tal(d.wind_speed),
      byvind: tal(d.wind_speed_of_gust),
    });
  }
  steg.sort((a, b) => a.tid - b.tid);
  return {
    kalla: "smhi",
    kallaNamn: "SMHI",
    attribution: "Källa: SMHI (CC BY 4.0)",
    lat,
    lon,
    rutLat,
    rutLon,
    referensTid: tid(j.referenceTime),
    publiceradTid: tid(j.approvedTime) ?? tid(j.createdTime),
    hamtadAt,
    steg,
  };
}

const SMHI_URL =
  "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point";

export const smhiKalla: VindKalla = {
  id: "smhi",
  namn: "SMHI",
  async hamta(lat, lon) {
    const la = avrundaPosition(lat);
    const lo = avrundaPosition(lon);
    const url = `${SMHI_URL}/lon/${lo}/lat/${la}/data.json?parameters=wind_speed,wind_speed_of_gust,wind_from_direction`;
    const svar = await fetch(url);
    if (!svar.ok) {
      throw new Error(`SMHI svarade ${svar.status}`);
    }
    return tolkaSmhi(await svar.json(), la, lo, Math.floor(Date.now() / 1000));
  },
};

/** Högst så här långt från vald tid får ett prognossteg ligga för att användas. */
export const MAX_AVSTAND_STEG = 90 * 60;

/** Prognossteget närmast `t` (inom 90 min), annars null. */
export function stegVid(prognos: VindPrognos | null, t: number): VindSteg | null {
  if (!prognos) return null;
  let basta: VindSteg | null = null;
  for (const s of prognos.steg) {
    if (!basta || Math.abs(s.tid - t) < Math.abs(basta.tid - t)) basta = s;
  }
  return basta && Math.abs(basta.tid - t) <= MAX_AVSTAND_STEG ? basta : null;
}

/**
 * Största riktningsskillnaden mot steget en timme före och efter. Ett
 * mått på hur mycket vinden vrider runt vald tid.
 */
export function riktningsskifte(prognos: VindPrognos | null, t: number): number | null {
  const mitt = stegVid(prognos, t);
  if (!mitt || mitt.franGrader === null) return null;
  let max: number | null = null;
  for (const dt of [-3600, 3600]) {
    const s = stegVid(prognos, t + dt);
    if (s && s !== mitt && s.franGrader !== null) {
      const d = vinkelskillnad(mitt.franGrader, s.franGrader);
      max = max === null ? d : Math.max(max, d);
    }
  }
  return max;
}

/**
 * Tidpunkter för tidsreglaget: hela timmar från sex timmar bakåt till
 * 48 timmar framåt, bara där prognosen faktiskt har ett steg.
 */
export function valbaraTider(prognos: VindPrognos | null, nu: number): number[] {
  if (!prognos) return [];
  const fran = nu - 6 * 3600;
  const till = nu + 48 * 3600;
  return prognos.steg
    .map((s) => s.tid)
    .filter((t) => t >= fran && t <= till && t % 3600 === 0);
}

/** Hela timmen närmast nu som finns i listan, annars första. */
export function narmasteTid(tider: number[], nu: number): number | null {
  if (tider.length === 0) return null;
  return tider.reduce((a, b) => (Math.abs(b - nu) < Math.abs(a - nu) ? b : a));
}

export type Aktualitet = "farsk" | "gammal" | "saknas";

/** Prognosen räknas som gammal om den hämtades för mer än 3 timmar sedan. */
export const GAMMAL_EFTER = 3 * 3600;

export function aktualitet(prognos: VindPrognos | null, nu: number): Aktualitet {
  if (!prognos || prognos.steg.length === 0) return "saknas";
  return nu - prognos.hamtadAt > GAMMAL_EFTER ? "gammal" : "farsk";
}

/** Timmar från modellkörningen (eller hämtningen) till vald tid, minst 0. */
export function prognosTimmar(prognos: VindPrognos, t: number): number {
  const bas = prognos.referensTid ?? prognos.hamtadAt;
  return Math.max(0, (t - bas) / 3600);
}
