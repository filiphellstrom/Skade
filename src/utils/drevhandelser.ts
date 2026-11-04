import type {
  Drev,
  DrevHandelse,
  HandelseTyp,
  UnixTimestamp,
} from "@/db/types";

/**
 * Rena beräkningar på drevhändelser (migration 0006). Ingen databas här -
 * samma funktioner används av timern, drevvyn, statistiken och exporten.
 */

export const HANDELSE_NAMN: Record<HandelseTyp, string> = {
  slapp: "Släppt",
  tappt: "Tappt",
  atertag: "Tog upp igen",
  kopplad: "Kopplad",
};

/** Sorterar händelser i tidsordning (äldst först), stabilt på createdAt. */
export function sorteraHandelser(handelser: DrevHandelse[]): DrevHandelse[] {
  return [...handelser].sort(
    (a, b) => a.tidpunkt - b.tidpunkt || a.createdAt - b.createdAt,
  );
}

/**
 * Pågående tappt i ett drev: den senaste tappten om den inte följs av ett
 * återupptag. Returnerar tapptens tidpunkt eller null.
 */
export function oppenTappt(
  drevHandelser: DrevHandelse[],
): UnixTimestamp | null {
  let oppen: UnixTimestamp | null = null;
  for (const h of sorteraHandelser(drevHandelser)) {
    if (h.typ === "tappt") {
      oppen = oppen ?? h.tidpunkt;
    } else if (h.typ === "atertag") {
      oppen = null;
    }
  }
  return oppen;
}

/**
 * Sekunder i tappt under ett drev. En tappt som aldrig följs av ett
 * återupptag räknas fram till drevets slut (eller `nu` om drevet pågår).
 */
export function tapptTid(
  drevHandelser: DrevHandelse[],
  slut: UnixTimestamp | null,
  nu: UnixTimestamp = Math.floor(Date.now() / 1000),
): number {
  let summa = 0;
  let oppen: UnixTimestamp | null = null;
  const grans = slut ?? nu;
  for (const h of sorteraHandelser(drevHandelser)) {
    if (h.typ === "tappt" && oppen === null) {
      oppen = h.tidpunkt;
    } else if (h.typ === "atertag" && oppen !== null) {
      summa += Math.max(0, Math.min(h.tidpunkt, grans) - oppen);
      oppen = null;
    }
  }
  if (oppen !== null) {
    summa += Math.max(0, grans - oppen);
  }
  return summa;
}

export function antalTappt(drevHandelser: DrevHandelse[]): number {
  return drevHandelser.filter((h) => h.typ === "tappt").length;
}

export function antalAtertag(drevHandelser: DrevHandelse[]): number {
  return drevHandelser.filter((h) => h.typ === "atertag").length;
}

/**
 * Söktid före ett drev: upptag (drevets start) minus senaste släpp för
 * samma hund samma jaktdag, om släppet kom efter föregående drev och
 * efter senaste koppling. Annars null (ingen söktid registrerad).
 *
 * `dagensHandelser` = alla händelser för jaktdagen, `dagensDrev` = alla
 * drev för jaktdagen (för att hitta föregående drev).
 */
export function soktid(
  drev: Pick<Drev, "id" | "hundId" | "startTimestamp">,
  dagensHandelser: DrevHandelse[],
  dagensDrev: Pick<Drev, "id" | "hundId" | "startTimestamp" | "endTimestamp">[],
): number | null {
  const foregaendeSlut = dagensDrev
    .filter(
      (d) =>
        d.hundId === drev.hundId &&
        d.id !== drev.id &&
        d.startTimestamp < drev.startTimestamp,
    )
    .reduce((max, d) => Math.max(max, d.endTimestamp ?? d.startTimestamp), 0);

  let senasteSlapp: UnixTimestamp | null = null;
  for (const h of sorteraHandelser(dagensHandelser)) {
    if (
      h.hundId !== drev.hundId ||
      h.tidpunkt > drev.startTimestamp ||
      h.tidpunkt < foregaendeSlut
    ) {
      continue;
    }
    if (h.typ === "slapp") {
      senasteSlapp = h.tidpunkt;
    } else if (h.typ === "kopplad") {
      senasteSlapp = null;
    }
  }
  return senasteSlapp === null
    ? null
    : Math.max(0, drev.startTimestamp - senasteSlapp);
}

/**
 * "Söker"-läget på timern: hunden är släppt och har inte tagit upp eller
 * kopplats sedan dess. Returnerar släppets tidpunkt eller null.
 * `senasteDrevSlut` = slutet på hundens senaste drev samma dag (eller null).
 */
export function sokerSedan(
  hundId: string,
  dagensHandelser: DrevHandelse[],
  senasteDrevSlut: UnixTimestamp | null,
): UnixTimestamp | null {
  let slapp: UnixTimestamp | null = null;
  for (const h of sorteraHandelser(dagensHandelser)) {
    if (h.hundId !== hundId || h.drevId !== null) {
      continue;
    }
    if (senasteDrevSlut !== null && h.tidpunkt < senasteDrevSlut) {
      continue;
    }
    if (h.typ === "slapp") {
      slapp = h.tidpunkt;
    } else if (h.typ === "kopplad") {
      slapp = null;
    }
  }
  return slapp;
}
