import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Fore, Jaktdag, Uuid } from "../types";

/**
 * SELECT-fragment delat av alla frågor som returnerar en hel Jaktdag.
 * Migration 0003: `jaktmark` finns inte längre som egen kolumn på
 * Jaktdag - namnet hämtas via JOIN mot Jaktmark och aliasas till samma
 * fältnamn som förut, så Jaktdag-typen (och alla skärmar som bara visar
 * `jaktdag.jaktmark`) är oförändrad.
 */
const JAKTDAG_MED_JAKTMARK = `
  SELECT j.id, j.profilId, j.datum, j.jaktmarkId, m.namn AS jaktmark,
         j.aktivHundId, j.status, j.avslutadAt, j.fore, j.anteckning,
         j.createdAt, j.updatedAt
  FROM Jaktdag j
  JOIN Jaktmark m ON m.id = j.jaktmarkId
`;

/**
 * Sida 1 i flödet ("Ny jaktdag"): skapar en Jaktdag-rad direkt, utan
 * hund vald ännu (aktivHundId = NULL). Se beslutat sparflöde i
 * 0001_init.ts-headern - varje steg sparar direkt till databasen.
 *
 * Migration 0003: tar `jaktmarkId` istället för en fri textsträng - se
 * hamtaEllerSkapaJaktmark() i queries/jaktmark.ts, som anropande kod
 * (app/jaktdag/ny.tsx) kör FÖRE den här funktionen för att slå upp eller
 * skapa jaktmarken utifrån det fält användaren skrivit i.
 */
export async function skapaJaktdag(
  db: SQLiteDatabase,
  params: {
    profilId: Uuid;
    datum: number;
    jaktmarkId: Uuid;
    fore?: Fore | null;
  },
): Promise<Jaktdag> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO Jaktdag (id, profilId, datum, jaktmarkId, aktivHundId, status, avslutadAt, fore, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, 'pagar', NULL, ?, ?, ?)`,
    [
      id,
      params.profilId,
      params.datum,
      params.jaktmarkId,
      params.fore ?? null,
      now,
      now,
    ],
  );

  const skapad = await hamtaJaktdag(db, id);
  if (!skapad) {
    // Kan bara hända om jaktmarkId pekar på en jaktmark som inte finns -
    // INSERT:en ovan hade då redan kastat ett foreign key-fel (PRAGMA
    // foreign_keys = ON, se src/db/client.ts). Kvar här som ett explicit
    // skyddsnät snarare än att låta funktionen smygreturnera `undefined`.
    throw new Error("Kunde inte skapa jaktdagen.");
  }
  return skapad;
}

export async function hamtaJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<Jaktdag | null> {
  const row = await db.getFirstAsync<Jaktdag>(
    `${JAKTDAG_MED_JAKTMARK} WHERE j.id = ?`,
    [jaktdagId],
  );
  return row ?? null;
}

/**
 * Sprint 2 - huvudskärmen: hämtar profilens pågående jaktdag (status
 * 'pagar'), om någon finns. Styr både vad huvudskärmen visar ("Ny
 * jaktdag" kontra "Fortsätt jaktdag") och vart "Fortsätt"-knappen
 * navigerar - se aktivHundId på svaret: null betyder att hundval aldrig
 * slutfördes (t.ex. om man tryckte tillbaka från "Välj hund"), så då ska
 * man tillbaka dit istället för till timern.
 *
 * Appen tillåter bara en pågående jaktdag i taget (beslutat 2026-08-23) -
 * det är inte en databasbegransning, bara en regel huvudskärmens UI följer
 * genom att dölja "Ny jaktdag" så länge en redan pågår. ORDER BY/LIMIT är
 * ett skyddsnät om det ändå skulle finnas fler någon gång.
 */
export async function hamtaPagaendeJaktdag(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Jaktdag | null> {
  const row = await db.getFirstAsync<Jaktdag>(
    `${JAKTDAG_MED_JAKTMARK} WHERE j.profilId = ? AND j.status = 'pagar' ORDER BY j.createdAt DESC LIMIT 1`,
    [profilId],
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

/**
 * Raderar en jaktdag PERMANENT från historiken, tillsammans med dess
 * Drev-rader och JaktdagHund-kopplingar (Filip 2026-11-02 - tomma jaktdagar
 * blev annars kvar i loggen för alltid). Jaktmarken och hundarna rörs inte.
 *
 * Bara avslutade jaktdagar kan raderas: en pågående jaktdag hör ihop med
 * timern och låsskärmskortet och avslutas först på Hem. UI:t
 * (app/(tabs)/historik/[jaktdagId].tsx) kräver en bekräftelse om dagen
 * har drev, annars raderas den direkt - samma princip som för hundar.
 */
export async function raderaJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<void> {
  const jaktdag = await db.getFirstAsync<{ status: string }>(
    "SELECT status FROM Jaktdag WHERE id = ?",
    [jaktdagId],
  );
  if (!jaktdag) {
    throw new Error("Jaktdagen hittades inte.");
  }
  if (jaktdag.status !== "avslutad") {
    throw new Error(
      "Kan inte radera en pågående jaktdag - avsluta den på Hem först.",
    );
  }

  await db.withTransactionAsync(async () => {
    // Migration 0006-0008: händelser, väder och fällt vilt hör till dagen.
    await db.runAsync("DELETE FROM DrevHandelse WHERE jaktdagId = ?", [
      jaktdagId,
    ]);
    await db.runAsync("DELETE FROM Vader WHERE jaktdagId = ?", [jaktdagId]);
    // Migration 0009: vindprognoser är historik och behålls, bara kopplingen nollas.
    await db.runAsync("UPDATE VindPrognos SET jaktdagId = NULL WHERE jaktdagId = ?", [jaktdagId]);
    await db.runAsync("DELETE FROM FalltVilt WHERE jaktdagId = ?", [jaktdagId]);
    // Migration 0010: jaktdagens spår från Garmin.
    await db.runAsync("DELETE FROM Spar WHERE jaktdagId = ?", [jaktdagId]);
    await db.runAsync("DELETE FROM Drev WHERE jaktdagId = ?", [jaktdagId]);
    await db.runAsync("DELETE FROM JaktdagHund WHERE jaktdagId = ?", [
      jaktdagId,
    ]);
    await db.runAsync("DELETE FROM Jaktdag WHERE id = ?", [jaktdagId]);
  });
}

/** Migration 0007: sätter jaktdagens före (null = inte angivet). */
export async function settFore(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  fore: Fore | null,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync("UPDATE Jaktdag SET fore = ?, updatedAt = ? WHERE id = ?", [
    fore,
    now,
    jaktdagId,
  ]);
}

/**
 * Migration 0007: senast angivna före på samma jaktmark inom `dagar`
 * dagar - förslag när en ny jaktdag startas (före ändras sällan över
 * ett par dagar). NULL om inget finns.
 */
export async function hamtaSenasteFore(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
  dagar = 3,
): Promise<Fore | null> {
  const grans = Math.floor(Date.now() / 1000) - dagar * 86400;
  const rad = await db.getFirstAsync<{ fore: Fore | null }>(
    `SELECT fore FROM Jaktdag
     WHERE jaktmarkId = ? AND fore IS NOT NULL AND datum >= ?
     ORDER BY datum DESC, createdAt DESC LIMIT 1`,
    [jaktmarkId, grans],
  );
  return rad?.fore ?? null;
}

/** Migration 0008: jaktdagboken. Tom text sparas som NULL. */
export async function settAnteckning(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  anteckning: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "UPDATE Jaktdag SET anteckning = ?, updatedAt = ? WHERE id = ?",
    [anteckning.trim() || null, now, jaktdagId],
  );
}
