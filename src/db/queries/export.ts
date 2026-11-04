import type { SQLiteDatabase } from "expo-sqlite";
import type { Fore, UnixTimestamp, Uuid } from "../types";

/** En rad i CSV-exporten - ett stoppat drev plus jaktdagens datum/jaktmark. */
export interface ExportDrevRad {
  id: Uuid;
  jaktdagId: Uuid;
  hundId: Uuid;
  fore: Fore | null;
  temperatur: number | null;
  vindHastighet: number | null;
  vindRiktning: number | null;
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
       d.id AS id,
       d.jaktdagId AS jaktdagId,
       d.hundId AS hundId,
       j.fore AS fore,
       v.temperatur AS temperatur,
       v.vindHastighet AS vindHastighet,
       v.vindRiktning AS vindRiktning,
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
     LEFT JOIN Vader v ON v.id = (SELECT v2.id FROM Vader v2 WHERE v2.drevId = d.id ORDER BY v2.createdAt DESC LIMIT 1)
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL
     ORDER BY j.datum ASC, d.startTimestamp ASC`,
    [profilId],
  );
}
