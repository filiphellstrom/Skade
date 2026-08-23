import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Hund, HundMedSenasteJaktdag, Uuid } from "../types";

export async function skapaHund(
  db: SQLiteDatabase,
  params: {
    profilId: Uuid;
    namn: string;
    ras?: string;
    fodelsedatum?: number;
    kommentar?: string;
  },
): Promise<Hund> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO Hund (id, profilId, namn, ras, fodelsedatum, kommentar, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.profilId,
      params.namn,
      params.ras ?? null,
      params.fodelsedatum ?? null,
      params.kommentar ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    profilId: params.profilId,
    namn: params.namn,
    ras: params.ras ?? null,
    fodelsedatum: params.fodelsedatum ?? null,
    kommentar: params.kommentar ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function hamtaHundarForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Hund[]> {
  return db.getAllAsync<Hund>(
    "SELECT * FROM Hund WHERE profilId = ? ORDER BY namn",
    [profilId],
  );
}

/** Hämtar en enskild hund via id, t.ex. för att visa namnet på timer-skärmen. */
export async function hamtaHund(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<Hund | null> {
  const row = await db.getFirstAsync<Hund>("SELECT * FROM Hund WHERE id = ?", [
    hundId,
  ]);
  return row ?? null;
}

/**
 * Sida 2 ("Välj hund"): kopplar en hund till jaktdagen. Kan anropas flera
 * gånger för flera hundar samma jaktdag (many-to-many via JaktdagHund).
 */
export async function laggTillHundIJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  hundId: Uuid,
): Promise<void> {
  await db.runAsync(
    "INSERT OR IGNORE INTO JaktdagHund (jaktdagId, hundId) VALUES (?, ?)",
    [jaktdagId, hundId],
  );
}

/**
 * Hämtar de hundar som är kopplade till en specifik jaktdag (via
 * JaktdagHund). Används på timer-skärmen för att låta användaren byta
 * vilken hund som är aktiv mellan drev, när fler än en hund valdes i
 * "Välj hund"-steget.
 */
export async function hamtaHundarForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Hund[]> {
  return db.getAllAsync<Hund>(
    `SELECT h.* FROM Hund h
     JOIN JaktdagHund jh ON jh.hundId = h.id
     WHERE jh.jaktdagId = ?
     ORDER BY h.namn`,
    [jaktdagId],
  );
}

/**
 * Huvudskärmens hundlista: per hund, datum för senaste jaktdagen samt total
 * sammanlagd drevtid (summan av duration) under just den jaktdagen.
 *
 * Använder en window function (ROW_NUMBER) för att korrekt para ihop rätt
 * jaktdagId med MAX(datum) - se bugfix i ändringsloggen 2026-08-23.
 */
export async function hamtaHundarMedSenasteJaktdag(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<HundMedSenasteJaktdag[]> {
  return db.getAllAsync<HundMedSenasteJaktdag>(
    `WITH senasteJaktdagPerHund AS (
       SELECT
         jh.hundId,
         j.id AS jaktdagId,
         j.datum,
         ROW_NUMBER() OVER (PARTITION BY jh.hundId ORDER BY j.datum DESC) AS rn
       FROM JaktdagHund jh
       JOIN Jaktdag j ON j.id = jh.jaktdagId
     )
     SELECT
       h.id AS hundId,
       h.namn,
       s.datum AS senasteJaktDatum,
       COALESCE(SUM(d.duration), 0) AS totalDrevtid
     FROM Hund h
     LEFT JOIN senasteJaktdagPerHund s ON s.hundId = h.id AND s.rn = 1
     LEFT JOIN Drev d ON d.hundId = h.id AND d.jaktdagId = s.jaktdagId
     WHERE h.profilId = ?
     GROUP BY h.id, h.namn, s.datum`,
    [profilId],
  );
}
