/**
 * Migration 0007 – väder och före (2026-11-04).
 *
 * - Vader: en rad per drev, hämtad från SMHI:s öppna prognos-API
 *   (snow1g v1, CC BY 4.0 - källan ska anges, se src/utils/vader.ts).
 *   Positionen avrundas till 2 decimaler (ca 1 km) innan den sparas.
 * - Jaktdag.fore: manuellt valt före för dagen (NULL = inte angivet).
 * - Jaktmark.lat/lon: jaktmarkens ungefärliga position, sätts
 *   automatiskt första gången appen får en position på marken och kan
 *   ändras i jaktmarksvyn.
 *
 * ADD COLUMN utan DEFAULT ger NULL på befintliga rader.
 */
export const sql = `
CREATE TABLE Vader (
  id TEXT PRIMARY KEY,
  jaktdagId TEXT NOT NULL REFERENCES Jaktdag(id),
  drevId TEXT REFERENCES Drev(id),
  tidpunkt INTEGER NOT NULL,
  temperatur REAL,
  vindHastighet REAL,
  vindByar REAL,
  vindRiktning INTEGER,
  nederbord REAL,
  kalla TEXT NOT NULL CHECK (kalla IN ('smhi', 'manuell')),
  lat REAL,
  lon REAL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_vader_jaktdag ON Vader(jaktdagId);
CREATE INDEX idx_vader_drev ON Vader(drevId);

ALTER TABLE Jaktdag ADD COLUMN fore TEXT
  CHECK (fore IS NULL OR fore IN ('barmark', 'frost', 'blott', 'sparsno', 'djupsno', 'skare'));
ALTER TABLE Jaktmark ADD COLUMN lat REAL;
ALTER TABLE Jaktmark ADD COLUMN lon REAL;
`;
