import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Uuid, VindPrognosRad } from "../types";
import type { VindPrognos } from "../../vind/prognos";

/**
 * Migration 0009: sparade vindprognoser. Varje hämtning sparas med
 * tidsstämpel (hämtad, modellkörning, giltighetstid) - som offline-cache
 * för kartan och som historik att koppla till jaktdagar och drev.
 *
 * - Samma modellkörning för samma punkt sparas bara en gång.
 * - Bara steg från 6 h före till 48 h efter hämtningen sparas.
 * - Rader utan koppling till en jaktdag rensas efter 14 dagar. Rader
 *   kopplade till en jaktdag behålls (historik för analys i efterhand).
 */

const RENSA_EFTER = 14 * 24 * 3600;

export async function sparaVindprognos(
  db: SQLiteDatabase,
  p: VindPrognos,
  koppling: { jaktdagId: Uuid | null; jaktmarkId: Uuid | null },
): Promise<void> {
  if (p.steg.length === 0) return;
  if (p.referensTid !== null) {
    const finns = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM VindPrognos
       WHERE kalla = ? AND lat = ? AND lon = ? AND referensTid = ?
         AND (jaktdagId IS ? OR jaktdagId = ?)`,
      [p.kalla, p.lat, p.lon, p.referensTid, koppling.jaktdagId, koppling.jaktdagId],
    );
    if ((finns?.n ?? 0) > 0) return;
  }
  const now = Math.floor(Date.now() / 1000);
  const fran = p.hamtadAt - 6 * 3600;
  const till = p.hamtadAt + 48 * 3600;
  await db.withTransactionAsync(async () => {
    for (const s of p.steg) {
      if (s.tid < fran || s.tid > till) continue;
      await db.runAsync(
        `INSERT INTO VindPrognos (id, kalla, lat, lon, rutLat, rutLon, referensTid, publiceradTid,
           hamtadAt, tid, vindRiktning, medelvind, byvind, jaktdagId, jaktmarkId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          p.kalla,
          p.lat,
          p.lon,
          p.rutLat,
          p.rutLon,
          p.referensTid,
          p.publiceradTid,
          p.hamtadAt,
          s.tid,
          s.franGrader,
          s.medelvind,
          s.byvind,
          koppling.jaktdagId,
          koppling.jaktmarkId,
          now,
        ],
      );
    }
    await db.runAsync(
      "DELETE FROM VindPrognos WHERE jaktdagId IS NULL AND tid < ?",
      [now - RENSA_EFTER],
    );
  });
}

/**
 * Den senast hämtade prognosen för en (avrundad) punkt, ur databasen.
 * Används när nätet saknas. Returnerar null om inget finns.
 */
export async function senasteSparadePrognos(
  db: SQLiteDatabase,
  kalla: string,
  lat: number,
  lon: number,
  meta: Pick<VindPrognos, "kallaNamn" | "attribution">,
): Promise<VindPrognos | null> {
  const senast = await db.getFirstAsync<{ hamtadAt: number }>(
    "SELECT MAX(hamtadAt) AS hamtadAt FROM VindPrognos WHERE kalla = ? AND lat = ? AND lon = ?",
    [kalla, lat, lon],
  );
  if (!senast?.hamtadAt) return null;
  const rader = await db.getAllAsync<VindPrognosRad>(
    `SELECT * FROM VindPrognos WHERE kalla = ? AND lat = ? AND lon = ? AND hamtadAt = ?
     GROUP BY tid ORDER BY tid ASC`,
    [kalla, lat, lon, senast.hamtadAt],
  );
  if (rader.length === 0) return null;
  const f = rader[0];
  return {
    kalla,
    kallaNamn: meta.kallaNamn,
    attribution: meta.attribution,
    lat,
    lon,
    rutLat: f.rutLat,
    rutLon: f.rutLon,
    referensTid: f.referensTid,
    publiceradTid: f.publiceradTid,
    hamtadAt: f.hamtadAt,
    steg: rader.map((r) => ({
      tid: r.tid,
      franGrader: r.vindRiktning,
      medelvind: r.medelvind,
      byvind: r.byvind,
    })),
  };
}

/** Sparade vindsteg för en jaktdag (för framtida analys av drev och upptag). */
export async function hamtaVindForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<VindPrognosRad[]> {
  return db.getAllAsync<VindPrognosRad>(
    "SELECT * FROM VindPrognos WHERE jaktdagId = ? ORDER BY tid ASC, hamtadAt DESC",
    [jaktdagId],
  );
}
