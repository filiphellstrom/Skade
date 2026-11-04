import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Drev, Uuid, Vader } from "../types";

/** Migration 0007: väder per drev. Hämtning från SMHI: src/utils/vader.ts. */
export async function sparaVader(
  db: SQLiteDatabase,
  v: Omit<Vader, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `INSERT INTO Vader (id, jaktdagId, drevId, tidpunkt, temperatur, vindHastighet, vindByar, vindRiktning,
                        nederbord, kalla, lat, lon, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      v.jaktdagId,
      v.drevId,
      v.tidpunkt,
      v.temperatur,
      v.vindHastighet,
      v.vindByar,
      v.vindRiktning,
      v.nederbord,
      v.kalla,
      v.lat,
      v.lon,
      now,
      now,
    ],
  );
}

export async function hamtaVaderForDrev(
  db: SQLiteDatabase,
  drevId: Uuid,
): Promise<Vader | null> {
  const rad = await db.getFirstAsync<Vader>(
    "SELECT * FROM Vader WHERE drevId = ? ORDER BY createdAt DESC LIMIT 1",
    [drevId],
  );
  return rad ?? null;
}

export async function hamtaVaderForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Vader[]> {
  return db.getAllAsync<Vader>(
    "SELECT * FROM Vader WHERE jaktdagId = ? ORDER BY tidpunkt ASC",
    [jaktdagId],
  );
}

/**
 * Drev på en jaktdag som saknar väder och startade efter `efter` - kön
 * för omförsök när nätet kommer tillbaka (SMHI:s prognos börjar ungefär
 * vid aktuell timme, så bara drev från de senaste timmarna är meningsfulla).
 */
export async function hamtaDrevUtanVader(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  efter: number,
): Promise<Pick<Drev, "id" | "jaktdagId" | "startTimestamp">[]> {
  return db.getAllAsync(
    `SELECT d.id, d.jaktdagId, d.startTimestamp FROM Drev d
     WHERE d.jaktdagId = ? AND d.startTimestamp >= ?
       AND NOT EXISTS (SELECT 1 FROM Vader v WHERE v.drevId = d.id)
     ORDER BY d.startTimestamp ASC`,
    [jaktdagId, efter],
  );
}
