import type { UnixTimestamp } from "@/db/types";

/**
 * Sprint 3: periodfiltret för historik/statistik
 * (src/components/PeriodFilter.tsx, app/historik/index.tsx,
 * app/historik/statistik.tsx). "allt" = inget filter, "ar" = ett helt
 * kalenderår, "intervall" = valfritt start-/slutdatum.
 */
export type HistorikPeriod =
  | { typ: "allt" }
  | { typ: "ar"; ar: number }
  | { typ: "intervall"; start: UnixTimestamp; slut: UnixTimestamp };

const EN_DAG = 24 * 60 * 60;

/**
 * Räknar om ett HistorikPeriod-värde till ett [från, till)-intervall i
 * unix-sekunder att skicka som SQL-filter - null betyder "inget filter"
 * (typ "allt"). `till` är EXKLUSIVT: "helår 2026" ger
 * [1 jan 2026 00:00, 1 jan 2027 00:00), och ett valt slutdatum i ett
 * intervall räknas med hela den dagen (+1 dag på slutdatumet). Start/slut
 * sorteras (min/max) så det inte spelar någon roll om användaren råkar
 * välja ett slutdatum före startdatumet - filtret blir aldrig tomt av
 * misstag för det.
 */
export function periodTillIntervall(
  period: HistorikPeriod,
): { fran: UnixTimestamp; till: UnixTimestamp } | null {
  if (period.typ === "allt") {
    return null;
  }

  if (period.typ === "ar") {
    const franDatum = new Date(period.ar, 0, 1);
    franDatum.setHours(0, 0, 0, 0);
    const tillDatum = new Date(period.ar + 1, 0, 1);
    tillDatum.setHours(0, 0, 0, 0);
    return {
      fran: Math.floor(franDatum.getTime() / 1000),
      till: Math.floor(tillDatum.getTime() / 1000),
    };
  }

  const fran = Math.min(period.start, period.slut);
  const slut = Math.max(period.start, period.slut);
  return { fran, till: slut + EN_DAG };
}
