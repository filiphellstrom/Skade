import type { Dokument, DokumentTyp } from "@/db/types";
import { datumText, midnatt } from "@/components/HjulVal";

/** Typerna i den ordning de visas, med svenska namn. */
export const DOKUMENT_TYPER: { typ: DokumentTyp; titel: string }[] = [
  { typ: "jagarexamen", titel: "Jägarexamen" },
  { typ: "vapenlicens", titel: "Vapenlicens" },
  { typ: "forsakring", titel: "Försäkring" },
  { typ: "ovrigt", titel: "Övrigt" },
];

export function typTitel(typ: DokumentTyp): string {
  return DOKUMENT_TYPER.find((t) => t.typ === typ)?.titel ?? "Dokument";
}

export const PAMINNELSE_DAGAR = [7, 30, 60] as const;

export type StatusTyp = "ingen" | "giltig" | "snart" | "utgatt";

/**
 * Dokumentets status (designen 2026-10-29): Giltig (brand), Går ut snart
 * (warn, inom påminnelsetiden), Utgånget (signal). `giltigTill` är sista
 * giltiga dagen, så dokumentet är utgånget först dagen efter.
 */
export function dokumentStatus(
  d: Pick<Dokument, "giltigTill" | "paminnelseDagar">,
  nu: Date = new Date(),
): { typ: StatusTyp; text: string; dagarKvar: number | null } {
  if (d.giltigTill === null) {
    return { typ: "ingen", text: "Inget slutdatum", dagarKvar: null };
  }
  const dagarKvar = Math.round((d.giltigTill - midnatt(nu)) / 86400);
  if (dagarKvar < 0) {
    return { typ: "utgatt", text: `Utgånget ${datumText(d.giltigTill)}`, dagarKvar };
  }
  if (dagarKvar <= d.paminnelseDagar) {
    const text =
      dagarKvar === 0 ? "Går ut i dag" : dagarKvar === 1 ? "Går ut i morgon" : `Går ut om ${dagarKvar} dagar`;
    return { typ: "snart", text, dagarKvar };
  }
  return { typ: "giltig", text: `Giltig till ${datumText(d.giltigTill)}`, dagarKvar };
}
