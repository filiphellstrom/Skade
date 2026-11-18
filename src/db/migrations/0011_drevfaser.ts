/**
 * Migration 0011 – faser i drevet (2026-11-18).
 *
 * Timern får knapparna Upptag, Starta drev och Återgång, som fungerar som
 * start/varv: valfri av dem startar drevet och varje tryck därefter
 * börjar en ny fas. Faserna sparas som drevhändelser med drevId satt
 * (typ 'upptag', 'drev', 'atergang'). En fas varar till nästa fas eller
 * till drevslut. Ett drev utan fashändelser (till exempel startat från
 * låsskärmen) räknas som drev hela tiden.
 *
 * SQLite kan inte ändra en CHECK-regel, så tabellen byggs om med samma
 * kolumner och index. Drev-tabellen rörs inte, så Swift-koden för
 * låsskärmen behöver inga ändringar.
 */
export const sql = `
CREATE TABLE DrevHandelse_ny (
  id TEXT PRIMARY KEY,
  jaktdagId TEXT NOT NULL REFERENCES Jaktdag(id),
  hundId TEXT NOT NULL REFERENCES Hund(id),
  drevId TEXT REFERENCES Drev(id),
  typ TEXT NOT NULL CHECK (typ IN ('slapp', 'tappt', 'atertag', 'kopplad', 'upptag', 'drev', 'atergang')),
  tidpunkt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

INSERT INTO DrevHandelse_ny (id, jaktdagId, hundId, drevId, typ, tidpunkt, createdAt, updatedAt)
  SELECT id, jaktdagId, hundId, drevId, typ, tidpunkt, createdAt, updatedAt FROM DrevHandelse;

DROP TABLE DrevHandelse;
ALTER TABLE DrevHandelse_ny RENAME TO DrevHandelse;

CREATE INDEX idx_handelse_jaktdag ON DrevHandelse(jaktdagId);
CREATE INDEX idx_handelse_drev ON DrevHandelse(drevId);
CREATE INDEX idx_handelse_hund ON DrevHandelse(hundId);
`;
