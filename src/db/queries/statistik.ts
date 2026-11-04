import type { SQLiteDatabase } from "expo-sqlite";
import { hamtaHandelserForProfil } from "./handelse";
import { soktid, tapptTid } from "../../utils/drevhandelser";
import { FORE_VAL, temperaturIntervall } from "../../utils/vader";
import type {
  Drev,
  DrevHandelse,
  Fore,
  Snittpost,
  UtokadHundStatistik,
  DrevMedHundnamn,
  Fordelningspost,
  HundStatistik,
  JaktdagMedSummering,
  UnixTimestamp,
  Uuid,
} from "../types";

/**
 * Sprint 3 (historik): frågor för loggen (app/historik/index.tsx +
 * [jaktdagId].tsx) och statistikvyn (app/historik/statistik.tsx). Egen
 * fil istället för att breda ut hund.ts/jaktdag.ts/drev.ts ytterligare -
 * de här frågorna är läsvägar över flera tabeller, inte grundläggande
 * CRUD för en specifik entitet.
 *
 * `intervall` (valfritt på de frågor som stödjer periodfiltret) är ett
 * [fran, till)-intervall i unix-sekunder, räknat ut av
 * periodTillIntervall() i src/utils/period.ts - null/utelämnat betyder
 * inget filter alls.
 */

interface Intervall {
  fran: UnixTimestamp;
  till: UnixTimestamp;
}

/**
 * Avslutade jaktdagar (nyast först) med antal drev och total drevtid per
 * dag - loggens listvy. LEFT JOIN så en avslutad jaktdag utan några drev
 * alls (t.ex. avslutad direkt utan att ha startat något) fortfarande
 * dyker upp, med 0/0. Periodfiltret filtrerar på jaktdagens EGET datum
 * (j.datum), inte på de enskilda drevens tider.
 */
export async function hamtaAvslutadeJaktdagarForProfil(
  db: SQLiteDatabase,
  profilId: Uuid,
  intervall?: Intervall,
): Promise<JaktdagMedSummering[]> {
  const villkor = intervall ? "AND j.datum >= ? AND j.datum < ?" : "";
  const params = intervall
    ? [profilId, intervall.fran, intervall.till]
    : [profilId];

  return db.getAllAsync<JaktdagMedSummering>(
    `SELECT
       j.id, j.profilId, j.datum, j.jaktmarkId, m.namn AS jaktmark,
       j.aktivHundId, j.status, j.avslutadAt, j.createdAt, j.updatedAt,
       COUNT(d.id) AS antalDrev,
       COALESCE(SUM(d.duration), 0) AS totalDrevtid
     FROM Jaktdag j
     JOIN Jaktmark m ON m.id = j.jaktmarkId
     LEFT JOIN Drev d ON d.jaktdagId = j.id AND d.endTimestamp IS NOT NULL
     WHERE j.profilId = ? AND j.status = 'avslutad' ${villkor}
     GROUP BY j.id
     ORDER BY j.datum DESC, j.avslutadAt DESC`,
    params,
  );
}

/**
 * Alla drev för en jaktdag (även ett ev. oavslutat, om man skulle öppna
 * historiken för en jaktdag som ändå inte är klar) inklusive hundens
 * namn - jaktdag-detaljvyn.
 */
export async function hamtaDrevMedHundnamnForJaktdag(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<DrevMedHundnamn[]> {
  return db.getAllAsync<DrevMedHundnamn>(
    `SELECT d.*, h.namn AS hundNamn
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE d.jaktdagId = ?
     ORDER BY d.startTimestamp ASC`,
    [jaktdagId],
  );
}

/**
 * Statistik per hund: total drevtid, viltart- och utfall-fördelning.
 * Inkluderar ARKIVERADE hundar med vilje (arkivering döljer hunden från
 * de vanliga listorna men historiken ska fortfarande synas här, se
 * beslutet i hundhantering-viltart.md). Bara stoppade drev räknas
 * (endTimestamp IS NOT NULL) - ett pågående drev har varken duration
 * eller (oftast) viltart/utfall satt än.
 *
 * Tre separata frågor istället för en enda stor: grundsiffrorna
 * (antal/total) är en rak GROUP BY per hund, medan viltart/utfall
 * behöver en egen extra grupperingsdimension var - att slå ihop allt i
 * en fråga hade krävt korsprodukter mellan de två fördelningarna. Enklare
 * och tydligare att hämta var för sig och slå ihop i JS.
 *
 * Periodfiltret filtrerar här på det enskilda drevets EGET starttid
 * (d.startTimestamp), inte jaktdagens datum - mer exakt, och krävs ändå
 * inte någon extra JOIN eftersom frågorna redan går via Drev.
 */
export async function hamtaStatistikPerHund(
  db: SQLiteDatabase,
  profilId: Uuid,
  intervall?: Intervall,
): Promise<HundStatistik[]> {
  const villkor = intervall
    ? "AND d.startTimestamp >= ? AND d.startTimestamp < ?"
    : "";
  const params = intervall
    ? [profilId, intervall.fran, intervall.till]
    : [profilId];

  const grund = await db.getAllAsync<{
    hundId: Uuid;
    namn: string;
    antalDrev: number;
    totalDrevtid: number;
  }>(
    `SELECT h.id AS hundId, h.namn, COUNT(d.id) AS antalDrev, COALESCE(SUM(d.duration), 0) AS totalDrevtid
     FROM Hund h
     JOIN Drev d ON d.hundId = h.id AND d.endTimestamp IS NOT NULL
     WHERE h.profilId = ? ${villkor}
     GROUP BY h.id, h.namn
     ORDER BY totalDrevtid DESC`,
    params,
  );

  const viltart = await db.getAllAsync<{
    hundId: Uuid;
    namn: string;
    antal: number;
  }>(
    `SELECT d.hundId, COALESCE(NULLIF(TRIM(d.species), ''), 'Okänt') AS namn, COUNT(*) AS antal
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL ${villkor}
     GROUP BY d.hundId, namn
     ORDER BY antal DESC`,
    params,
  );

  const utfall = await db.getAllAsync<{
    hundId: Uuid;
    namn: string;
    antal: number;
  }>(
    `SELECT d.hundId, COALESCE(NULLIF(TRIM(d.outcome), ''), 'Okänt') AS namn, COUNT(*) AS antal
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL ${villkor}
     GROUP BY d.hundId, namn
     ORDER BY antal DESC`,
    params,
  );

  const grupperaPerHund = (
    rader: { hundId: Uuid; namn: string; antal: number }[],
  ) => {
    const karta = new Map<Uuid, Fordelningspost[]>();
    for (const rad of rader) {
      const lista = karta.get(rad.hundId) ?? [];
      lista.push({ namn: rad.namn, antal: rad.antal });
      karta.set(rad.hundId, lista);
    }
    return karta;
  };

  const viltartPerHund = grupperaPerHund(viltart);
  const utfallPerHund = grupperaPerHund(utfall);

  const utokad = await hamtaUtokadStatistik(db, profilId, intervall);

  return grund.map((rad) => ({
    hundId: rad.hundId,
    namn: rad.namn,
    antalDrev: rad.antalDrev,
    totalDrevtid: rad.totalDrevtid,
    viltartFordelning: viltartPerHund.get(rad.hundId) ?? [],
    utfallFordelning: utfallPerHund.get(rad.hundId) ?? [],
    utokad: utokad.get(rad.hundId) ?? tomUtokad(rad.totalDrevtid),
  }));
}

function tomUtokad(totalDrevtid: number): UtokadHundStatistik {
  return {
    effektivDrevtid: totalDrevtid,
    snittSoktid: null,
    antalMedSoktid: 0,
    antalTappt: 0,
    atertagsgrad: null,
    perFore: [],
    perTemperatur: [],
    antalFallt: 0,
    drevMedFallt: 0,
  };
}

type DrevForStatistik = Pick<
  Drev,
  "id" | "jaktdagId" | "hundId" | "startTimestamp" | "endTimestamp" | "duration"
> & {
  fore: Fore | null;
  temperatur: number | null;
  fallt: number;
};

/**
 * 2026-11-04: statistik över drevhändelser (söktid, tappt, effektiv
 * drevtid), väder/före (snittdrevtid per före och temperaturintervall)
 * och fällt vilt, per hund. Räknas i JS från rådata - samma funktioner
 * (src/utils/drevhandelser.ts) som timern och drevvyn använder.
 */
async function hamtaUtokadStatistik(
  db: SQLiteDatabase,
  profilId: Uuid,
  intervall?: Intervall,
): Promise<Map<Uuid, UtokadHundStatistik>> {
  const villkor = intervall
    ? "AND d.startTimestamp >= ? AND d.startTimestamp < ?"
    : "";
  const params = intervall
    ? [profilId, intervall.fran, intervall.till]
    : [profilId];

  const drev = await db.getAllAsync<DrevForStatistik>(
    `SELECT d.id, d.jaktdagId, d.hundId, d.startTimestamp, d.endTimestamp, d.duration,
            j.fore AS fore,
            (SELECT v.temperatur FROM Vader v WHERE v.drevId = d.id ORDER BY v.createdAt DESC LIMIT 1) AS temperatur,
            COALESCE((SELECT SUM(f.antal) FROM FalltVilt f WHERE f.drevId = d.id), 0) AS fallt
     FROM Drev d
     JOIN Jaktdag j ON j.id = d.jaktdagId
     WHERE j.profilId = ? AND d.endTimestamp IS NOT NULL ${villkor}
     ORDER BY d.startTimestamp ASC`,
    params,
  );
  if (drev.length === 0) {
    return new Map();
  }
  const handelser = await hamtaHandelserForProfil(db, profilId);

  const perJaktdag = new Map<Uuid, DrevHandelse[]>();
  for (const h of handelser) {
    const lista = perJaktdag.get(h.jaktdagId) ?? [];
    lista.push(h);
    perJaktdag.set(h.jaktdagId, lista);
  }
  const drevPerJaktdag = new Map<Uuid, DrevForStatistik[]>();
  for (const d of drev) {
    const lista = drevPerJaktdag.get(d.jaktdagId) ?? [];
    lista.push(d);
    drevPerJaktdag.set(d.jaktdagId, lista);
  }

  const snittposter = (
    grupper: Map<string, number[]>,
    ordning: string[],
  ): Snittpost[] =>
    ordning
      .filter((namn) => grupper.has(namn))
      .map((namn) => {
        const tider = grupper.get(namn) ?? [];
        return {
          namn,
          antal: tider.length,
          snitt: tider.reduce((a, b) => a + b, 0) / tider.length,
        };
      });

  const perHund = new Map<Uuid, DrevForStatistik[]>();
  for (const d of drev) {
    const lista = perHund.get(d.hundId) ?? [];
    lista.push(d);
    perHund.set(d.hundId, lista);
  }

  const resultat = new Map<Uuid, UtokadHundStatistik>();
  for (const [hundId, hundensDrev] of perHund) {
    let total = 0;
    let tappt = 0;
    let antalTappt = 0;
    let antalAtertag = 0;
    const soktider: number[] = [];
    const fore = new Map<string, number[]>();
    const temp = new Map<string, number[]>();
    let antalFallt = 0;
    let drevMedFallt = 0;

    for (const d of hundensDrev) {
      const dagens = perJaktdag.get(d.jaktdagId) ?? [];
      const egna = dagens.filter((h) => h.drevId === d.id);
      const tid = d.duration ?? 0;
      total += tid;
      tappt += tapptTid(egna, d.endTimestamp);
      antalTappt += egna.filter((h) => h.typ === "tappt").length;
      antalAtertag += egna.filter((h) => h.typ === "atertag").length;
      const s = soktid(d, dagens, drevPerJaktdag.get(d.jaktdagId) ?? []);
      if (s !== null) {
        soktider.push(s);
      }
      const foreTitel =
        FORE_VAL.find((f) => f.varde === d.fore)?.titel ?? "Inte angivet";
      fore.set(foreTitel, [...(fore.get(foreTitel) ?? []), tid]);
      const tempNamn = temperaturIntervall(d.temperatur);
      temp.set(tempNamn, [...(temp.get(tempNamn) ?? []), tid]);
      antalFallt += d.fallt;
      if (d.fallt > 0) {
        drevMedFallt += 1;
      }
    }

    resultat.set(hundId, {
      effektivDrevtid: Math.max(0, total - tappt),
      snittSoktid: soktider.length
        ? soktider.reduce((a, b) => a + b, 0) / soktider.length
        : null,
      antalMedSoktid: soktider.length,
      antalTappt,
      atertagsgrad:
        antalTappt > 0 ? Math.min(1, antalAtertag / antalTappt) : null,
      perFore: snittposter(fore, [
        ...FORE_VAL.map((f) => f.titel),
        "Inte angivet",
      ]),
      perTemperatur: snittposter(temp, [
        "Under −10°",
        "−10 till 0°",
        "0 till 10°",
        "Över 10°",
        "Okänd",
      ]),
      antalFallt,
      drevMedFallt,
    });
  }
  return resultat;
}
