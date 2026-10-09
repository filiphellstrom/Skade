import type { SQLiteDatabase } from "expo-sqlite";
import type { UnixTimestamp, Uuid } from "../types";

/** En rad i CSV-exporten - ett stoppat drev plus jaktdagens datum/jaktmark. */
export interface ExportDrevRad {
  datum: UnixTimestamp;
  jaktmark: string;
  hundNamn: string;
  startTimestamp: UnixTimestamp;
  endTimestamp: UnixTimestamp;
  duration: number;
  species: string | null;
  outcome: string | null;
}

/**
 * Alla stoppade drev för en profil (2026-09-08, CSV-export av "all
 * historik" - Filip: "All historik (alla drev)"), med hundens namn och
 * jaktdagens datum/jaktmark inbakat via JOIN. Samma urval som
 * hamtaStatistikPerHund() i statistik.ts: ETT pågående drev räknas inte
 * med (endTimestamp IS NOT NULL), och ARKIVERADE hundars historik är med
 * med vilje - arkivering döljer bara hunden från de vanliga listorna, inte
 * historiken. Sorterad kronologiskt (äldst först) - naturligast att läsa
 * i ett kalkylark.
 */
export async function hamtaAllaDrevForExport(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<ExportDrevRad[]> {
  return db.getAllAsync<ExportDrevRad>(
    `SELECT
       j.datum AS datum,
       m.namn AS jaktmark,
       h.namn AS hundNamn,
       d.startTimestamp AS startTimestamp,
       d.endTimestamp AS endTimestamp,
       d.duration AS duration,
       d.species AS species,
       d.outcome AS outcome
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     JOIN Jaktdag j ON j.id = d.jaktdagId
     JOIN Jaktmark m ON m.id = j.jaktmarkId
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL
     ORDER BY j.datum ASC, d.startTimestamp ASC`,
    [profilId],
  );
}
