import { modul } from "../modules/skade-live-activity";
import type { Drev } from "./db/types";

/**
 * Drevklockan på låsskärmen (iOS Live Activity), steg 2 i förstudien
 * claude/live-activity-jaktmark-forstudie.md.
 *
 * Grundregler:
 * - Databasen är facit. Live Activity är bara en spegling av det drev som
 *   pågår enligt SQLite - se synkaLasskarm().
 * - Får ALDRIG hindra eller fördröja att ett drev sparas: alla fel sväljs
 *   (loggas bara), och anropen görs efter att databasskrivningen lyckats.
 * - No-op överallt där modulen saknas (webben, Android, Expo Go).
 */

interface DrevPaLasskarm {
  drevId: string;
  jaktmark: string;
  hundNamn: string;
  startTimestamp: number;
}

export async function visaDrevPaLasskarm(drev: DrevPaLasskarm): Promise<void> {
  if (!modul) {
    return;
  }
  try {
    await modul.startDrev(
      drev.drevId,
      drev.jaktmark,
      drev.hundNamn,
      drev.startTimestamp,
    );
  } catch (e) {
    console.warn("[liveActivity] kunde inte starta", e);
  }
}

export async function doljDrevPaLasskarm(): Promise<void> {
  if (!modul) {
    return;
  }
  try {
    await modul.endAll();
  } catch (e) {
    console.warn("[liveActivity] kunde inte avsluta", e);
  }
}

/**
 * Tvingar låsskärmen att matcha databasen: pågår ett drev ska exakt det
 * drevet visas, annars ska ingen aktivitet finnas. Anropas när timern
 * eller startsidan får fokus - fångar t.ex. att appen dödats mitt i ett
 * drev, eller att en gammal aktivitet ligger kvar.
 */
export async function synkaLasskarm(
  pagaendeDrev: Drev | null,
  info?: { jaktmark: string; hundNamn: string },
): Promise<void> {
  if (!modul) {
    return;
  }
  try {
    if (!pagaendeDrev) {
      if (modul.currentDrevId() !== null) {
        await modul.endAll();
      }
      return;
    }
    if (info && modul.currentDrevId() !== pagaendeDrev.id) {
      await modul.startDrev(
        pagaendeDrev.id,
        info.jaktmark,
        info.hundNamn,
        pagaendeDrev.startTimestamp,
      );
    }
  } catch (e) {
    console.warn("[liveActivity] kunde inte synka", e);
  }
}
