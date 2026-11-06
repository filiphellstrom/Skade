import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Jaktmark, Kartpunkt, Uuid } from "../types";
import { hittaGrans, punktNyckel } from "../../vind/gpx";
import type { GpxInnehall } from "../../vind/gpx";

/**
 * Migration 0009: kartpunkter och jaktmarksgräns, importerade från GPX
 * (t.ex. WeHunts "map-export.gpx"). Koordinater och kategorier sparas
 * exakt som i filen. Samma fil kan importeras igen utan att något
 * dubbleras: befintliga punkter (samma kategori, namn och position på
 * ~1 m) hoppas över.
 */

export interface ImportResultat {
  nya: number;
  redanFanns: number;
  dubbletterIFilen: number;
  gransImporterad: boolean;
}

export async function importeraGpx(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
  innehall: GpxInnehall,
): Promise<ImportResultat> {
  const now = Math.floor(Date.now() / 1000);
  const befintliga = await db.getAllAsync<Kartpunkt>(
    "SELECT * FROM Kartpunkt WHERE jaktmarkId = ?",
    [jaktmarkId],
  );
  const nycklar = new Set(befintliga.map(punktNyckel));
  let nya = 0;
  let redanFanns = 0;
  const grans = hittaGrans(innehall.spar);

  await db.withTransactionAsync(async () => {
    for (const p of innehall.punkter) {
      const nyckel = punktNyckel(p);
      if (nycklar.has(nyckel)) {
        redanFanns++;
        continue;
      }
      nycklar.add(nyckel);
      await db.runAsync(
        `INSERT OR IGNORE INTO Kartpunkt (id, jaktmarkId, namn, typ, lat, lon, kalla, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'gpx', ?, ?)`,
        [randomUUID(), jaktmarkId, p.namn, p.typ, p.lat, p.lon, now, now],
      );
      nya++;
    }
    if (grans) {
      const json = JSON.stringify(grans.punkter.map((q) => [q.latitude, q.longitude]));
      await db.runAsync("UPDATE Jaktmark SET grans = ?, updatedAt = ? WHERE id = ?", [
        json,
        now,
        jaktmarkId,
      ]);
      // Saknar marken position (för vädret) tas gränsens mitt, avrundad
      // till ~1 km som alltid.
      const lat = grans.punkter.reduce((s, q) => s + q.latitude, 0) / grans.punkter.length;
      const lon = grans.punkter.reduce((s, q) => s + q.longitude, 0) / grans.punkter.length;
      await db.runAsync(
        "UPDATE Jaktmark SET lat = ?, lon = ? WHERE id = ? AND (lat IS NULL OR lon IS NULL)",
        [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100, jaktmarkId],
      );
    }
  });

  return {
    nya,
    redanFanns,
    dubbletterIFilen: innehall.dubbletterIFilen,
    gransImporterad: !!grans,
  };
}

/** Tar bort importerade kartpunkter och gränsen för en jaktmark. */
export async function raderaKartdata(db: SQLiteDatabase, jaktmarkId: Uuid): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM Kartpunkt WHERE jaktmarkId = ?", [jaktmarkId]);
    await db.runAsync("UPDATE Jaktmark SET grans = NULL, updatedAt = ? WHERE id = ?", [
      now,
      jaktmarkId,
    ]);
  });
}

export async function antalKartpunkter(db: SQLiteDatabase, jaktmarkId: Uuid): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM Kartpunkt WHERE jaktmarkId = ?",
    [jaktmarkId],
  );
  return r?.n ?? 0;
}

export interface Kartdata {
  jaktmark: Jaktmark;
  grans: { latitude: number; longitude: number }[];
  punkter: Kartpunkt[];
}

function tolkaGransJson(json: string | null): Kartdata["grans"] {
  if (!json) return [];
  try {
    const lista = JSON.parse(json) as unknown;
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .map(([latitude, longitude]) => ({ latitude, longitude }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  } catch {
    return [];
  }
}

/** Alla jaktmarker för profilen som har en gräns eller kartpunkter. */
export async function hamtaKartdata(db: SQLiteDatabase, profilId: Uuid): Promise<Kartdata[]> {
  const marker = await db.getAllAsync<Jaktmark>(
    `SELECT m.* FROM Jaktmark m
     WHERE m.profilId = ?
       AND (m.grans IS NOT NULL OR EXISTS (SELECT 1 FROM Kartpunkt k WHERE k.jaktmarkId = m.id))
     ORDER BY m.namn ASC`,
    [profilId],
  );
  const ut: Kartdata[] = [];
  for (const m of marker) {
    const punkter = await db.getAllAsync<Kartpunkt>(
      "SELECT * FROM Kartpunkt WHERE jaktmarkId = ? ORDER BY namn ASC",
      [m.id],
    );
    ut.push({ jaktmark: m, grans: tolkaGransJson(m.grans), punkter });
  }
  return ut;
}
