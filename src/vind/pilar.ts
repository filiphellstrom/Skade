import { blaserMot } from "./riktning";
import { forflytta, rutnat } from "./geo";
import type { LatLon, Omrade } from "./geo";

/**
 * Vindpilar över kartan, i lat/lon (ritas som Polyline). Pilen pekar
 * dit vinden BLÅSER: en västlig vind (270°) ger pilar mot öster.
 *
 * Pilens längd och tjocklek visar vindstyrkan, men pilarna får alltid
 * plats i sin ruta så att de inte skymmer kartan.
 */

export interface Vindpil {
  /** Skaft från bakände till spets. */
  skaft: [LatLon, LatLon];
  /** Pilhuvud: vänster flik, spets, höger flik. */
  huvud: [LatLon, LatLon, LatLon];
  /** Linjetjocklek i punkter. */
  tjocklek: number;
  /** Medelvind m/s för pilen (för tillgänglighet och test). */
  medelvind: number;
}

/** Vindstyrka där pilen når full längd. */
const FULL_STYRKA = 12;
/** Under detta ritas ingen pil (lugnt). */
export const LUGNT = 0.5;

/**
 * En pil centrerad i `mitt`. `ruta` = avståndet mellan pilarna i meter;
 * pilen blir 30-75 % av rutan beroende på vindstyrkan.
 */
export function byggPil(
  mitt: LatLon,
  franGrader: number,
  medelvind: number,
  ruta: number,
): Vindpil | null {
  if (!Number.isFinite(franGrader) || !Number.isFinite(medelvind) || medelvind < LUGNT) {
    return null;
  }
  const mot = blaserMot(franGrader);
  const andel = Math.min(medelvind, FULL_STYRKA) / FULL_STYRKA;
  const langd = ruta * (0.3 + 0.45 * andel);
  const bak = forflytta(mitt, mot + 180, langd / 2);
  const spets = forflytta(mitt, mot, langd / 2);
  const flik = langd * 0.32;
  return {
    skaft: [bak, spets],
    huvud: [
      forflytta(spets, mot + 180 - 28, flik),
      spets,
      forflytta(spets, mot + 180 + 28, flik),
    ],
    tjocklek: 1.5 + 2.5 * andel,
    medelvind,
  };
}

/** Rutnätet av pilplatser för det synliga området (ca 4 x 6 pilar). */
export function pilplatser(omrade: Omrade): { punkter: LatLon[]; ruta: number } {
  const kolumner = 4;
  const rader = 6;
  const punkter = rutnat(omrade, kolumner, rader);
  const bredd = omrade.longitudeDelta * 111320 * Math.cos((omrade.latitude * Math.PI) / 180);
  const hojd = omrade.latitudeDelta * 110540;
  return { punkter, ruta: Math.min(bredd / kolumner, hojd / rader) };
}

/**
 * Punkter att hämta prognos för, så att pilarna över det synliga området
 * får värden från rätt del av kartan. SMHI:s rutnät är ca 2,5 km, så ett
 * tätare urval ger ingen ny information. Punkterna ligger på jämna
 * 0,03° lat × 0,05° lon (≈ 3 × 3 km) och avrundas till 2 decimaler, som
 * alla positioner som skickas ut. Högst `max` punkter - annars glesas
 * nätet ut.
 */
export function provpunkter(o: Omrade, max = 9): { lat: number; lon: number }[] {
  let latSteg = 0.03;
  let lonSteg = 0.05;
  const syd = o.latitude - o.latitudeDelta / 2;
  const nord = o.latitude + o.latitudeDelta / 2;
  const vast = o.longitude - o.longitudeDelta / 2;
  const ost = o.longitude + o.longitudeDelta / 2;
  for (let varv = 0; varv < 12; varv++) {
    const lats: number[] = [];
    const lons: number[] = [];
    for (let i = Math.ceil(syd / latSteg); i * latSteg <= nord; i++) lats.push(i * latSteg);
    for (let i = Math.ceil(vast / lonSteg); i * lonSteg <= ost; i++) lons.push(i * lonSteg);
    if (lats.length === 0) lats.push(o.latitude);
    if (lons.length === 0) lons.push(o.longitude);
    if (lats.length * lons.length <= max) {
      const ut = new Map<string, { lat: number; lon: number }>();
      for (const la of lats) {
        for (const lo of lons) {
          const p = { lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100 };
          ut.set(`${p.lat},${p.lon}`, p);
        }
      }
      return [...ut.values()];
    }
    latSteg *= 2;
    lonSteg *= 2;
  }
  return [{ lat: Math.round(o.latitude * 100) / 100, lon: Math.round(o.longitude * 100) / 100 }];
}

/** Index för den punkt i listan som ligger närmast (i ungefärliga meter). */
export function narmaste(p: LatLon, kandidater: { lat: number; lon: number }[]): number {
  let basta = -1;
  let bastaAvstand = Infinity;
  const coslat = Math.cos((p.latitude * Math.PI) / 180);
  kandidater.forEach((k, i) => {
    const d = Math.hypot((k.lat - p.latitude) * 1, (k.lon - p.longitude) * coslat);
    if (d < bastaAvstand) {
      bastaAvstand = d;
      basta = i;
    }
  });
  return basta;
}
