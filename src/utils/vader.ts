import { Platform } from "react-native";
import * as Location from "expo-location";
import type { SQLiteDatabase } from "expo-sqlite";
import { hamtaJaktmark, settJaktmarkPosition } from "@/db/queries/jaktmark";
import { hamtaDrevUtanVader, sparaVader } from "@/db/queries/vader";
import type { Fore, Uuid, Vader } from "@/db/types";

/**
 * Väder per drev (migration 0007), från SMHI:s öppna prognos-API
 * snow1g v1 (pmp3g stängdes våren 2026). Gratis, ingen nyckel,
 * licens CC BY 4.0: SMHI ska anges som källa där vädret visas
 * ("Källa: SMHI", se VADER_KALLA).
 *
 * Inget här får blockera timern: allt anropas fire-and-forget och alla
 * fel sväljs. Saknas nät försöker vadretsKo() igen vid nästa fokus på
 * timern, för drev från de senaste 3 timmarna.
 */

export const VADER_KALLA = "Källa: SMHI";

const SMHI_URL =
  "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point";
const PARAMETRAR = [
  "air_temperature",
  "wind_speed",
  "wind_speed_of_gust",
  "wind_from_direction",
  "precipitation_amount_mean",
].join(",");
/** SMHI:s markör för saknat värde. */
const SAKNAS = 9999;
/** Hur långt efter drevstart vi fortfarande försöker hämta väder. */
const OMFORSOK_SEKUNDER = 3 * 3600;

export const FORE_VAL: { varde: Fore; titel: string }[] = [
  { varde: "barmark", titel: "Barmark" },
  { varde: "frost", titel: "Frost" },
  { varde: "blott", titel: "Blött" },
  { varde: "sparsno", titel: "Spårsnö" },
  { varde: "djupsno", titel: "Djup snö" },
  { varde: "skare", titel: "Skare" },
];

export function foreNamn(fore: Fore | null | undefined): string | null {
  return FORE_VAL.find((f) => f.varde === fore)?.titel ?? null;
}

const avrunda = (v: number) => Math.round(v * 100) / 100;

interface SmhiSvar {
  timeSeries?: {
    time: string;
    data: Record<string, number | null | undefined>;
  }[];
}

type Matning = Pick<
  Vader,
  | "tidpunkt"
  | "temperatur"
  | "vindHastighet"
  | "vindByar"
  | "vindRiktning"
  | "nederbord"
>;

/** Hämtar prognosen och väljer tidssteget närmast `tidpunkt`. */
export async function hamtaSmhiVader(
  lat: number,
  lon: number,
  tidpunkt: number,
): Promise<Matning | null> {
  const url = `${SMHI_URL}/lon/${avrunda(lon)}/lat/${avrunda(lat)}/data.json?timeseries=6&parameters=${PARAMETRAR}`;
  const svar = await fetch(url);
  if (!svar.ok) {
    return null;
  }
  const json = (await svar.json()) as SmhiSvar;
  const serie = json.timeSeries ?? [];
  if (serie.length === 0) {
    return null;
  }
  let basta = serie[0];
  for (const steg of serie) {
    const t = Date.parse(steg.time) / 1000;
    if (
      Math.abs(t - tidpunkt) <
      Math.abs(Date.parse(basta.time) / 1000 - tidpunkt)
    ) {
      basta = steg;
    }
  }
  const tal = (namn: string): number | null => {
    const v = basta.data[namn];
    return typeof v === "number" && v !== SAKNAS && Number.isFinite(v)
      ? v
      : null;
  };
  const riktning = tal("wind_from_direction");
  return {
    tidpunkt: Math.floor(Date.parse(basta.time) / 1000),
    temperatur: tal("air_temperature"),
    vindHastighet: tal("wind_speed"),
    vindByar: tal("wind_speed_of_gust"),
    vindRiktning: riktning === null ? null : Math.round(riktning),
    nederbord: tal("precipitation_amount_mean"),
  };
}

/**
 * Frågar om platsbehörighet (bara "när appen används") - anropas när en
 * jaktdag startas, så att frågan aldrig dyker upp mitt i ett drev.
 * Returnerar true om behörighet finns.
 */
export async function fragaOmPlats(): Promise<boolean> {
  try {
    const nu = await Location.getForegroundPermissionsAsync();
    if (nu.granted) {
      return true;
    }
    if (!nu.canAskAgain) {
      return false;
    }
    const svar = await Location.requestForegroundPermissionsAsync();
    return svar.granted;
  } catch {
    return false;
  }
}

/** Telefonens ungefärliga position, utan att fråga om behörighet. */
export async function hamtaPosition(): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    const beh = await Location.getForegroundPermissionsAsync();
    if (!beh.granted) {
      return null;
    }
    if (Platform.OS !== "web") {
      const senast = await Location.getLastKnownPositionAsync({
        maxAge: 30 * 60 * 1000,
      });
      if (senast) {
        return { lat: senast.coords.latitude, lon: senast.coords.longitude };
      }
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Jaktmarkens position, eller telefonens om marken saknar en (och då
 * sparas den på marken, så att nästa jaktdag inte behöver GPS).
 */
export async function positionForJaktmark(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
): Promise<{ lat: number; lon: number } | null> {
  const mark = await hamtaJaktmark(db, jaktmarkId);
  if (mark?.lat != null && mark?.lon != null) {
    return { lat: mark.lat, lon: mark.lon };
  }
  const pos = await hamtaPosition();
  if (pos) {
    await settJaktmarkPosition(db, jaktmarkId, pos);
  }
  return pos;
}

let pagar = false;

/**
 * Hämtar väder för de drev på jaktdagen som saknar det (senaste 3 h).
 * Anropas efter drevstart och vid varje fokus på timern. Sväljer alla fel.
 */
export async function vadretsKo(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  jaktmarkId: Uuid,
): Promise<void> {
  if (pagar) {
    return;
  }
  pagar = true;
  try {
    const nu = Math.floor(Date.now() / 1000);
    const drev = await hamtaDrevUtanVader(
      db,
      jaktdagId,
      nu - OMFORSOK_SEKUNDER,
    );
    if (drev.length === 0) {
      return;
    }
    const pos = await positionForJaktmark(db, jaktmarkId);
    if (!pos) {
      return;
    }
    for (const d of drev) {
      const m = await hamtaSmhiVader(pos.lat, pos.lon, d.startTimestamp);
      if (!m) {
        return;
      }
      await sparaVader(db, {
        ...m,
        jaktdagId,
        drevId: d.id,
        kalla: "smhi",
        lat: avrunda(pos.lat),
        lon: avrunda(pos.lon),
      });
    }
  } catch {
    // Inget nät eller SMHI svarar inte - försöker igen vid nästa fokus.
  } finally {
    pagar = false;
  }
}

const VINDRIKTNINGAR = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];

/** "−3° · SV 4 m/s" - kort väderrad för timern, drevvyn och delningsbilden. */
export function vaderText(
  v: Pick<Vader, "temperatur" | "vindHastighet" | "vindRiktning"> | null,
): string | null {
  if (!v) {
    return null;
  }
  const delar: string[] = [];
  if (v.temperatur !== null) {
    delar.push(`${Math.round(v.temperatur).toString().replace("-", "−")}°`);
  }
  if (v.vindHastighet !== null) {
    const riktning =
      v.vindRiktning !== null
        ? `${VINDRIKTNINGAR[Math.round(v.vindRiktning / 45) % 8]} `
        : "";
    delar.push(`${riktning}${Math.round(v.vindHastighet)} m/s`);
  }
  return delar.length ? delar.join(" · ") : null;
}

/** Temperaturintervall för statistiken. */
export function temperaturIntervall(t: number | null): string {
  if (t === null) {
    return "Okänd";
  }
  if (t < -10) return "Under −10°";
  if (t < 0) return "−10 till 0°";
  if (t < 10) return "0 till 10°";
  return "Över 10°";
}
