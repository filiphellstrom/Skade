import type { SQLiteDatabase } from "expo-sqlite";
import type {
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
       j.*,
       COUNT(d.id) AS antalDrev,
       COALESCE(SUM(d.duration), 0) AS totalDrevtid
     FROM Jaktdag j
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

  const viltart = await db.getAllAsync<{ hundId: Uuid; namn: string; antal: number }>(
    `SELECT d.hundId, COALESCE(NULLIF(TRIM(d.species), ''), 'Okänt') AS namn, COUNT(*) AS antal
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL ${villkor}
     GROUP BY d.hundId, namn
     ORDER BY antal DESC`,
    params,
  );

  const utfall = await db.getAllAsync<{ hundId: Uuid; namn: string; antal: number }>(
    `SELECT d.hundId, COALESCE(NULLIF(TRIM(d.outcome), ''), 'Okänt') AS namn, COUNT(*) AS antal
     FROM Drev d
     JOIN Hund h ON h.id = d.hundId
     WHERE h.profilId = ? AND d.endTimestamp IS NOT NULL ${villkor}
     GROUP BY d.hundId, namn
     ORDER BY antal DESC`,
    params,
  );

  const grupperaPerHund = (rader: { hundId: Uuid; namn: string; antal: number }[]) => {
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

  return grund.map((rad) => ({
    hundId: rad.hundId,
    namn: rad.namn,
    antalDrev: rad.antalDrev,
    totalDrevtid: rad.totalDrevtid,
    viltartFordelning: viltartPerHund.get(rad.hundId) ?? [],
    utfallFordelning: utfallPerHund.get(rad.hundId) ?? [],
  }));
}
