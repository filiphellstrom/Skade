import type { Kartdata } from "@/db/queries/kartpunkt";
import type { PlanJaktmark } from "./typer";

/**
 * Kopierar en jaktmarks gräns och markeringar (importerade från GPX i den
 * här telefonen eller webbläsaren) till det format som sparas i en plan,
 * så att alla i jaktlaget ser samma pass och gräns.
 */
export function tillPlanJaktmark(k: Kartdata): PlanJaktmark {
  const avrunda = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    namn: k.jaktmark.namn,
    grans: k.grans.map((p): [number, number] => [avrunda(p.latitude), avrunda(p.longitude)]),
    punkter: k.punkter.map((p) => ({ namn: p.namn, typ: p.typ, lat: avrunda(p.lat), lon: avrunda(p.lon) })),
  };
}
