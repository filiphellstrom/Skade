import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Hund, HundMedSenasteJaktdag, Uuid } from "../types";
import { hamtaPagaendeDrevForHund } from "./drev";

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
    arkiverad: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Aktiva (icke arkiverade) hundar - listan man kan välja bland i "Välj hund". */
export async function hamtaHundarForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Hund[]> {
  return db.getAllAsync<Hund>(
    "SELECT * FROM Hund WHERE profilId = ? AND arkiverad = 0 ORDER BY namn",
    [profilId],
  );
}

/** Hämtar en enskild hund via id, oavsett arkiverad-status (redigeringsskärmen behöver kunna öppna även arkiverade). */
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
 * Sprint 3: redigera en hunds uppgifter (namn/ras/födelsedatum/kommentar)
 * från app/hund/[hundId].tsx.
 */
export async function uppdateraHund(
  db: SQLiteDatabase,
  hundId: Uuid,
  params: {
    namn: string;
    ras: string | null;
    fodelsedatum: number | null;
    kommentar: string | null;
  },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `UPDATE Hund SET namn = ?, ras = ?, fodelsedatum = ?, kommentar = ?, updatedAt = ?
     WHERE id = ?`,
    [params.namn, params.ras, params.fodelsedatum, params.kommentar, now, hundId],
  );
}

/**
 * Arkiverar en hund (soft delete - se migration 0002): plockas bort ur
 * de vanliga listorna, historiken (Drev/JaktdagHund) rörs inte. Blockerad
 * om hunden har ett pågående drev just nu - annars skulle den försvinna
 * ur listorna mitt under en aktiv timer.
 */
export async function arkiveraHund(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<void> {
  const pagaendeDrev = await hamtaPagaendeDrevForHund(db, hundId);
  if (pagaendeDrev) {
    throw new Error(
      "Kan inte arkivera hunden - stoppa det pågående drevet först.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "UPDATE Hund SET arkiverad = 1, updatedAt = ? WHERE id = ?",
    [now, hundId],
  );
}

/** Återställer en arkiverad hund till de vanliga listorna igen. */
export async function avarkiveraHund(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "UPDATE Hund SET arkiverad = 0, updatedAt = ? WHERE id = ?",
    [now, hundId],
  );
}

/**
 * Har hunden någon historik (kopplad till minst en jaktdag, eller har
 * minst ett drev)? Används av redigeringsskärmen för att avgöra om
 * raderingen behöver en extra varning - se raderaHund().
 */
export async function hamtaHundHarHistorik(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ antal: number }>(
    `SELECT (
       (SELECT COUNT(*) FROM Drev WHERE hundId = ?) +
       (SELECT COUNT(*) FROM JaktdagHund WHERE hundId = ?)
     ) AS antal`,
    [hundId, hundId],
  );
  return (row?.antal ?? 0) > 0;
}

/**
 * Raderar en hund PERMANENT, inklusive all dess historik (Drev-rader och
 * JaktdagHund-kopplingar) - till skillnad från arkiveraHund() som bara
 * döljer hunden. UI:t (app/hund/[hundId].tsx) ska varna extra tydligt och
 * kräva en andra bekräftelse om hamtaHundHarHistorik() svarar true innan
 * detta anropas (beslutat 2026-08-23).
 *
 * Blockerad om hunden har ett pågående drev just nu, av samma anledning
 * som arkiveraHund().
 *
 * Själva jaktdagarna hunden deltagit i tas INTE bort - bara kopplingen
 * till dem (JaktdagHund) och hundens egna Drev-rader. Om hunden var
 * aktivHundId på en jaktdag nollställs det fältet (jaktdagen hamnar i
 * samma "hundval ej slutfört"-läge som annars, se hamtaPagaendeJaktdag()).
 */
export async function raderaHund(
  db: SQLiteDatabase,
  hundId: Uuid,
): Promise<void> {
  const pagaendeDrev = await hamtaPagaendeDrevForHund(db, hundId);
  if (pagaendeDrev) {
    throw new Error(
      "Kan inte radera hunden - stoppa det pågående drevet först.",
    );
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM Drev WHERE hundId = ?", [hundId]);
    await db.runAsync("DELETE FROM JaktdagHund WHERE hundId = ?", [hundId]);
    await db.runAsync(
      "UPDATE Jaktdag SET aktivHundId = NULL WHERE aktivHundId = ?",
      [hundId],
    );
    await db.runAsync("DELETE FROM Hund WHERE id = ?", [hundId]);
  });
}

/** Arkiverade hundar - visas på app/hund/arkiverade.tsx. */
export async function hamtaArkiveradeHundar(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Hund[]> {
  return db.getAllAsync<Hund>(
    "SELECT * FROM Hund WHERE profilId = ? AND arkiverad = 1 ORDER BY namn",
    [profilId],
  );
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
 * Arkiverade hundar räknas inte med - se hamtaArkiveradeHundar() för dem.
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
     WHERE h.profilId = ? AND h.arkiverad = 0
     GROUP BY h.id, h.namn, s.datum`,
    [profilId],
  );
}
