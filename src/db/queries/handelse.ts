import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { DrevHandelse, HandelseTyp, Uuid } from "../types";

/**
 * Migration 0006: drevhändelser. Upptag/drevslut är Drev.start/end - här
 * finns bara släpp, tappt, återupptag och kopplad. Beräkningar (tappttid,
 * söktid) ligger i src/utils/drevhandelser.ts.
 */
export async function registreraHandelse(
  db: SQLiteDatabase,
  params: {
    jaktdagId: Uuid;
    hundId: Uuid;
    drevId: Uuid | null;
    typ: HandelseTyp;
    tidpunkt?: number;
  },
): Promise<DrevHandelse> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const tidpunkt = params.tidpunkt ?? now;
  await db.runAsync(
    `INSERT INTO DrevHandelse (id, jaktdagId, hundId, drevId, typ, tidpunkt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.jaktdagId,
      params.hundId,
      params.drevId,
      params.typ,
      tidpunkt,
      now,
      now,
    ],
  );
  return { id, ...params, tidpunkt, createdAt: now, updatedAt: now };
}

export async function hamtaHandelserForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<DrevHandelse[]> {
  return db.getAllAsync<DrevHandelse>(
    "SELECT * FROM DrevHandelse WHERE jaktdagId = ? ORDER BY tidpunkt ASC, createdAt ASC",
    [jaktdagId],
  );
}

/**
 * Alla händelser för en profils jaktdagar, valfritt begränsat till
 * jaktdagar vars drev/händelser ligger i [fran, till) - för statistik.
 */
export async function hamtaHandelserForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
  intervall?: { fran: number; till: number },
): Promise<DrevHandelse[]> {
  const villkor = intervall ? "AND e.tidpunkt >= ? AND e.tidpunkt < ?" : "";
  const params = intervall
    ? [profilId, intervall.fran, intervall.till]
    : [profilId];
  return db.getAllAsync<DrevHandelse>(
    `SELECT e.* FROM DrevHandelse e
     JOIN Jaktdag j ON j.id = e.jaktdagId
     WHERE j.profilId = ? ${villkor}
     ORDER BY e.tidpunkt ASC, e.createdAt ASC`,
    params,
  );
}

/** Tar bort en händelse (feltryck), från drevvyn. */
export async function raderaHandelse(
  db: SQLiteDatabase,
  handelseId: Uuid,
): Promise<void> {
  await db.runAsync("DELETE FROM DrevHandelse WHERE id = ?", [handelseId]);
}
