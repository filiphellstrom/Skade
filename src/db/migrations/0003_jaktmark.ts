/**
 * Migration 0003 – jaktmark blir ett eget objekt (egen tabell) istället
 * för en fri textrad på Jaktdag.
 *
 * Beslutad: 2026-10-08, i förstudien om lock-screen Live Activity +
 * jaktmarker. Motivering: Filip vill kunna knyta ett framtida Wehunt-id
 * till varje jaktmark (ingen integration byggs nu, bara en nullbar plats
 * för det), och en egen tabell ger en lista att välja/återanvända från
 * istället för att skriva samma markens namn på nytt varje gång (och
 * riskera stavvarianter som splittrar statistiken per mark i framtiden).
 *
 * En ren, läsbar kopia av samma SQL finns även i 0003_jaktmark.sql.reference
 * i den här mappen - håll filerna i synk om SQL:en ändras (se 0001_init.ts).
 *
 * Vad migrationen gör, i ordning:
 *   1. Skapar Jaktmark-tabellen. `wehuntId` är en nullbar TEXT-kolumn för
 *      ett framtida Wehunt-objekt-id - ingen Wehunt-integration byggs i
 *      den här migrationen, bara platsen för den.
 *   2. Backfyller EN Jaktmark-rad per unikt (profilId, jaktmark)-par som
 *      redan finns i Jaktdag - bevarar Filips befintliga testdata som
 *      riktiga Jaktmark-objekt istället för att tappa den.
 *   3. Lägger till den nya kolumnen Jaktdag.jaktmarkId (FK mot Jaktmark)
 *      och fyller i den för varje befintlig rad utifrån samma
 *      (profilId, jaktmark)-matchning som steg 2 skapade.
 *   4. Tar bort den gamla fritextkolumnen Jaktdag.jaktmark - all kod läser
 *      hädanefter markens namn via JOIN mot Jaktmark istället (se
 *      queries/jaktdag.ts, queries/statistik.ts, queries/export.ts).
 *
 * Medvetna förenklingar (OK eftersom appen inte har några riktiga
 * användare än - bara Filips egen testdata, se chatten):
 * - `jaktmarkId` görs INTE NOT NULL på databasnivå. SQLite kan inte lägga
 *   till en NOT NULL-kolumn med per-rad-olika värden via ALTER TABLE ADD
 *   COLUMN (bara ett konstant DEFAULT stöds), och en full
 *   tabellombyggnad för att tvinga fram det kändes som överkurs för en
 *   förstudie. Appkoden garanterar att den alltid sätts (se
 *   hamtaEllerSkapaJaktmark() i queries/jaktmark.ts) - samma mönster som
 *   redan finns för Jaktdag.aktivHundId.
 * - Backfillens Jaktmark.id genereras med SQLites inbyggda
 *   randomblob()/hex() - inte den riktiga randomUUID() appen annars
 *   använder (den finns bara i JS, inte i ren SQL). Formatet ser ut som en
 *   vanlig UUID v4 (samma mönster som används brett i SQLite-communityn för
 *   just den här typen av engångsbackfill) men är inte kryptografiskt
 *   verifierad som en - gör inget här eftersom det bara är ett
 *   primärnyckelvärde, aldrig exponerat för användaren. ALLA jaktmarker
 *   som skapas efter den här migrationen (se skapaJaktmark()) använder
 *   appens vanliga randomUUID() precis som alla andra tabeller.
 * - Kräver att expo-sqlite kör en SQLite-version med stöd för
 *   `ALTER TABLE ... DROP COLUMN` (tillagt i SQLite 3.35.0, 2021-03) -
 *   expo-sqlite ~16 bundlar en betydligt nyare version, men flaggat här
 *   ifall migrationen någonsin körs mot en oväntat gammal SQLite-build.
 */
export const sql = `
CREATE TABLE Jaktmark (
  id TEXT PRIMARY KEY,
  profilId TEXT NOT NULL REFERENCES Profil(id),
  namn TEXT NOT NULL,
  wehuntId TEXT,                   -- frivillig, framtida Wehunt-koppling (ingen integration än)
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_jaktmark_profil_namn ON Jaktmark(profilId, namn);

-- Steg 2: en Jaktmark-rad per unikt (profilId, jaktmark) som redan finns.
INSERT INTO Jaktmark (id, profilId, namn, wehuntId, createdAt, updatedAt)
SELECT
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  ) AS id,
  profilId,
  jaktmark AS namn,
  NULL AS wehuntId,
  MIN(createdAt) AS createdAt,
  MAX(updatedAt) AS updatedAt
FROM Jaktdag
GROUP BY profilId, jaktmark;

-- Steg 3: ny FK-kolumn, backfylld utifrån samma (profilId, jaktmark)-matchning.
ALTER TABLE Jaktdag ADD COLUMN jaktmarkId TEXT REFERENCES Jaktmark(id);

UPDATE Jaktdag
SET jaktmarkId = (
  SELECT m.id FROM Jaktmark m
  WHERE m.profilId = Jaktdag.profilId AND m.namn = Jaktdag.jaktmark
);

-- Steg 4: gamla fritextkolumnen bort - all läsning sker hädanefter via JOIN.
ALTER TABLE Jaktdag DROP COLUMN jaktmark;

CREATE INDEX idx_jaktdag_jaktmark ON Jaktdag(jaktmarkId);
CREATE INDEX idx_jaktmark_profil ON Jaktmark(profilId);
`;
