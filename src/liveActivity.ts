import { modul } from "../modules/skade-live-activity";
import type { LasskarmLage } from "../modules/skade-live-activity";
import { getDatabase } from "./db/client";
import { hamtaPagaendeJaktdag } from "./db/queries/jaktdag";
import { hamtaPagaendeDrev } from "./db/queries/drev";
import { hamtaHund } from "./db/queries/hund";
import type { Uuid } from "./db/types";

/**
 * Låsskärmskortet (iOS Live Activity), sprint 7.
 *
 * EN aktivitet per pågående jaktdag: visas så fort jaktdagen har en aktiv
 * hund, ligger kvar hela dagen med Starta/Stoppa drev-knapp, och tas bort
 * när jaktdagen avslutas.
 *
 * Grundregler (förstudien, claude/live-activity-jaktmark-forstudie.md):
 * - Databasen är facit. synkaLasskarm() läser alltid läget från SQLite och
 *   tvingar kortet att matcha - aldrig från en skärms lokala tillstånd.
 * - Får aldrig hindra eller fördröja att något sparas: alla fel sväljs
 *   (loggas bara), och anropen görs efter att databasskrivningen lyckats.
 * - 8-timmarsgränsen: iOS gör en aktivitet inaktuell efter 8 timmar. Varje
 *   synk när appen är aktiv startar en ny om den gamla inte längre är
 *   aktiv (se SkadeActivities.synka i Swift).
 * - No-op där modulen saknas (webben, Android, Expo Go, iOS < 17).
 *
 * Anropas: när Hem eller timern får fokus, när appen kommer till
 * förgrunden, efter Starta/Stoppa drev och hundbyte i appen, och efter att
 * jaktdagen avslutats.
 */
export async function synkaLasskarm(profilId: Uuid): Promise<void> {
  if (!modul) {
    return;
  }
  try {
    const db = await getDatabase();
    const jaktdag = await hamtaPagaendeJaktdag(db, profilId);
    if (!jaktdag || !jaktdag.aktivHundId) {
      // Ingen pågående jaktdag, eller hund inte vald än: inget kort.
      await modul.avslutaAlla();
      return;
    }
    const [drev, antal] = await Promise.all([
      hamtaPagaendeDrev(db, jaktdag.id),
      db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM Drev WHERE jaktdagId = ?", [
        jaktdag.id,
      ]),
    ]);
    // Pågår ett drev visas det drevets hund, annars jaktdagens aktiva hund
    // (den som Starta-knappen startar ett drev för).
    const hund = await hamtaHund(db, drev?.hundId ?? jaktdag.aktivHundId);
    const antalDrev = antal?.n ?? 0;
    const lage: LasskarmLage = {
      jaktdagId: jaktdag.id,
      jaktmark: jaktdag.jaktmark,
      hundNamn: hund?.namn ?? null,
      drevId: drev?.id ?? null,
      drevStart: drev?.startTimestamp ?? null,
      drevNummer: drev ? Math.max(antalDrev, 1) : antalDrev + 1,
    };
    await modul.synka(lage);
  } catch (e) {
    console.warn("[liveActivity] kunde inte synka", e);
  }
}

/** Mätpunkter för test på riktig enhet - se Inställningar. */
export interface LasskarmDiagnostik {
  intents: { typ: string; tid: number; ms: number; pid: number; resultat: string }[];
  jsStarter: { tid: number; pid: number }[];
  pid: number;
}

export function lasDiagnostik(): LasskarmDiagnostik | null {
  if (!modul) {
    return null;
  }
  try {
    return JSON.parse(modul.diagnostik()) as LasskarmDiagnostik;
  } catch {
    return null;
  }
}
