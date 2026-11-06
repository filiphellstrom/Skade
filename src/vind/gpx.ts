/**
 * GPX-import (WeHunt-export "map-export.gpx" och vanlig GPX 1.1).
 *
 * Tolkas med reguljära uttryck i stället för en XML-parser: React Native
 * har ingen DOMParser, och GPX från WeHunt är platt och förutsägbar.
 * Koordinaterna behålls exakt som i filen (ingen avrundning), och
 * WeHunts kategori (<type>) sparas oförändrad. Svenska namn för
 * kategorierna finns i KATEGORIER.
 */

export interface GpxPunkt {
  namn: string;
  /** Kategori som i filen, t.ex. "stand", "tower". Tom sträng om den saknas. */
  typ: string;
  lat: number;
  lon: number;
}

export interface GpxSpar {
  namn: string;
  typ: string;
  punkter: { latitude: number; longitude: number }[];
}

export interface GpxInnehall {
  punkter: GpxPunkt[];
  spar: GpxSpar[];
  /** Antal punkter i filen som var dubbletter av en tidigare punkt i samma fil. */
  dubbletterIFilen: number;
}

/** WeHunts kategorier → svenska. Okända visas som "Övrigt". */
export const KATEGORIER: Record<string, string> = {
  stand: "Pass",
  tower: "Torn",
  burrow: "Gryt",
  parking: "Parkering",
  salt_stone: "Saltsten",
  feeding_grounds: "Foderplats",
  bait: "Åtel",
  gathering_place: "Samlingsplats",
  bridge: "Bro",
  crossing: "Övergång",
  camera: "Kamera",
  other: "Övrigt",
};

export function kategoriNamn(typ: string): string {
  return KATEGORIER[typ] ?? "Övrigt";
}

/** Pass och torn - de som går att välja som jägarposition. */
export function arPass(typ: string): boolean {
  return typ === "stand" || typ === "tower";
}

function avkoda(text: string): string {
  const cdata = text.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const t = cdata ? cdata[1] : text;
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

function tagg(xml: string, namn: string): string {
  const m = xml.match(new RegExp(`<${namn}(?:\\s[^>]*)?>([\\s\\S]*?)</${namn}>`));
  return m ? avkoda(m[1]) : "";
}

function attribut(tagg: string, namn: string): number | null {
  const m = tagg.match(new RegExp(`\\s${namn}\\s*=\\s*["']([^"']+)["']`));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function giltig(lat: number | null, lon: number | null): lat is number {
  return (
    lat !== null &&
    lon !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Nyckel för dubblettkontroll: kategori, namn och position på ~1 m. */
export function punktNyckel(p: Pick<GpxPunkt, "namn" | "typ" | "lat" | "lon">): string {
  return `${p.typ}|${p.namn.trim().toLocaleLowerCase("sv-SE")}|${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
}

/** Tolkar en GPX-fil. Kastar fel om filen inte ser ut som GPX. */
export function tolkaGpx(xml: string): GpxInnehall {
  if (!/<gpx[\s>]/.test(xml)) {
    throw new Error("Filen är ingen GPX-fil.");
  }
  const punkter: GpxPunkt[] = [];
  const sedda = new Set<string>();
  let dubbletter = 0;

  const wptRe = /<wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/wpt>)/g;
  let m: RegExpExecArray | null;
  while ((m = wptRe.exec(xml))) {
    const lat = attribut(m[1], "lat");
    const lon = attribut(m[1], "lon");
    if (!giltig(lat, lon)) continue;
    const inre = m[2] ?? "";
    const p: GpxPunkt = {
      namn: tagg(inre, "name"),
      typ: tagg(inre, "type"),
      lat,
      lon: lon as number,
    };
    const nyckel = punktNyckel(p);
    if (sedda.has(nyckel)) {
      dubbletter++;
      continue;
    }
    sedda.add(nyckel);
    punkter.push(p);
  }

  const spar: GpxSpar[] = [];
  const sparRe = /<(trk|rte)\b[^>]*>([\s\S]*?)<\/\1>/g;
  while ((m = sparRe.exec(xml))) {
    const inre = m[2];
    // Namn och typ på spåret, inte på dess punkter.
    const huvud = inre.split(/<(?:trkseg|trkpt|rtept)\b/)[0];
    const pRe = /<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>)/g;
    const lista: GpxSpar["punkter"] = [];
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(inre))) {
      const lat = attribut(pm[1], "lat");
      const lon = attribut(pm[1], "lon");
      if (giltig(lat, lon)) lista.push({ latitude: lat, longitude: lon as number });
    }
    if (lista.length >= 2) {
      spar.push({ namn: tagg(huvud, "name"), typ: tagg(huvud, "type"), punkter: lista });
    }
  }

  return { punkter, spar, dubbletterIFilen: dubbletter };
}

/**
 * Jaktmarkens gräns: ett spår med typen "border" (WeHunt), annars det
 * första spåret som är slutet (första och sista punkten inom ~20 m).
 */
export function hittaGrans(spar: GpxSpar[]): GpxSpar | null {
  const border = spar.find((s) => s.typ === "border");
  if (border) return border;
  return (
    spar.find((s) => {
      const a = s.punkter[0];
      const b = s.punkter[s.punkter.length - 1];
      return (
        s.punkter.length >= 4 &&
        Math.abs(a.latitude - b.latitude) < 0.0002 &&
        Math.abs(a.longitude - b.longitude) < 0.0004
      );
    }) ?? null
  );
}
