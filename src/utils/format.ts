/**
 * Visningsformat enligt designen (svenska, versal bara först i meningen).
 * Drevtid på timern formateras av formateraTid() i hooks/useElapsedTime.
 */

/** "2 h 14 min", "14 min", "under 1 min". */
export function formateraVaraktighet(sekunder: number): string {
  if (sekunder < 60) {
    return sekunder > 0 ? "under 1 min" : "0 min";
  }
  const h = Math.floor(sekunder / 3600);
  const min = Math.floor((sekunder % 3600) / 60);
  if (h === 0) {
    return `${min} min`;
  }
  return `${h} h ${String(min).padStart(2, "0")} min`;
}

/** "4 oktober" (år bara om det inte är innevarande år). */
export function formateraDag(unixSekunder: number): string {
  const d = new Date(unixSekunder * 1000);
  const iAr = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    ...(iAr ? {} : { year: "numeric" }),
  });
}

/** "1 drev", "5 drev" - samma i singular och plural, men tydligt. */
export function antalDrevText(n: number): string {
  return `${n} drev`;
}

/** "Saga", "Saga och Tor", "Saga, Tor och Bruno". */
export function listaNamn(namn: string[]): string {
  if (namn.length <= 1) {
    return namn[0] ?? "";
  }
  return `${namn.slice(0, -1).join(", ")} och ${namn[namn.length - 1]}`;
}
