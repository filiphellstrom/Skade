import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Jaktmark, JaktmarkMedSummering, Uuid } from "../types";

/**
 * Migration 0003: jaktmarker som eget objekt. Den här filen är den enda
 * platsen som skriver till Jaktmark - queries/jaktdag.ts läser bara via
 * JOIN (se hamtaJaktdag() m.fl. där).
 *
 * NAMNMATCHNING (sprint 6): skiftlägesokänslig och utan inledande/
 * avslutande mellanslag, med svenska regler ("Älgmyren" = "älgmyren").
 * Görs i appen och inte med SQLite:s COLLATE NOCASE, eftersom NOCASE bara
 * viker a-z och alltså inte å, ä och ö. Profilen har få jaktmarker, så
 * jämförelsen över alla rader är billig.
 *
 * Migration 0004 slog ihop befintliga dubbletter och lade ett unikt
 * uttrycksindex på (profilId, namnnyckel) som skyddsnät. Appen kontrollerar
 * ändå själv först, så att användaren får ett begripligt fel i stället för
 * ett constraint-fel.
 */

/** Jämförelsenyckel för ett jaktmarksnamn. */
export function namnNyckel(namn: string): string {
  return namn.trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

async function hittaMedNamn(
  db: SQLiteDatabase,
  profilId: Uuid,
  namn: string,
  utomId?: Uuid,
): Promise<Jaktmark | null> {
  const alla = await db.getAllAsync<Jaktmark>("SELECT * FROM Jaktmark WHERE profilId = ?", [profilId]);
  const nyckel = namnNyckel(namn);
  return alla.find((m) => m.id !== utomId && namnNyckel(m.namn) === nyckel) ?? null;
}

/**
 * Hittar en jaktmark med samma namn (skiftlägesokänsligt, se ovan) eller
 * skapar en ny - samma "hämta eller skapa"-mönster som
 * hamtaEllerSkapaProfil(). Används av "Ny jaktdag" när man skriver ett
 * namn i stället för att välja en befintlig mark.
 */
export async function hamtaEllerSkapaJaktmark(
  db: SQLiteDatabase,
  profilId: Uuid,
  namn: string,
): Promise<Jaktmark> {
  const befintlig = await hittaMedNamn(db, profilId, namn);
  if (befintlig) {
    return befintlig;
  }
  return skapaNyJaktmark(db, profilId, namn);
}

async function skapaNyJaktmark(db: SQLiteDatabase, profilId: Uuid, namn: string): Promise<Jaktmark> {
  const trimmat = namn.trim().replace(/\s+/g, " ");
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    "INSERT INTO Jaktmark (id, profilId, namn, wehuntId, createdAt, updatedAt) VALUES (?, ?, ?, NULL, ?, ?)",
    [id, profilId, trimmat, now, now],
  );
  return { id, profilId, namn: trimmat, wehuntId: null, createdAt: now, updatedAt: now };
}

/**
 * "Lägg till jaktmark" i Jaktmarker-fliken. Till skillnad från
 * hamtaEllerSkapaJaktmark() är en befintlig mark med samma namn ett fel
 * här - användaren försöker uttryckligen skapa en ny.
 */
export async function skapaJaktmark(
  db: SQLiteDatabase,
  profilId: Uuid,
  namn: string,
): Promise<Jaktmark> {
  const befintlig = await hittaMedNamn(db, profilId, namn);
  if (befintlig) {
    throw new Error(`Det finns redan en jaktmark som heter ${befintlig.namn}.`);
  }
  return skapaNyJaktmark(db, profilId, namn);
}

/** Alla jaktmarker för en profil, i bokstavsordning. */
export async function hamtaJaktmarkerForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<Jaktmark[]> {
  return db.getAllAsync<Jaktmark>(
    "SELECT * FROM Jaktmark WHERE profilId = ? ORDER BY namn ASC",
    [profilId],
  );
}

/**
 * Jaktmarker med antal jaktdagar, senaste jaktdag och total drevtid -
 * Jaktmarker-fliken och väljaren i "Ny jaktdag". Senast använda först,
 * oanvända sist i bokstavsordning.
 */
export async function hamtaJaktmarkerMedSummering(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<JaktmarkMedSummering[]> {
  return db.getAllAsync<JaktmarkMedSummering>(
    `SELECT
       m.*,
       COUNT(j.id) AS antalJaktdagar,
       MAX(j.datum) AS senastDatum,
       COALESCE((
         SELECT SUM(d.duration)
         FROM Drev d
         JOIN Jaktdag j2 ON j2.id = d.jaktdagId
         WHERE j2.jaktmarkId = m.id AND d.endTimestamp IS NOT NULL
       ), 0) AS totalDrevtid
     FROM Jaktmark m
     LEFT JOIN Jaktdag j ON j.jaktmarkId = m.id
     WHERE m.profilId = ?
     GROUP BY m.id
     ORDER BY (MAX(j.datum) IS NULL) ASC, MAX(j.datum) DESC, m.namn ASC`,
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

/**
 * Byter namn på en jaktmark, eller sätter/rensar dess Wehunt-id (ingen
 * Wehunt-integration byggd). Ett nytt namn som krockar (skiftlägesokänsligt)
 * med en annan jaktmark ger ett fel - annars skulle två marker se likadana
 * ut i listan.
 */
export async function uppdateraJaktmark(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
  params: { namn?: string; wehuntId?: string | null },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (params.namn !== undefined) {
    const jag = await hamtaJaktmark(db, jaktmarkId);
    if (!jag) {
      throw new Error("Jaktmarken finns inte längre.");
    }
    const krock = await hittaMedNamn(db, jag.profilId, params.namn, jaktmarkId);
    if (krock) {
      throw new Error(`Det finns redan en jaktmark som heter ${krock.namn}.`);
    }
    await db.runAsync(
      "UPDATE Jaktmark SET namn = ?, updatedAt = ? WHERE id = ?",
      [params.namn.trim().replace(/\s+/g, " "), now, jaktmarkId],
    );
  }

  if (params.wehuntId !== undefined) {
    await db.runAsync(
      "UPDATE Jaktmark SET wehuntId = ?, updatedAt = ? WHERE id = ?",
      [params.wehuntId, now, jaktmarkId],
    );
  }
}
