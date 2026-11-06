/**
 * Koordinatomvandling för Vind och vittring.
 *
 * Kartan arbetar i WGS84 (lat/lon i grader). Pilar och vittringszon
 * byggs i ett lokalt plant system i meter (öst, nord) runt en startpunkt
 * och räknas sedan om till lat/lon. På några kilometers avstånd är felet
 * med den här platta approximationen (ekvirektangulär, jordradie 6 371 km)
 * långt under en meter - mycket mindre än allt annat i modellen.
 *
 * Eftersom geometrin ritas i lat/lon (react-native-maps Polygon/Polyline)
 * följer den med när kartan vrids eller zoomas. Inga skärmvinklar behövs.
 */

export interface LatLon {
  latitude: number;
  longitude: number;
}

/** Lokal punkt i meter: x = öst, y = nord. */
export interface Meter {
  x: number;
  y: number;
}

export const JORDRADIE = 6371008.8;
const RAD = Math.PI / 180;

/** Meter per grad latitud, och per grad longitud på en viss latitud. */
export function meterPerGrad(lat: number): { lat: number; lon: number } {
  const perGrad = JORDRADIE * RAD;
  return { lat: perGrad, lon: perGrad * Math.cos(lat * RAD) };
}

/** Lokal punkt (meter från origo) → lat/lon. */
export function tillLatLon(origo: LatLon, p: Meter): LatLon {
  const m = meterPerGrad(origo.latitude);
  return {
    latitude: origo.latitude + p.y / m.lat,
    longitude: origo.longitude + p.x / m.lon,
  };
}

/** lat/lon → lokal punkt i meter relativt origo. */
export function tillMeter(origo: LatLon, p: LatLon): Meter {
  const m = meterPerGrad(origo.latitude);
  return {
    x: (p.longitude - origo.longitude) * m.lon,
    y: (p.latitude - origo.latitude) * m.lat,
  };
}

/**
 * Enhetsvektor (öst, nord) för en kartriktning i grader medurs från nord.
 * 0 = norr (0, 1), 90 = öster (1, 0).
 */
export function riktningsvektor(kurs: number): Meter {
  const r = kurs * RAD;
  return { x: Math.sin(r), y: Math.cos(r) };
}

/** Punkten `meter` bort från `fran` i riktning `kurs` (grader från nord). */
export function forflytta(fran: LatLon, kurs: number, meter: number): LatLon {
  const v = riktningsvektor(kurs);
  return tillLatLon(fran, { x: v.x * meter, y: v.y * meter });
}

/** Bäring (grader från nord, medurs) från a till b. */
export function baring(a: LatLon, b: LatLon): number {
  const p = tillMeter(a, b);
  const g = Math.atan2(p.x, p.y) / RAD;
  return g < 0 ? g + 360 : g;
}

/** Avstånd i meter (lokal approximation, gäller några km). */
export function avstand(a: LatLon, b: LatLon): number {
  const p = tillMeter(a, b);
  return Math.hypot(p.x, p.y);
}

/**
 * Vrider en lokal punkt så att dess y-axel (framåt) pekar i `kurs`.
 * Används för att bygga en form "framåt = nedströms" och sedan lägga den
 * i rätt kartriktning. x i indata = höger om färdriktningen.
 */
export function vrid(p: Meter, kurs: number): Meter {
  const r = kurs * RAD;
  const s = Math.sin(r);
  const c = Math.cos(r);
  // Framåt (0,1) → (sin, cos); höger (1,0) → (cos, -sin).
  return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c };
}

/** Kartans synliga område. */
export interface Omrade {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Punkter i ett jämnt rutnät över det synliga området, för vindpilar.
 * Antalet är ungefär konstant oavsett zoom, så pilarna anpassas efter
 * zoomnivån av sig själva: inzoomat tätt i meter, utzoomat glest.
 */
export function rutnat(omrade: Omrade, kolumner: number, rader: number): LatLon[] {
  const ut: LatLon[] = [];
  const nordkant = omrade.latitude + omrade.latitudeDelta / 2;
  const vasterkant = omrade.longitude - omrade.longitudeDelta / 2;
  for (let r = 0; r < rader; r++) {
    for (let k = 0; k < kolumner; k++) {
      ut.push({
        latitude: nordkant - ((r + 0.5) / rader) * omrade.latitudeDelta,
        longitude: vasterkant + ((k + 0.5) / kolumner) * omrade.longitudeDelta,
      });
    }
  }
  return ut;
}

/** Ungefärlig bredd på området i meter (vid mittlatituden). */
export function omradetsBredd(omrade: Omrade): number {
  return omrade.longitudeDelta * meterPerGrad(omrade.latitude).lon;
}

/** Ett område som rymmer alla punkter, med marginal (andel). */
export function omradeFor(punkter: LatLon[], marginal = 0.15): Omrade | null {
  if (punkter.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of punkter) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * (1 + 2 * marginal), 0.005),
    longitudeDelta: Math.max((maxLon - minLon) * (1 + 2 * marginal), 0.005),
  };
}
