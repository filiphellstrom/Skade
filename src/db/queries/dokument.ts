import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Dokument, DokumentFiltyp, DokumentTyp, UnixTimestamp, Uuid } from "../types";

/**
 * Dokument på profilen (migration 0005): jägarexamen, vapenlicens,
 * försäkring, övrigt. Filerna själva ligger i appens filmapp (se
 * src/utils/filer.ts) - här sparas bara filnamnet.
 */

export interface DokumentFalt {
  typ: DokumentTyp;
  namn: string;
  fil: string | null;
  filtyp: DokumentFiltyp | null;
  giltigTill: UnixTimestamp | null;
  paminnelseDagar: number;
}

/** Profilens dokument: de som går ut först överst, utan slutdatum sist. */
export async function hamtaDokumentForProfil(db: SQLiteDatabase, profilId: Uuid): Promise<Dokument[]> {
  return db.getAllAsync<Dokument>(
    `SELECT * FROM Dokument WHERE profilId = ?
     ORDER BY giltigTill IS NULL, giltigTill, namn COLLATE NOCASE`,
    [profilId],
  );
}

export async function hamtaDokument(db: SQLiteDatabase, id: Uuid): Promise<Dokument | null> {
  return (await db.getFirstAsync<Dokument>("SELECT * FROM Dokument WHERE id = ?", [id])) ?? null;
}

export async function skapaDokument(db: SQLiteDatabase, profilId: Uuid, f: DokumentFalt): Promise<Dokument> {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `INSERT INTO Dokument (id, profilId, typ, namn, fil, filtyp, giltigTill, paminnelseDagar, notisId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [id, profilId, f.typ, f.namn, f.fil, f.filtyp, f.giltigTill, f.paminnelseDagar, now, now],
  );
  return { id, profilId, ...f, notisId: null, createdAt: now, updatedAt: now };
}

export async function uppdateraDokument(db: SQLiteDatabase, id: Uuid, f: DokumentFalt): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync(
    `UPDATE Dokument SET typ = ?, namn = ?, fil = ?, filtyp = ?, giltigTill = ?, paminnelseDagar = ?, updatedAt = ?
     WHERE id = ?`,
    [f.typ, f.namn, f.fil, f.filtyp, f.giltigTill, f.paminnelseDagar, now, id],
  );
}

/** Id på den schemalagda påminnelsen (eller null), se src/utils/paminnelser.ts. */
export async function sattDokumentNotis(db: SQLiteDatabase, id: Uuid, notisId: string | null): Promise<void> {
  await db.runAsync("UPDATE Dokument SET notisId = ? WHERE id = ?", [notisId, id]);
}

export async function raderaDokument(db: SQLiteDatabase, id: Uuid): Promise<void> {
  await db.runAsync("DELETE FROM Dokument WHERE id = ?", [id]);
}
