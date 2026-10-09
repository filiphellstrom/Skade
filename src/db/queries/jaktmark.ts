import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Jaktmark, Uuid } from "../types";

/**
 * Migration 0003: jaktmarker som eget objekt. Den här filen är den enda
 * platsen som skriver till Jaktmark - queries/jaktdag.ts läser bara via
 * JOIN (se hamtaJaktdag() m.fl. där).
 */

/**
 * Hittar en jaktmark med exakt det här namnet (efter trim) för profilen,
 * eller skapar en ny om ingen finns - samma "hämta eller skapa"-mönster
 * som hamtaEllerSkapaProfil() i queries/profil.ts.
 *
 * Används av "Ny jaktdag"-flödet (app/jaktdag/ny.tsx): fältet är
 * fortfarande fri text i den skärmen (ingen väljare byggd i den här
 * förstudien, se rapporten), men namnet löses alltid in mot ett riktigt
 * Jaktmark-objekt innan jaktdagen skapas - en ny jaktmark skapas bara om
 * namnet verkligen är nytt.
 *
 * Matchningen är EXAKT (efter trim), inte skiftlägesokänslig - "Storskogen"
 * och "storskogen" blir två olika jaktmarker i v1. Medvetet enkelt för
 * förstudien; flagga om det blir ett problem i praktiken.
 */
export async function hamtaEllerSkapaJaktmark(
  db: SQLiteDatabase,
  profilId: Uuid,
  namn: string,
): Promise<Jaktmark> {
  const trimmat = namn.trim();

  const existing = await db.getFirstAsync<Jaktmark>(
    "SELECT * FROM Jaktmark WHERE profilId = ? AND namn = ?",
    [profilId, trimmat],
  );
  if (existing) {
    return existing;
  }

  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    "INSERT INTO Jaktmark (id, profilId, namn, wehuntId, createdAt, updatedAt) VALUES (?, ?, ?, NULL, ?, ?)",
    [id, profilId, trimmat, now, now],
  );

  return {
    id,
    profilId,
    namn: trimmat,
    wehuntId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Alla jaktmarker för en profil, nyast skapade sist. Underlag för en
 * framtida väljare/lista (se rapportens avgränsning - ingen egen skärm
 * byggd i den här förstudien). */
export async function hamtaJaktmarkerForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Jaktmark[]> {
  return db.getAllAsync<Jaktmark>(
    "SELECT * FROM Jaktmark WHERE profilId = ? ORDER BY namn ASC",
    [profilId],
  );
}

export async function hamtaJaktmark(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
): Promise<Jaktmark | null> {
  const row = await db.getFirstAsync<Jaktmark>(
    "SELECT * FROM Jaktmark WHERE id = ?",
    [jaktmarkId],
  );
  return row ?? null;
}

/** Byter namn på en jaktmark, eller sätter/rensar dess Wehunt-id (ingen
 * Wehunt-integration byggd - fältet kan sättas manuellt redan nu så det
 * finns att koppla mot senare). */
export async function uppdateraJaktmark(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
  params: { namn?: string; wehuntId?: string | null },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (params.namn !== undefined) {
    await db.runAsync(
      "UPDATE Jaktmark SET namn = ?, updatedAt = ? WHERE id = ?",
      [params.namn.trim(), now, jaktmarkId],
    );
  }

  if (params.wehuntId !== undefined) {
    await db.runAsync(
      "UPDATE Jaktmark SET wehuntId = ?, updatedAt = ? WHERE id = ?",
      [params.wehuntId, now, jaktmarkId],
    );
  }
}
