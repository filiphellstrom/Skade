/**
 * Migration 0010 – hundspår från Garmin (2026-11-07).
 *
 * Spar: GPS-spår importerade från en Garmin-handenhets GPX-export
 * (Alpha 100 och nyare, se src/spar/hundspar.ts).
 * - typ 'hund': halsbandets punkter under ett drev (från släpp till
 *   drevslut). drevId och hundId satta - hunden kommer från DREVET, inte
 *   från halsbandets namn (samma halsband kan bäras av olika hundar).
 * - typ 'forare': förarens eget spår ("Aktuellt spår") för jaktdagen.
 * - typ 'halsband': ett halsbands hela spår för jaktdagen, också utanför
 *   dreven (för kartan och för att kunna föreslå drev senare).
 * `maxAvstandMeter` (typ 'hund'): hundens största avstånd från föraren
 * under drevet, NULL utan förarspår. `halsband` = spårets namn i filen. `punkter` = JSON [[lat, lon, t], …]
 * (6 decimaler, t i Unix-sekunder). Exakta positioner - lämnar aldrig
 * telefonen. En ny import för samma drev/jaktdag ersätter den gamla.
 */
export const sql = `
CREATE TABLE Spar (
  id TEXT PRIMARY KEY,
  jaktdagId TEXT NOT NULL REFERENCES Jaktdag(id),
  drevId TEXT REFERENCES Drev(id),
  hundId TEXT REFERENCES Hund(id),
  typ TEXT NOT NULL CHECK (typ IN ('hund', 'forare', 'halsband')),
  halsband TEXT NOT NULL DEFAULT '',
  startTid INTEGER NOT NULL,
  slutTid INTEGER NOT NULL,
  antalPunkter INTEGER NOT NULL,
  strackaMeter REAL NOT NULL,
  maxAvstandMeter REAL,
  punkter TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_spar_jaktdag ON Spar(jaktdagId);
CREATE INDEX idx_spar_drev ON Spar(drevId);
`;
