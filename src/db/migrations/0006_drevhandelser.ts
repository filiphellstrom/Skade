/**
 * Migration 0006 – drevhändelser (2026-11-04).
 *
 * Upptag och drevslut finns redan som Drev.startTimestamp/endTimestamp.
 * Här tillkommer händelserna runt och inuti drevet:
 * - slapp: hunden släpps (drevId NULL). Söktid = upptag - senaste släpp.
 * - tappt / atertag: inuti ett drev (drevId satt). Tappttid räknas fram
 *   ur händelserna vid läsning - INTE som en kolumn på Drev, eftersom
 *   låsskärmens Stoppa-knapp (targets/widget/_shared/SkadeJaktdagDatabas.swift)
 *   skriver Drev direkt och inte vet något om händelserna.
 * - kopplad: hunden kopplas/tas in (drevId NULL), avslutar "Söker".
 *
 * Bara en ny tabell - Drev-tabellen rörs inte, så Swift-koden behöver
 * inga ändringar.
 */
export const sql = `
CREATE TABLE DrevHandelse (
  id TEXT PRIMARY KEY,
  jaktdagId TEXT NOT NULL REFERENCES Jaktdag(id),
  hundId TEXT NOT NULL REFERENCES Hund(id),
  drevId TEXT REFERENCES Drev(id),
  typ TEXT NOT NULL CHECK (typ IN ('slapp', 'tappt', 'atertag', 'kopplad')),
  tidpunkt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_handelse_jaktdag ON DrevHandelse(jaktdagId);
CREATE INDEX idx_handelse_drev ON DrevHandelse(drevId);
CREATE INDEX idx_handelse_hund ON DrevHandelse(hundId);
`;
