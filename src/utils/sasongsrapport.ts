import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";
import { hamtaFalltViltForProfil, type FalltViltRad } from "@/db/queries/fallt";
import { hamtaStatistikPerHund } from "@/db/queries/statistik";
import type { Uuid } from "@/db/types";
import { formateraVaraktighet } from "@/utils/format";
import { INDIVIDRAPPORTERAS, VILTARTER } from "@/utils/vilt";

/**
 * Säsongsrapport per jaktår (1 juli-30 juni), 2026-11-04. Underlag för
 * jaktlagets rapportör att föra in i Viltdata (inget öppet API finns, så
 * ingen direktkoppling). HTML som blir PDF via expo-print och delas med
 * expo-sharing. På webben öppnas utskriftsdialogen i stället.
 */

export interface Jaktar {
  /** Startåret, t.ex. 2026 för jaktåret 2026/27. */
  ar: number;
  fran: number;
  till: number;
  namn: string;
}

export function jaktar(startAr: number): Jaktar {
  return {
    ar: startAr,
    fran: Math.floor(new Date(startAr, 6, 1).getTime() / 1000),
    till: Math.floor(new Date(startAr + 1, 6, 1).getTime() / 1000),
    namn: `${startAr}/${String((startAr + 1) % 100).padStart(2, "0")}`,
  };
}

/** Jaktåret som pågår just nu (före 1 juli = jaktåret som började förra året). */
export function innevarandeJaktar(nu = new Date()): Jaktar {
  return jaktar(nu.getMonth() >= 6 ? nu.getFullYear() : nu.getFullYear() - 1);
}

const esc = (t: string | null | undefined) =>
  (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const datum = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });

interface Anteckning {
  datum: number;
  jaktmark: string;
  anteckning: string;
}

async function hamtaAnteckningar(db: SQLiteDatabase, profilId: Uuid, j: Jaktar): Promise<Anteckning[]> {
  return db.getAllAsync<Anteckning>(
    `SELECT j.datum AS datum, m.namn AS jaktmark, j.anteckning AS anteckning
     FROM Jaktdag j JOIN Jaktmark m ON m.id = j.jaktmarkId
     WHERE j.profilId = ? AND j.anteckning IS NOT NULL AND j.datum >= ? AND j.datum < ?
     ORDER BY j.datum ASC`,
    [profilId, j.fran, j.till],
  );
}

export async function byggSasongsrapportHtml(
  db: SQLiteDatabase,
  profilId: Uuid,
  profilNamn: string,
  j: Jaktar,
): Promise<string> {
  const intervall = { fran: j.fran, till: j.till };
  const [fallt, hundar, anteckningar] = await Promise.all([
    hamtaFalltViltForProfil(db, profilId, intervall),
    hamtaStatistikPerHund(db, profilId, intervall),
    hamtaAnteckningar(db, profilId, j),
  ]);

  const individer = fallt.filter((f) => INDIVIDRAPPORTERAS.includes(f.art));
  const ovrigt = fallt.filter((f) => !INDIVIDRAPPORTERAS.includes(f.art));
  const perArt = new Map<string, number>();
  for (const f of ovrigt) {
    perArt.set(f.art, (perArt.get(f.art) ?? 0) + f.antal);
  }
  const artOrdning = [...VILTARTER, ...[...perArt.keys()].filter((a) => !VILTARTER.includes(a)).sort()];

  const individRad = (f: FalltViltRad) => `<tr>
    <td>${datum(f.tidpunkt)}</td><td>${esc(f.art)}</td><td>${esc(f.jaktmark)}</td>
    <td>${f.kon === "hane" ? "Hane" : f.kon === "hona" ? "Hona" : "–"}</td>
    <td>${f.alder === "ungdjur" ? "Ungdjur" : f.alder === "vuxen" ? "Vuxen" : "–"}</td>
    <td class="tal">${f.antal}</td>
    <td class="tal">${f.vikt !== null ? String(f.vikt).replace(".", ",") : "–"}</td>
    <td>${esc(f.skytt) || "–"}</td></tr>`;

  return `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #14201b; margin: 32px; font-size: 12px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #1f4d3a; }
  h2 { font-size: 15px; margin: 24px 0 8px; color: #1f4d3a; }
  p.under { color: #55635c; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #d5ddd8; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #55635c; }
  td.tal, th.tal { text-align: right; font-variant-numeric: tabular-nums; }
  .tom { color: #55635c; font-style: italic; }
  .anteckning { white-space: pre-wrap; }
  footer { margin-top: 32px; color: #55635c; font-size: 10px; }
</style></head><body>
<h1>Säsongsrapport ${esc(j.namn)}</h1>
<p class="under">${esc(profilNamn)} · jaktåret 1 juli ${j.ar}–30 juni ${j.ar + 1}</p>

<h2>Älg och kronhjort (per individ)</h2>
${
  individer.length
    ? `<table><tr><th>Datum</th><th>Art</th><th>Jaktmark</th><th>Kön</th><th>Ålder</th><th class="tal">Antal</th><th class="tal">Vikt (kg)</th><th>Skytt</th></tr>${individer.map(individRad).join("")}</table>`
    : `<p class="tom">Inget fällt.</p>`
}

<h2>Övrigt vilt (årssammanställning)</h2>
${
  perArt.size
    ? `<table><tr><th>Art</th><th class="tal">Antal</th></tr>${artOrdning
        .filter((a) => perArt.has(a))
        .map((a) => `<tr><td>${esc(a)}</td><td class="tal">${perArt.get(a)}</td></tr>`)
        .join("")}</table>`
    : `<p class="tom">Inget fällt.</p>`
}

<h2>Hundarna</h2>
${
  hundar.length
    ? `<table><tr><th>Hund</th><th class="tal">Drev</th><th class="tal">Drevtid</th><th class="tal">Effektiv drevtid</th><th class="tal">Drev med fällt vilt</th></tr>${hundar
        .map(
          (h) => `<tr><td>${esc(h.namn)}</td><td class="tal">${h.antalDrev}</td>
          <td class="tal">${formateraVaraktighet(h.totalDrevtid)}</td>
          <td class="tal">${formateraVaraktighet(h.utokad.effektivDrevtid)}</td>
          <td class="tal">${h.utokad.drevMedFallt}</td></tr>`,
        )
        .join("")}</table>`
    : `<p class="tom">Inga drev.</p>`
}

<h2>Jaktdagbok</h2>
${
  anteckningar.length
    ? `<table>${anteckningar
        .map(
          (a) =>
            `<tr><td style="width:90px">${datum(a.datum)}</td><td style="width:120px">${esc(a.jaktmark)}</td><td class="anteckning">${esc(a.anteckning)}</td></tr>`,
        )
        .join("")}</table>`
    : `<p class="tom">Inga anteckningar.</p>`
}

<footer>Skapad med Skade ${datum(Math.floor(Date.now() / 1000))}. Underlag för rapportering i Viltdata – kontrollera mot jaktlagets egna uppgifter.</footer>
</body></html>`;
}

export async function delaSasongsrapport(
  db: SQLiteDatabase,
  profilId: Uuid,
  profilNamn: string,
  j: Jaktar,
): Promise<void> {
  const html = await byggSasongsrapportHtml(db, profilId, profilNamn, j);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Delning stöds inte på den här enheten.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Säsongsrapport ${j.namn}`,
  });
}
