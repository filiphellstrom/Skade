/**
 * Migration 0005 – profilbild, hundbilder och dokument på profilen.
 *
 * Beslutat 2026-10-29 (se claude/design-lyft-beslut.md, "Tillägg
 * 2026-10-29"), byggt 2026-11-01.
 *
 * - `Profil.bild` och `Hund.bild`: filnamn (inte full sökväg) i appens
 *   egen filmapp, se src/utils/filer.ts. Bara filnamnet sparas eftersom
 *   iOS byter appens containersökväg vid uppdateringar. På webben sparas
 *   en data:-URL direkt i kolumnen. NULL = ingen bild (initial visas).
 * - `Dokument`: jägarexamen, vapenlicens, försäkring eller övrigt. Filen
 *   (bild eller PDF) sparas bara lokalt, samma princip som bilderna.
 *   `giltigTill` NULL = inget slutdatum. `notisId` är id:t på den
 *   schemalagda lokala påminnelsen (expo-notifications), så att den kan
 *   tas bort när dokumentet ändras eller raderas.
 *
 * ALTER TABLE ... ADD COLUMN utan DEFAULT ger NULL på befintliga rader -
 * säkert att köra på en databas som redan har data.
 */
export const sql = `
ALTER TABLE Profil ADD COLUMN bild TEXT;
ALTER TABLE Hund ADD COLUMN bild TEXT;

CREATE TABLE Dokument (
  id TEXT PRIMARY KEY,
  profilId TEXT NOT NULL REFERENCES Profil(id),
  typ TEXT NOT NULL CHECK (typ IN ('jagarexamen', 'vapenlicens', 'forsakring', 'ovrigt')),
  namn TEXT NOT NULL,
  fil TEXT,
  filtyp TEXT CHECK (filtyp IS NULL OR filtyp IN ('bild', 'pdf')),
  giltigTill INTEGER,
  paminnelseDagar INTEGER NOT NULL DEFAULT 30,
  notisId TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_dokument_profil ON Dokument(profilId);
`;
