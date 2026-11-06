import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import { soktid } from "../../utils/drevhandelser";
import type { DrevHandelse, DrevMedHundnamn, Spar, SparTyp, Uuid } from "../types";
import {
  dagensDel,
  fordelaPaDrev,
  maxAvstandFranForare,
  packa,
  stracka,
} from "../../spar/hundspar";
import type { DrevFonster, GarminFil, SparPunkt } from "../../spar/hundspar";

/**
 * Migration 0010: spår från Garmin (GPX från Alpha-handenheten), se
 * src/spar/hundspar.ts för reglerna. Allt för EN jaktdag åt gången: filer
 * med flera dagar (förarens "Current.gpx") ger bara den dagens del.
 * En ny import ersätter tidigare spår för samma drev, samma förare och
 * samma halsband - samma fil kan importeras igen.
 */

/** Spår utan punkterna (för listor och sammanfattningar). */
export type SparInfo = Omit<Spar, "punkter">;

export interface HundsparResultat {
  drevId: Uuid;
  hundNamn: string;
  startTimestamp: number;
  halsband: string;
  strackaMeter: number;
}

export interface SparImportResultat {
  hundspar: HundsparResultat[];
  /** Drev där flera halsband hade spår och inget hette som drevets hund. */
  oklara: { startTimestamp: number; hundNamn: string; halsband: string[] }[];
  /** Avslutade drev som inte fick något spår (halsbandet var inte med i filerna). */
  drevUtanSpar: number;
  forareSparad: boolean;
  halsbandSparade: string[];
  /** Filerna hade inga punkter alls på jaktdagens datum. */
  ingetPaDagen: boolean;
}

const KOLUMNER_UTAN_PUNKTER =
  "id, jaktdagId, drevId, hundId, typ, halsband, startTid, slutTid, antalPunkter, strackaMeter, maxAvstandMeter, createdAt, updatedAt";

export async function importeraSpar(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
  filer: GarminFil[],
): Promise<SparImportResultat> {
  const jaktdag = await db.getFirstAsync<{ datum: number }>("SELECT datum FROM Jaktdag WHERE id = ?", [
    jaktdagId,
  ]);
  if (!jaktdag) {
    throw new Error("Jaktdagen hittades inte.");
  }
  const allaDrev = await db.getAllAsync<DrevMedHundnamn>(
    `SELECT d.*, h.namn AS hundNamn FROM Drev d JOIN Hund h ON h.id = d.hundId
     WHERE d.jaktdagId = ? ORDER BY d.startTimestamp ASC`,
    [jaktdagId],
  );
  const handelser = await db.getAllAsync<DrevHandelse>(
    "SELECT * FROM DrevHandelse WHERE jaktdagId = ? ORDER BY tidpunkt ASC",
    [jaktdagId],
  );
  const avslutade = allaDrev.filter((d) => d.endTimestamp !== null);
  // Fönstret börjar vid släppet (söktiden), annars vid upptaget.
  const fonster: DrevFonster[] = avslutade.map((d) => ({
    id: d.id,
    hundId: d.hundId,
    hundNamn: d.hundNamn,
    fran: d.startTimestamp - (soktid(d, handelser, allaDrev) ?? 0),
    till: d.endTimestamp as number,
  }));

  const allaSpar = filer.flatMap((f) => f.spar);
  const halsband = allaSpar.filter((s) => !s.forare);
  const forarePunkter: SparPunkt[] = allaSpar
    .filter((s) => s.forare)
    .flatMap((s) => s.punkter)
    .sort((a, b) => a.t - b.t);

  // Jaktdagens dygn: datum är lokal midnatt.
  const dagStart = jaktdag.datum;
  const dagSlut = dagStart + 24 * 60 * 60 - 1;
  const forareDel = dagensDel(forarePunkter, dagStart, dagSlut, fonster);
  const halsbandDelar = halsband
    .map((h) => ({ namn: h.namn, punkter: dagensDel(h.punkter, dagStart, dagSlut, fonster) }))
    .filter((h) => h.punkter.length >= 5);
  const ingetPaDagen = forareDel.length === 0 && halsbandDelar.length === 0;

  const fordelning = fordelaPaDrev(halsband, fonster);
  const drevPerId = new Map(avslutade.map((d) => [d.id, d]));
  const now = Math.floor(Date.now() / 1000);

  const infoga = async (rad: {
    typ: SparTyp;
    drevId: Uuid | null;
    hundId: Uuid | null;
    halsband: string;
    punkter: SparPunkt[];
    maxAvstand: number | null;
  }) => {
    const p = rad.punkter;
    await db.runAsync(
      `INSERT INTO Spar (id, jaktdagId, drevId, hundId, typ, halsband, startTid, slutTid, antalPunkter,
         strackaMeter, maxAvstandMeter, punkter, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        jaktdagId,
        rad.drevId,
        rad.hundId,
        rad.typ,
        rad.halsband,
        p[0].t,
        p[p.length - 1].t,
        p.length,
        stracka(p),
        rad.maxAvstand,
        packa(p),
        now,
        now,
      ],
    );
  };

  const hundspar: HundsparResultat[] = [];
  await db.withTransactionAsync(async () => {
    for (const s of fordelning.drevSpar) {
      await db.runAsync("DELETE FROM Spar WHERE drevId = ? AND typ = 'hund'", [s.drevId]);
      await infoga({
        typ: "hund",
        drevId: s.drevId,
        hundId: s.hundId,
        halsband: s.halsband,
        punkter: s.punkter,
        maxAvstand: maxAvstandFranForare(s.punkter, forareDel),
      });
      const d = drevPerId.get(s.drevId);
      hundspar.push({
        drevId: s.drevId,
        hundNamn: d?.hundNamn ?? "",
        startTimestamp: d?.startTimestamp ?? 0,
        halsband: s.halsband,
        strackaMeter: stracka(s.punkter),
      });
    }
    if (forareDel.length >= 2) {
      await db.runAsync("DELETE FROM Spar WHERE jaktdagId = ? AND typ = 'forare'", [jaktdagId]);
      await infoga({ typ: "forare", drevId: null, hundId: null, halsband: "", punkter: forareDel, maxAvstand: null });
    }
    for (const h of halsbandDelar) {
      await db.runAsync("DELETE FROM Spar WHERE jaktdagId = ? AND typ = 'halsband' AND halsband = ?", [
        jaktdagId,
        h.namn,
      ]);
      await infoga({ typ: "halsband", drevId: null, hundId: null, halsband: h.namn, punkter: h.punkter, maxAvstand: null });
    }
  });

  return {
    hundspar,
    oklara: fordelning.oklara.map((o) => {
      const d = drevPerId.get(o.drevId);
      return { startTimestamp: d?.startTimestamp ?? 0, hundNamn: d?.hundNamn ?? "", halsband: o.halsband };
    }),
    drevUtanSpar: fordelning.utanSpar.length,
    forareSparad: forareDel.length >= 2,
    halsbandSparade: halsbandDelar.map((h) => h.namn),
    ingetPaDagen,
  };
}

/** Jaktdagens spår utan punkter, för sammanfattningar. */
export async function hamtaSparInfoForJaktdag(db: SQLiteDatabase, jaktdagId: Uuid): Promise<SparInfo[]> {
  return db.getAllAsync<SparInfo>(
    `SELECT ${KOLUMNER_UTAN_PUNKTER} FROM Spar WHERE jaktdagId = ? ORDER BY startTid ASC`,
    [jaktdagId],
  );
}

/** Jaktdagens spår med punkter, för kartan. */
export async function hamtaSparForJaktdag(db: SQLiteDatabase, jaktdagId: Uuid): Promise<Spar[]> {
  return db.getAllAsync<Spar>("SELECT * FROM Spar WHERE jaktdagId = ? ORDER BY startTid ASC", [jaktdagId]);
}

/** Drevets hundspår utan punkter, eller null. */
export async function hamtaHundsparInfoForDrev(db: SQLiteDatabase, drevId: Uuid): Promise<SparInfo | null> {
  const rad = await db.getFirstAsync<SparInfo>(
    `SELECT ${KOLUMNER_UTAN_PUNKTER} FROM Spar WHERE drevId = ? AND typ = 'hund' LIMIT 1`,
    [drevId],
  );
  return rad ?? null;
}

/** Tar bort alla spår för jaktdagen (dreven och allt annat rörs inte). */
export async function raderaSparForJaktdag(db: SQLiteDatabase, jaktdagId: Uuid): Promise<void> {
  await db.runAsync("DELETE FROM Spar WHERE jaktdagId = ?", [jaktdagId]);
}
