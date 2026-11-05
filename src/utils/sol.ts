/**
 * Soluppgång och solnedgång ur position och datum, helt offline.
 *
 * Solekvationen (NOAA:s förenklade variant, se Wikipedia "Sunrise
 * equation"): räknar ut solens passage genom meridianen och timvinkeln
 * då solens övre kant står i horisonten (-0,833°, refraktion inräknad).
 * Felet är normalt under en minut, i fjällen upp mot ett par minuter.
 *
 * Fungerar även långt norrut: under polarnatt/midnattssol finns ingen
 * uppgång eller nedgång den dagen, och nastaSolhandelse() letar då vidare
 * framåt dag för dag.
 */

const RAD = Math.PI / 180;
const J2000 = 2451545.0;
const MS_PER_DAG = 86400000;
const UNIX_JD = 2440587.5;

function tillJulianskDag(ms: number): number {
  return ms / MS_PER_DAG + UNIX_JD;
}

function franJulianskDag(jd: number): number {
  return (jd - UNIX_JD) * MS_PER_DAG;
}

export interface SolDag {
  /** null om solen inte går upp/ner den dagen. */
  upp: Date | null;
  ner: Date | null;
  /** "polarnatt" = solen under horisonten hela dagen, "midnattssol" = över. */
  lage: "normal" | "polarnatt" | "midnattssol";
}

/**
 * Upp- och nedgång för det dygn som innehåller `middag` (bäst kl 12
 * lokal tid på den dag man vill veta).
 */
export function solDag(middag: Date, lat: number, lon: number): SolDag {
  const n = Math.round(
    tillJulianskDag(middag.getTime()) - J2000 + 0.0008 + lon / 360,
  );
  const jStjarna = n - lon / 360;
  const m = (357.5291 + 0.98560028 * jStjarna) % 360;
  const mRad = m * RAD;
  const c =
    1.9148 * Math.sin(mRad) +
    0.02 * Math.sin(2 * mRad) +
    0.0003 * Math.sin(3 * mRad);
  const lambda = ((m + c + 180 + 102.9372) % 360) * RAD;
  const jTransit =
    J2000 + jStjarna + 0.0053 * Math.sin(mRad) - 0.0069 * Math.sin(2 * lambda);
  const sinDekl = Math.sin(lambda) * Math.sin(23.4397 * RAD);
  const cosDekl = Math.cos(Math.asin(sinDekl));
  const cosOmega =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDekl) /
    (Math.cos(lat * RAD) * cosDekl);

  if (cosOmega > 1) return { upp: null, ner: null, lage: "polarnatt" };
  if (cosOmega < -1) return { upp: null, ner: null, lage: "midnattssol" };

  const omega = Math.acos(cosOmega) / RAD;
  return {
    upp: new Date(franJulianskDag(jTransit - omega / 360)),
    ner: new Date(franJulianskDag(jTransit + omega / 360)),
    lage: "normal",
  };
}

export interface SolHandelse {
  typ: "uppgang" | "nedgang";
  tid: Date;
}

/**
 * Nästa soluppgång eller solnedgång efter `nu`, vilken som kommer först.
 * Letar upp till ett år framåt (räcker även för polarnatt i Kiruna).
 */
export function nastaSolhandelse(
  nu: Date,
  lat: number,
  lon: number,
): SolHandelse | null {
  // Börja med gårdagen: en nedgång strax efter midnatt UTC kan höra till
  // föregående dygn i solekvationen.
  let foregaende = solDag(
    new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 2, 12),
    lat,
    lon,
  ).lage;
  for (let d = -1; d <= 370; d++) {
    const middag = new Date(
      nu.getFullYear(),
      nu.getMonth(),
      nu.getDate() + d,
      12,
      0,
      0,
    );
    const dag = solDag(middag, lat, lon);
    const kandidater: SolHandelse[] = [];
    // Första dagen efter midnattssol: ekvationens "uppgång" före dygnets
    // första nedgång är bara ett räknefel vid gränsen - solen var redan uppe.
    if (dag.upp && dag.upp > nu && foregaende !== "midnattssol") {
      kandidater.push({ typ: "uppgang", tid: dag.upp });
    }
    if (dag.ner && dag.ner > nu)
      kandidater.push({ typ: "nedgang", tid: dag.ner });
    foregaende = dag.lage;
    if (kandidater.length > 0) {
      kandidater.sort((a, b) => a.tid.getTime() - b.tid.getTime());
      return kandidater[0];
    }
  }
  return null;
}

const MANADER = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

/** "07:24" i telefonens tidszon. */
export function formateraKlocka(tid: Date): string {
  return `${String(tid.getHours()).padStart(2, "0")}:${String(tid.getMinutes()).padStart(2, "0")}`;
}

/** "" om tiden är i dag, annars "i morgon" eller t.ex. "2 jan". */
export function solDagEtikett(tid: Date, nu: Date): string {
  const idag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const dagen = new Date(tid.getFullYear(), tid.getMonth(), tid.getDate());
  const skillnad = Math.round((dagen.getTime() - idag.getTime()) / MS_PER_DAG);
  if (skillnad <= 0) return "";
  if (skillnad === 1) return "i morgon";
  return `${tid.getDate()} ${MANADER[tid.getMonth()]}`;
}

/** "07:24", "i morgon 07:24" eller "2 jan 11:32". */
export function formateraSoltid(tid: Date, nu: Date): string {
  const dag = solDagEtikett(tid, nu);
  return dag ? `${dag} ${formateraKlocka(tid)}` : formateraKlocka(tid);
}
