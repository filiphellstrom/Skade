/**
 * Migration 0009 – Vind och vittring (2026-11-06).
 *
 * - Jaktmark.grans: jaktmarkens gräns som JSON [[lat, lon], ...], exakt
 *   som i den importerade GPX-filen (WeHunt-export). NULL = ingen gräns.
 * - Kartpunkt: pass, torn och övriga markeringar på en jaktmark, från
 *   GPX. `typ` sparas oförändrad (WeHunts kategori, t.ex. "stand"),
 *   koordinaterna oavrundade. Unikt uttrycksindex på (jaktmark, typ,
 *   namn, position på ~1 m) skyddar mot dubbletter om samma fil
 *   importeras igen - appen kontrollerar först (queries/kartpunkt.ts).
 * - VindPrognos: varje hämtat prognossteg (vind) med källa, modellkörning
 *   och hämtningstid. Används som offline-cache för kartan och som
 *   historik, så att vinden kan kopplas till en jaktdag, ett drev eller
 *   ett upptag i efterhand (via jaktdagId/jaktmarkId och tiden). Inga
 *   FK-constraints på kopplingarna: historiken ska överleva att en
 *   jaktdag raderas (kopplingen nollas då, se raderaJaktdag()).
 *   Positionen är avrundad till 2 decimaler, som vädret per drev.
 */
export const sql = `
ALTER TABLE Jaktmark ADD COLUMN grans TEXT;

CREATE TABLE Kartpunkt (
  id TEXT PRIMARY KEY,
  jaktmarkId TEXT NOT NULL REFERENCES Jaktmark(id),
  namn TEXT NOT NULL DEFAULT '',
  typ TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  kalla TEXT NOT NULL DEFAULT 'gpx',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_kartpunkt_jaktmark ON Kartpunkt(jaktmarkId);
CREATE UNIQUE INDEX idx_kartpunkt_unik ON Kartpunkt(
  jaktmarkId, typ, namn, round(lat * 100000), round(lon * 100000)
);

CREATE TABLE VindPrognos (
  id TEXT PRIMARY KEY,
  kalla TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  rutLat REAL,
  rutLon REAL,
  referensTid INTEGER,
  publiceradTid INTEGER,
  hamtadAt INTEGER NOT NULL,
  tid INTEGER NOT NULL,
  vindRiktning REAL,
  medelvind REAL,
  byvind REAL,
  jaktdagId TEXT,
  jaktmarkId TEXT,
  createdAt INTEGER NOT NULL
);

CREATE INDEX idx_vindprognos_plats ON VindPrognos(kalla, lat, lon, hamtadAt);
CREATE INDEX idx_vindprognos_jaktdag ON VindPrognos(jaktdagId, tid);
CREATE INDEX idx_vindprognos_tid ON VindPrognos(tid);
`;
