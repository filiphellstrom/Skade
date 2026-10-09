import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Jaktdag, Uuid } from "../types";

/**
 * SELECT-fragment delat av alla frågor som returnerar en hel Jaktdag.
 * Migration 0003: `jaktmark` finns inte längre som egen kolumn på
 * Jaktdag - namnet hämtas via JOIN mot Jaktmark och aliasas till samma
 * fältnamn som förut, så Jaktdag-typen (och alla skärmar som bara visar
 * `jaktdag.jaktmark`) är oförändrad.
 */
const JAKTDAG_MED_JAKTMARK = `
  SELECT j.id, j.profilId, j.datum, j.jaktmarkId, m.namn AS jaktmark,
         j.aktivHundId, j.status, j.avslutadAt, j.createdAt, j.updatedAt
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
  params: { profilId: Uuid; datum: number; jaktmarkId: Uuid },
): Promise<Jaktdag> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    `INSERT INTO Jaktdag (id, profilId, datum, jaktmarkId, aktivHundId, status, avslutadAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, 'pagar', NULL, ?, ?)`,
    [id, params.profilId, params.datum, params.jaktmarkId, now, now],
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
 * det är inte en databasbegränsning, bara en regel huvudskärmens UI följer
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
