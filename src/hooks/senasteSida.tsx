import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, useGlobalSearchParams, usePathname, useRootNavigationState } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { lasSakert, sparaSakert } from "@/utils/lagring";

/**
 * Appen kommer ihåg sidan man senast var på (Filip 2026-10-10: "Jag vill
 * att den alltid hoppar tillbaka till den sida som jag sist var på när
 * jag byter app").
 *
 * Så länge iOS låter appen ligga kvar i minnet behövs inget - navigationen
 * står kvar där den var. Men iOS stänger ofta appar i bakgrunden för att
 * frigöra minne, och då startade Skade om på Hem. Därför sparas varje
 * sidbyte, och vid en kall start öppnas den sparade sidan igen ovanpå Hem
 * (så att Tillbaka leder till Hem).
 *
 * Sidan återställs bara om den är högst 12 timmar gammal och om det den
 * pekar på (jaktdag, drev, hund, jaktmark) fortfarande finns - annars
 * startar appen på Hem som vanligt.
 */
const NYCKEL = "skade.senasteSida";
const MAX_ALDER_S = 12 * 60 * 60;
let aterstalldIProcessen = false;

interface Sparad {
  sokvag: string;
  tid: number;
}

/** Läses i rot-layouten innan appen visas. null = starta på Hem. */
export async function laddaSenasteSida(db: SQLiteDatabase): Promise<string | null> {
  try {
    const text = await lasSakert(NYCKEL);
    if (!text) {
      return null;
    }
    const sparad = JSON.parse(text) as Sparad;
    const nu = Math.floor(Date.now() / 1000);
    if (!sparad.sokvag || sparad.sokvag === "/" || nu - sparad.tid > MAX_ALDER_S) {
      return null;
    }
    return (await finnsFortfarande(db, sparad.sokvag)) ? sparad.sokvag : null;
  } catch {
    return null;
  }
}

async function finns(db: SQLiteDatabase, sql: string, id: string): Promise<boolean> {
  return (await db.getFirstAsync(sql, [id])) !== null;
}

/** Kontrollerar att sidans objekt finns kvar, så att ingen sida laddar i evighet. */
async function finnsFortfarande(db: SQLiteDatabase, sokvag: string): Promise<boolean> {
  const delar = sokvag.split("?")[0].split("/").filter(Boolean);
  const [forsta, id, tredje, fjarde] = delar;
  switch (forsta) {
    case "jaktdag":
      if (id === "ny") {
        return true;
      }
      if (tredje === "drev" && fjarde) {
        return finns(db, "SELECT 1 FROM Drev WHERE id = ? AND endTimestamp IS NOT NULL", fjarde);
      }
      // Timer, välj hund och ny hund hör till en pågående jaktdag.
      return finns(db, "SELECT 1 FROM Jaktdag WHERE id = ? AND status = 'pagar'", id);
    case "historik":
      return !id || finns(db, "SELECT 1 FROM Jaktdag WHERE id = ?", id);
    case "hundar":
      return (
        !id ||
        id === "ny" ||
        id === "arkiverade" ||
        finns(db, "SELECT 1 FROM Hund WHERE id = ?", id)
      );
    case "jaktmarker":
      return !id || id === "ny" || finns(db, "SELECT 1 FROM Jaktmark WHERE id = ?", id);
    case "installningar":
    case "hjalp":
      return true;
    default:
      return false;
  }
}

/**
 * Sparar varje sidbyte och öppnar den sparade sidan en gång vid start.
 * Renderas inuti appens Stack-layout (app/_layout.tsx).
 */
export function SidMinne({ startsida }: { startsida: string | null }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const navigation = useRootNavigationState();
  // Modulnivå, inte per montering: på webben kan rot-layouten monteras om
  // (t.ex. vid webbläsarens bakåt till "/") och då får sidan inte öppnas igen.
  const aterstalld = useRef(startsida === null || aterstalldIProcessen);

  // Öppna den sparade sidan när navigationen är redo - bara om appen
  // startade på Hem (på webben kan adressen redan peka på en annan sida).
  useEffect(() => {
    if (aterstalld.current || !navigation?.key) {
      return;
    }
    aterstalld.current = true;
    aterstalldIProcessen = true;
    if (pathname === "/" && startsida) {
      // Ett nyss stoppat drev öppnades från timern: lägg timern under, så
      // att Spara/Hoppa över leder tillbaka dit som vanligt.
      const nystoppat = startsida.match(/^\/jaktdag\/([^/]+)\/drev\/[^?]+\?(.*&)?nystoppat=1/);
      if (nystoppat) {
        router.push(`/jaktdag/${nystoppat[1]}/timer` as never);
      }
      router.push(startsida as never);
    }
  }, [navigation?.key, pathname, startsida]);

  // Spara sökvägen inklusive frågeparametrar (t.ex. ?nystoppat=1), men
  // inte de dynamiska delarna som redan står i sökvägen.
  const segment = new Set(pathname.split("/"));
  const fraga = Object.entries(params)
    .filter(([, v]) => typeof v === "string" && !segment.has(v))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
  const sokvag = fraga ? `${pathname}?${fraga}` : pathname;

  useEffect(() => {
    const spara = () => {
      if (aterstalld.current) {
        const sparad: Sparad = { sokvag, tid: Math.floor(Date.now() / 1000) };
        sparaSakert(NYCKEL, JSON.stringify(sparad));
      }
    };
    spara();
    // Spara igen när appen lämnas, så att 12-timmarsgränsen räknas från
    // när man senast använde appen och inte från senaste sidbytet.
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        spara();
      }
    });
    return () => sub.remove();
  }, [sokvag]);

  return null;
}
