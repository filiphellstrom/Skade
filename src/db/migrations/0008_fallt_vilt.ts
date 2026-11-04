/**
 * Migration 0008 – fällt vilt och jaktdagbok (2026-11-04).
 *
 * - FalltVilt: en rad per fällning (antal > 1 för t.ex. flera harar).
 *   drevId NULL = fällt utan drev (pass). Raderas ett drev ligger viltet
 *   kvar med drevId NULL (viltet raderas aldrig automatiskt).
 *   kon/alder NULL = okänt. ungdjur = kalv/kid/årsunge.
 * - Jaktdag.anteckning: fritext, jaktdagboken.
 */
export const sql = `
CREATE TABLE FalltVilt (
  id TEXT PRIMARY KEY,
  jaktdagId TEXT NOT NULL REFERENCES Jaktdag(id),
  drevId TEXT REFERENCES Drev(id),
  hundId TEXT REFERENCES Hund(id),
  art TEXT NOT NULL,
  antal INTEGER NOT NULL DEFAULT 1,
  kon TEXT CHECK (kon IS NULL OR kon IN ('hane', 'hona')),
  alder TEXT CHECK (alder IS NULL OR alder IN ('ungdjur', 'vuxen')),
  skytt TEXT,
  tidpunkt INTEGER NOT NULL,
  vikt REAL,
  kommentar TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_fallt_jaktdag ON FalltVilt(jaktdagId);
CREATE INDEX idx_fallt_drev ON FalltVilt(drevId);

ALTER TABLE Jaktdag ADD COLUMN anteckning TEXT;
`;
