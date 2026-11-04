import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Alder, FalltVilt, Kon, Uuid } from "../types";

/** Migration 0008: fällt vilt. */
export interface FalltViltIndata {
  jaktdagId: Uuid;
  drevId: Uuid | null;
  hundId: Uuid | null;
  art: string;
  antal: number;
  kon: Kon | null;
  alder: Alder | null;
  skytt: string | null;
  tidpunkt: number;
  vikt: number | null;
  kommentar: string | null;
}

export async function skapaFalltVilt(
  db: SQLiteDatabase,
  v: FalltViltIndata,
): Promise<Uuid> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `INSERT INTO FalltVilt (id, jaktdagId, drevId, hundId, art, antal, kon, alder, skytt, tidpunkt, vikt, kommentar,
                            createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      v.jaktdagId,
      v.drevId,
      v.hundId,
      v.art.trim(),
      Math.max(1, Math.round(v.antal)),
      v.kon,
      v.alder,
      v.skytt?.trim() || null,
      v.tidpunkt,
      v.vikt,
      v.kommentar?.trim() || null,
      now,
      now,
    ],
  );
  return id;
}

export async function uppdateraFalltVilt(
  db: SQLiteDatabase,
  id: Uuid,
  v: Omit<FalltViltIndata, "jaktdagId" | "drevId" | "hundId" | "tidpunkt">,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `UPDATE FalltVilt SET art = ?, antal = ?, kon = ?, alder = ?, skytt = ?, vikt = ?, kommentar = ?, updatedAt = ?
     WHERE id = ?`,
    [
      v.art.trim(),
      Math.max(1, Math.round(v.antal)),
      v.kon,
      v.alder,
      v.skytt?.trim() || null,
      v.vikt,
      v.kommentar?.trim() || null,
      now,
      id,
    ],
  );
}

export async function raderaFalltVilt(
  db: SQLiteDatabase,
  id: Uuid,
): Promise<void> {
  await db.runAsync("DELETE FROM FalltVilt WHERE id = ?", [id]);
}

export async function hamtaFalltVilt(
  db: SQLiteDatabase,
  id: Uuid,
): Promise<FalltVilt | null> {
  const rad = await db.getFirstAsync<FalltVilt>(
    "SELECT * FROM FalltVilt WHERE id = ?",
    [id],
  );
  return rad ?? null;
}

export async function hamtaFalltViltForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<FalltVilt[]> {
  return db.getAllAsync<FalltVilt>(
    "SELECT * FROM FalltVilt WHERE jaktdagId = ? ORDER BY tidpunkt ASC, createdAt ASC",
    [jaktdagId],
  );
}

export async function hamtaFalltViltForDrev(
  db: SQLiteDatabase,
  drevId: Uuid,
): Promise<FalltVilt[]> {
  return db.getAllAsync<FalltVilt>(
    "SELECT * FROM FalltVilt WHERE drevId = ? ORDER BY tidpunkt ASC",
    [drevId],
  );
}

/** Fällt vilt med jaktdagens datum, jaktmark och hundens namn - rapport och export. */
export interface FalltViltRad extends FalltVilt {
  datum: number;
  jaktmark: string;
  hundNamn: string | null;
}

export async function hamtaFalltViltForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
  intervall?: { fran: number; till: number },
): Promise<FalltViltRad[]> {
  const villkor = intervall ? "AND f.tidpunkt >= ? AND f.tidpunkt < ?" : "";
  const params = intervall
    ? [profilId, intervall.fran, intervall.till]
    : [profilId];
  return db.getAllAsync<FalltViltRad>(
    `SELECT f.*, j.datum AS datum, m.namn AS jaktmark, h.namn AS hundNamn
     FROM FalltVilt f
     JOIN Jaktdag j ON j.id = f.jaktdagId
     JOIN Jaktmark m ON m.id = j.jaktmarkId
     LEFT JOIN Hund h ON h.id = f.hundId
     WHERE j.profilId = ? ${villkor}
     ORDER BY f.tidpunkt ASC, f.createdAt ASC`,
    params,
  );
}
