import type {
  Drev,
  DrevHandelse,
  FasTyp,
  HandelseTyp,
  UnixTimestamp,
} from "../db/types";

/**
 * Rena beräkningar på drevhändelser (migration 0006). Ingen databas här -
 * samma funktioner används av timern, drevvyn, statistiken och exporten.
 */

export const HANDELSE_NAMN: Record<HandelseTyp, string> = {
  slapp: "Släppt",
  tappt: "Tappt",
  atertag: "Tog upp igen",
  kopplad: "Kopplad",
  upptag: "Upptag",
  drev: "Drev",
  atergang: "Återgång",
};

/** Drevets faser i den ordning de visas (migration 0011). */
export const FASER: FasTyp[] = ["upptag", "drev", "atergang"];

export function arFas(typ: HandelseTyp): typ is FasTyp {
  return typ === "upptag" || typ === "drev" || typ === "atergang";
}

/**
 * Fasen drevet är i just nu: den senaste fashändelsen, eller "drev" från
 * drevets start om inga fashändelser finns (drev startat från
 * låsskärmen eller före migration 0011).
 */
export function aktuellFas(
  drevHandelser: DrevHandelse[],
  start: UnixTimestamp,
): { typ: FasTyp; sedan: UnixTimestamp } {
  let fas: { typ: FasTyp; sedan: UnixTimestamp } = { typ: "drev", sedan: start };
  for (const h of sorteraHandelser(drevHandelser)) {
    if (arFas(h.typ)) {
      fas = { typ: h.typ, sedan: h.tidpunkt };
    }
  }
  return fas;
}

/**
 * Sekunder per fas under ett drev. Varje fas varar till nästa fas eller
 * till drevets slut (`nu` om drevet pågår). Tiden före första
 * fashändelsen räknas som drev. Händelser utanför drevets tid (till
 * exempel efter att start eller slut ändrats i drevvyn) kläms in i den.
 */
export function fasTider(
  drevHandelser: DrevHandelse[],
  start: UnixTimestamp,
  slut: UnixTimestamp | null,
  nu: UnixTimestamp = Math.floor(Date.now() / 1000),
): Record<FasTyp, number> {
  const tider: Record<FasTyp, number> = { upptag: 0, drev: 0, atergang: 0 };
  const grans = Math.max(start, slut ?? nu);
  const klam = (t: UnixTimestamp) => Math.min(Math.max(t, start), grans);
  let fas: FasTyp = "drev";
  let fran = start;
  for (const h of sorteraHandelser(drevHandelser)) {
    if (!arFas(h.typ)) {
      continue;
    }
    const t = klam(h.tidpunkt);
    tider[fas] += Math.max(0, t - fran);
    fas = h.typ;
    fran = t;
  }
  tider[fas] += Math.max(0, grans - fran);
  return tider;
}

/** Antal gånger en fas påbörjats (till exempel antal drev i ett pass). */
export function antalFaser(drevHandelser: DrevHandelse[], typ: FasTyp): number {
  return drevHandelser.filter((h) => h.typ === typ).length;
}

/** Sorterar händelser i tidsordning (äldst först), stabilt på createdAt. */
export function sorteraHandelser(handelser: DrevHandelse[]): DrevHandelse[] {
  return [...handelser].sort(
    (a, b) => a.tidpunkt - b.tidpunkt || a.createdAt - b.createdAt,
  );
}

/**
 * Pågående tappt i ett drev: den senaste tappten om den inte följs av ett
 * återupptag eller en ny fas (upptag, drev, återgång - 2026-11-18).
 * Returnerar tapptens tidpunkt eller null.
 */
export function oppenTappt(
  drevHandelser: DrevHandelse[],
): UnixTimestamp | null {
  let oppen: UnixTimestamp | null = null;
  for (const h of sorteraHandelser(drevHandelser)) {
    if (h.typ === "tappt") {
      oppen = oppen ?? h.tidpunkt;
    } else if (h.typ === "atertag" || arFas(h.typ)) {
      oppen = null;
    }
  }
  return oppen;
}

/**
 * Sekunder i tappt under ett drev. En tappt slutar vid återupptag eller
 * vid nästa fas. En tappt som aldrig avslutas räknas fram till drevets
 * slut (eller `nu` om drevet pågår).
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
    } else if ((h.typ === "atertag" || arFas(h.typ)) && oppen !== null) {
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
