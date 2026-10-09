/**
 * Migration 0004 – jaktmarksnamn blir unika oavsett skiftläge.
 *
 * Beslutad: 2026-10-09 (sprint 6, designlyftet), godkänd av Filip.
 *
 * 1. Befintliga jaktmarker som bara skiljer sig i skiftläge eller
 *    inledande/avslutande mellanslag ("Storskogen" och "storskogen ")
 *    slås ihop till EN per profil. Den äldsta (createdAt, sedan id)
 *    behålls med sitt namn; jaktdagarna på de andra flyttas dit och
 *    dubbletterna tas bort. Ingen jaktdag eller drev försvinner.
 * 2. Det gamla unika indexet (profilId, namn) ersätts av ett unikt
 *    uttrycksindex på (profilId, namnnyckel), så nya dubbletter stoppas
 *    även på databasnivå.
 *
 * Namnnyckeln: SQLite:s lower() viker bara a-z, så Å/Ä/Ö viks uttryckligen
 * med replace() först. Appen gör samma jämförelse (och lite strängare:
 * slår även ihop flera mellanslag i rad) i namnNyckel() i
 * src/db/queries/jaktmark.ts innan den skriver - indexet är skyddsnätet.
 *
 * En ren kopia av SQL:en finns i 0004_jaktmark_skiftlage.sql.reference.
 */
export const sql = `
CREATE TEMP TABLE _jm_nyckel AS
SELECT
  id,
  profilId,
  createdAt,
  lower(trim(replace(replace(replace(namn, 'Å', 'å'), 'Ä', 'ä'), 'Ö', 'ö'))) AS k
FROM Jaktmark;

CREATE TEMP TABLE _jm_behall AS
SELECT
  a.id AS fran,
  (SELECT b.id FROM _jm_nyckel b
   WHERE b.profilId = a.profilId AND b.k = a.k
   ORDER BY b.createdAt ASC, b.id ASC
   LIMIT 1) AS till
FROM _jm_nyckel a;

UPDATE Jaktdag
SET jaktmarkId = (SELECT till FROM _jm_behall WHERE fran = Jaktdag.jaktmarkId)
WHERE jaktmarkId IN (SELECT fran FROM _jm_behall WHERE fran <> till);

DELETE FROM Jaktmark
WHERE id IN (SELECT fran FROM _jm_behall WHERE fran <> till);

DROP TABLE _jm_behall;
DROP TABLE _jm_nyckel;

DROP INDEX idx_jaktmark_profil_namn;

CREATE UNIQUE INDEX idx_jaktmark_profil_namnnyckel
ON Jaktmark(profilId, lower(trim(replace(replace(replace(namn, 'Å', 'å'), 'Ä', 'ä'), 'Ö', 'ö'))));
`;
