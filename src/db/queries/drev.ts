import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Drev, Uuid } from "../types";

/**
 * Sida 3 ("Starta timer"): skapar ett nytt Drev med startTimestamp = nu.
 *
 * Databasen garanterar via idx_one_active_drev_per_jaktdag (unikt index på
 * Drev.jaktdagId WHERE endTimestamp IS NULL) att det aldrig kan finnas mer
 * än ett pågående drev per jaktdag samtidigt. Ett INSERT som bryter mot
 * detta kastar ett SQLite-fel som UI:t bör fånga och visa som "ett drev
 * pågår redan".
 */
export async function startaDrev(
  db: SQLiteDatabase,
  params: { jaktdagId: Uuid; hundId: Uuid },
): Promise<Drev> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO Drev (id, jaktdagId, hundId, startTimestamp, endTimestamp, duration, species, outcome, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
    [id, params.jaktdagId, params.hundId, now, now, now],
  );

  return {
    id,
    jaktdagId: params.jaktdagId,
    hundId: params.hundId,
    startTimestamp: now,
    endTimestamp: null,
    duration: null,
    species: null,
    outcome: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Stoppar ett pågående drev: sätter endTimestamp = nu och beräknar
 * duration en gång (sparas, räknas inte om vid varje läsning - beslutat
 * 2026-08-23).
 */
export async function stoppaDrev(
  db: SQLiteDatabase,
  drevId: Uuid,
): Promise<Drev> {
  const drev = await db.getFirstAsync<Drev>("SELECT * FROM Drev WHERE id = ?", [
    drevId,
  ]);

  if (!drev) {
    throw new Error(`Drev med id ${drevId} hittades inte.`);
  }
  if (drev.endTimestamp !== null) {
    throw new Error("Drevet är redan stoppat.");
  }

  const now = Math.floor(Date.now() / 1000);
  const duration = now - drev.startTimestamp;

  await db.runAsync(
    "UPDATE Drev SET endTimestamp = ?, duration = ?, updatedAt = ? WHERE id = ?",
    [now, duration, now, drevId],
  );

  return { ...drev, endTimestamp: now, duration, updatedAt: now };
}

/**
 * Sprint 3: sätter viltart och/eller utfall på ett (oftast nyss stoppat)
 * drev - valfritt fält för fält, se app/jaktdag/[jaktdagId]/drev/[drevId].tsx.
 * Tom sträng sparas som NULL, inte som "".
 */
export async function uppdateraDrevViltartUtfall(
  db: SQLiteDatabase,
  drevId: Uuid,
  params: { species?: string; outcome?: string },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (params.species !== undefined) {
    await db.runAsync(
      "UPDATE Drev SET species = ?, updatedAt = ? WHERE id = ?",
      [params.species.trim() || null, now, drevId],
    );
  }
  if (params.outcome !== undefined) {
    await db.runAsync(
      "UPDATE Drev SET outcome = ?, updatedAt = ? WHERE id = ?",
      [params.outcome.trim() || null, now, drevId],
    );
  }
}

/** Hämtar det pågående drevet för en jaktdag, om något finns. */
export async function hamtaPagaendeDrev(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Drev | null> {
  const row = await db.getFirstAsync<Drev>(
    "SELECT * FROM Drev WHERE jaktdagId = ? AND endTimestamp IS NULL",
    [jaktdagId],
  );
  return row ?? null;
}

/**
 * Hämtar ett pågående drev för en specifik HUND (oavsett jaktdag) - inte
 * att förväxla med hamtaPagaendeDrev() ovan som söker per jaktdag.
 * Används som skydd i arkiveraHund()/raderaHund() (src/db/queries/hund.ts)
 * så att en hund inte kan arkiveras eller raderas medan dess timer går.
 */
export async function hamtaPagaendeDrevForHund(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<Drev | null> {
  const row = await db.getFirstAsync<Drev>(
    "SELECT * FROM Drev WHERE hundId = ? AND endTimestamp IS NULL",
    [hundId],
  );
  return row ?? null;
}

/**
 * Hämtar ett specifikt drev via id - används av
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx (viltart/utfall-vyn) för att
 * ladda drevet man precis stoppade.
 */
export async function hamtaDrev(
  db: SQLiteDatabase,
  drevId: Uuid,
): Promise<Drev | null> {
  const row = await db.getFirstAsync<Drev>("SELECT * FROM Drev WHERE id = ?", [
    drevId,
  ]);
  return row ?? null;
}

/** Hämtar senaste (nyast startade) drevet för en jaktdag, oavsett status. */
export async function hamtaSenasteDrev(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Drev | null> {
  const row = await db.getFirstAsync<Drev>(
    "SELECT * FROM Drev WHERE jaktdagId = ? ORDER BY startTimestamp DESC LIMIT 1",
    [jaktdagId],
  );
  return row ?? null;
}
