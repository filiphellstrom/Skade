-- Migration 0002 – jaktlag, jaktplaner, eftersök och chatt (2026-11-15).
-- Bara det som delas i ett jaktlag ligger här. Drev, hundar och dokument
-- stannar i telefonen. Tider är millisekunder sedan 1970 (som i appen).

CREATE TABLE jaktlag (
  id TEXT PRIMARY KEY NOT NULL,
  namn TEXT NOT NULL,
  -- Inbjudningskod (8 tecken). Den som har koden kan gå med. Kan bytas.
  kod TEXT NOT NULL UNIQUE,
  skapadAv TEXT REFERENCES user(id) ON DELETE SET NULL,
  skapad INTEGER NOT NULL,
  uppdaterad INTEGER NOT NULL
);

CREATE TABLE medlem (
  id TEXT PRIMARY KEY NOT NULL,
  jaktlagId TEXT NOT NULL REFERENCES jaktlag(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  roll TEXT NOT NULL CHECK (roll IN ('ansvarig', 'hundforare')),
  gickMed INTEGER NOT NULL,
  UNIQUE (jaktlagId, userId)
);
CREATE INDEX medlem_userId_idx ON medlem(userId);

-- En plan sparas som ett JSON-dokument (uppdrag, rutter, samling, jaktmarkens
-- gräns och pass). Bara ansvariga ändrar den, så hela dokumentet byts ut och
-- version räknas upp. status 'borttagen' finns kvar så att telefonerna märker det.
CREATE TABLE jaktplan (
  id TEXT PRIMARY KEY NOT NULL,
  jaktlagId TEXT NOT NULL REFERENCES jaktlag(id) ON DELETE CASCADE,
  namn TEXT NOT NULL,
  datum TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('utkast', 'publicerad', 'stangd', 'borttagen')),
  version INTEGER NOT NULL DEFAULT 1,
  innehall TEXT NOT NULL,
  skapadAv TEXT REFERENCES user(id) ON DELETE SET NULL,
  skapad INTEGER NOT NULL,
  uppdaterad INTEGER NOT NULL
);
CREATE INDEX jaktplan_lag_idx ON jaktplan(jaktlagId, uppdaterad);

CREATE TABLE eftersok (
  id TEXT PRIMARY KEY NOT NULL,
  jaktlagId TEXT NOT NULL REFERENCES jaktlag(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  viltart TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  skapadAv TEXT REFERENCES user(id) ON DELETE SET NULL,
  skapad INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('oppet', 'taget', 'avslutat')),
  tagetAv TEXT REFERENCES user(id) ON DELETE SET NULL,
  tagetHund TEXT NOT NULL DEFAULT '',
  tagetTid INTEGER,
  resultat TEXT CHECK (resultat IN ('hittat', 'inte_hittat', 'avbrutet')),
  avslutText TEXT NOT NULL DEFAULT '',
  avslutad INTEGER,
  uppdaterad INTEGER NOT NULL
);
CREATE INDEX eftersok_lag_idx ON eftersok(jaktlagId, uppdaterad);

CREATE TABLE meddelande (
  id TEXT PRIMARY KEY NOT NULL,
  jaktlagId TEXT NOT NULL REFERENCES jaktlag(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  skapad INTEGER NOT NULL,
  borttaget INTEGER NOT NULL DEFAULT 0,
  uppdaterad INTEGER NOT NULL
);
CREATE INDEX meddelande_lag_idx ON meddelande(jaktlagId, uppdaterad);

-- Apples krav för användarskapat innehåll: rapportera och blockera.
CREATE TABLE rapport (
  id TEXT PRIMARY KEY NOT NULL,
  meddelandeId TEXT NOT NULL REFERENCES meddelande(id) ON DELETE CASCADE,
  userId TEXT REFERENCES user(id) ON DELETE SET NULL,
  orsak TEXT NOT NULL DEFAULT '',
  skapad INTEGER NOT NULL,
  UNIQUE (meddelandeId, userId)
);

CREATE TABLE blockering (
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  blockeradUserId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  skapad INTEGER NOT NULL,
  PRIMARY KEY (userId, blockeradUserId)
);
