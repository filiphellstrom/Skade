import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Jaktdag, Uuid } from "../types";

/**
 * Sida 1 i flödet ("Ny jaktdag"): skapar en Jaktdag-rad direkt, utan
 * hund vald ännu (aktivHundId = NULL). Se beslutat sparflöde i
 * 0001_init.ts-headern - varje steg sparar direkt till databasen.
 */
export async function skapaJaktdag(
  db: SQLiteDatabase,
  params: { profilId: Uuid; datum: number; jaktmark: string },
): Promise<Jaktdag> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO Jaktdag (id, profilId, datum, jaktmark, aktivHundId, status, avslutadAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, 'pagar', NULL, ?, ?)`,
    [id, params.profilId, params.datum, params.jaktmark, now, now],
  );

  return {
    id,
    profilId: params.profilId,
    datum: params.datum,
    jaktmark: params.jaktmark,
    aktivHundId: null,
    status: "pagar",
    avslutadAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function hamtaJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Jaktdag | null> {
  const row = await db.getFirstAsync<Jaktdag>(
    "SELECT * FROM Jaktdag WHERE id = ?",
    [jaktdagId],
  );
  return row ?? null;
}

/**
 * Sida 2 ("Välj hund"): sätter aktivHundId på en redan skapad jaktdag.
 * JaktdagHund-raderna för de valda hundarna skapas separat, se hund.ts.
 */
export async function settAktivHund(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  hundId: Uuid,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "UPDATE Jaktdag SET aktivHundId = ?, updatedAt = ? WHERE id = ?",
    [hundId, now, jaktdagId],
  );
}

/**
 * Blockerar avslut om ett drev fortfarande pågår för jaktdagen (beslutat
 * 2026-08-23: "avsluta jaktdag" ska blockeras, inte auto-stoppa drevet).
 * Kastar ett fel med en tydlig, användarvänd text som UI:t kan visa direkt.
 */
export async function avslutaJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<void> {
  const pagaendeDrev = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM Drev WHERE jaktdagId = ? AND endTimestamp IS NULL",
    [jaktdagId],
  );

  if (pagaendeDrev) {
    throw new Error(
      "Kan inte avsluta jaktdagen - stoppa det pågående drevet först.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "UPDATE Jaktdag SET status = 'avslutad', avslutadAt = ?, updatedAt = ? WHERE id = ?",
    [now, now, jaktdagId],
  );
}
