import type { Eftersok } from "./typer";
import { RESULTAT_NAMN } from "./typer";

const tva = (n: number) => String(n).padStart(2, "0");
const DAGAR = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"];
const MANADER = ["jan", "feb", "mars", "apr", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];

/** 1794762812950 → "18:13" */
export function klockslag(ms: number): string {
  const d = new Date(ms);
  return `${tva(d.getHours())}:${tva(d.getMinutes())}`;
}

/** Idag: "18:13". Annars: "14 nov 18:13". */
export function dagOchTid(ms: number, nu = Date.now()): string {
  const d = new Date(ms);
  const idag = new Date(nu);
  const sammaDag =
    d.getFullYear() === idag.getFullYear() && d.getMonth() === idag.getMonth() && d.getDate() === idag.getDate();
  return sammaDag ? klockslag(ms) : `${d.getDate()} ${MANADER[d.getMonth()]} ${klockslag(ms)}`;
}

/** "2026-11-21" → "lör 21 nov" */
export function planDatum(datum: string): string {
  const [ar, manad, dag] = datum.split("-").map(Number);
  const d = new Date(ar, manad - 1, dag);
  if (Number.isNaN(d.getTime())) return datum;
  return `${DAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]}`;
}

/** Dagens datum som ÅÅÅÅ-MM-DD (lokal tid). */
export function idagDatum(nu = new Date()): string {
  return `${nu.getFullYear()}-${tva(nu.getMonth() + 1)}-${tva(nu.getDate())}`;
}

export function giltigtDatum(datum: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false;
  const [ar, manad, dag] = datum.split("-").map(Number);
  const d = new Date(ar, manad - 1, dag);
  return d.getFullYear() === ar && d.getMonth() === manad - 1 && d.getDate() === dag;
}

/** "HH:MM" eller tomt. */
export function giltigTid(tid: string): boolean {
  return tid === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(tid);
}

/** Kort rad om var ett eftersök står: "Öppet", "Taget av Anna med Molly", "Hittat". */
export function eftersokLage(e: Eftersok): string {
  if (e.vantar) return "Väntar på täckning – inte skickat än";
  if (e.status === "oppet") return "Öppet – ingen har tagit det";
  if (e.status === "taget") {
    return `Taget av ${e.tagetNamn ?? "borttagen användare"}${e.tagetHund ? ` med ${e.tagetHund}` : ""}`;
  }
  return e.resultat ? RESULTAT_NAMN[e.resultat] : "Avslutat";
}

/** "ABCD2345" → "ABCD-2345", lättare att läsa upp. */
export function visaKod(kod: string): string {
  return kod.length === 8 ? `${kod.slice(0, 4)}-${kod.slice(4)}` : kod;
}
