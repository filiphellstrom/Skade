import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Drev, DrevMedHundnamn, UnixTimestamp, Uuid } from "../types";

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
 * Sprint 3 (2026-08-29, utökad efter "Det behövs"): sätter valfri
 * kombination av hund, start-/sluttid och viltart/utfall på ett (oftast
 * nyss stoppat, ibland ett äldre från historiken) drev - se
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx. Ersätter den tidigare
 * uppdateraDrevViltartUtfall() som bara kunde ändra viltart/utfall.
 *
 * hundId uppdateras för sig (inget att räkna om). start-/sluttid hanteras
 * tillsammans eftersom duration måste räknas om utifrån båda - saknas det
 * ena hämtas drevets nuvarande värde som utgångspunkt. Kastar fel om den
 * nya sluttiden inte längre är efter den nya starttiden (samma
 * felmeddelande oavsett vilket av de två fälten som orsakade det - UI:t
 * validerar redan innan Spara går att trycka, det här är ett sista skydd).
 * Viltart/utfall: tom sträng sparas som NULL, inte som "" - oförändrat.
 */
export async function uppdateraDrev(
  db: SQLiteDatabase,
  drevId: Uuid,
  params: {
    hundId?: Uuid;
    startTimestamp?: UnixTimestamp;
    endTimestamp?: UnixTimestamp;
    species?: string;
    outcome?: string;
  },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (params.hundId !== undefined) {
    await db.runAsync(
      "UPDATE Drev SET hundId = ?, updatedAt = ? WHERE id = ?",
      [params.hundId, now, drevId],
    );
  }

  if (params.startTimestamp !== undefined || params.endTimestamp !== undefined) {
    const drev = await db.getFirstAsync<Drev>("SELECT * FROM Drev WHERE id = ?", [
      drevId,
    ]);
    if (!drev) {
      throw new Error(`Drev med id ${drevId} hittades inte.`);
    }

    const nyStart = params.startTimestamp ?? drev.startTimestamp;
    const nySlut = params.endTimestamp ?? drev.endTimestamp;

    if (nySlut !== null && nySlut <= nyStart) {
      throw new Error("Sluttiden måste vara efter starttiden.");
    }

    const duration = nySlut !== null ? nySlut - nyStart : null;

    await db.runAsync(
      "UPDATE Drev SET startTimestamp = ?, endTimestamp = ?, duration = ?, updatedAt = ? WHERE id = ?",
      [nyStart, nySlut, duration, now, drevId],
    );
  }

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

/**
 * Sprint 3: samma som hamtaDrev() men med hundens namn inbakat (JOIN) -
 * används av app/jaktdag/[jaktdagId]/drev/[drevId].tsx när skärmen öppnas
 * för att redigera/radera ett äldre drev från historiken, inte bara ett
 * precis stoppat (då räcker det redan man vet vilken hund det gäller).
 */
export async function hamtaDrevMedHundnamn(
  db: SQLiteDatabase,
  drevId: Uuid,
): Promise<DrevMedHundnamn | null> {
  const row = await db.getFirstAsync<DrevMedHundnamn>(
    `SELECT d.*, h.namn AS hundNamn
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE d.id = ?`,
    [drevId],
  );
  return row ?? null;
}

/**
 * Sprint 3: raderar ett drev permanent - "Radera drev" i
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx, nåbart både direkt efter ett
 * stopp och från historiken, om man registrerat fel drev. Blockerad om
 * drevet fortfarande pågår (samma försiktighetsprincip som
 * arkiveraHund()/raderaHund() - normalt inte möjligt att nå hit för ett
 * pågående drev, men skyddar mot det ändå).
 */
export async function raderaDrev(db: SQLiteDatabase, drevId: Uuid): Promise<void> {
  const drev = await db.getFirstAsync<Drev>("SELECT * FROM Drev WHERE id = ?", [
    drevId,
  ]);

  if (!drev) {
    throw new Error(`Drev med id ${drevId} hittades inte.`);
  }
  if (drev.endTimestamp === null) {
    throw new Error("Kan inte radera ett pågående drev.");
  }

  await db.runAsync("DELETE FROM Drev WHERE id = ?", [drevId]);
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
