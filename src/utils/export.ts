import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";
import { hamtaAllaDrevForExport } from "@/db/queries/export";
import type { UnixTimestamp, Uuid } from "@/db/types";
import { tillCsv } from "./csv";

function formateraDatumISO(ts: UnixTimestamp): string {
  const d = new Date(ts * 1000);
  const ar = d.getFullYear();
  const manad = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${ar}-${manad}-${dag}`;
}

function formateraKlockslag(ts: UnixTimestamp): string {
  const d = new Date(ts * 1000);
  const timme = String(d.getHours()).padStart(2, "0");
  const minut = String(d.getMinutes()).padStart(2, "0");
  return `${timme}:${minut}`;
}

/**
 * Exporterar ALL historik (alla stoppade drev, oavsett period) som en
 * CSV-fil - 2026-09-08, Filip: "All historik (alla drev)". En rad per
 * drev: Datum, Jaktmark, Hund, Start, Slut, Drevtid (min), Viltart,
 * Utfall. Drevtid anges i minuter med en decimal (istället för mm:ss som
 * i appens övriga vyer) - mer användbart att summera/snitta i ett
 * kalkylark. Tomma Viltart-/Utfall-fält lämnas som tomma celler, inte
 * "Okänt"-text som i statistikvyn - renare att filtrera/summera på i
 * Excel.
 *
 * Plattformsberoende sista steg (Platform.OS):
 * - **web** (appens enda skarpt testade och driftsatta plattform just nu,
 *   se claude/sprint-4-webbversion.md): en vanlig webbläsarnedladdning via
 *   en Blob och en tillfällig <a download>-länk. Testad end-to-end i en
 *   riktig webbläsare (Playwright) - filen laddas ner med rätt innehåll.
 * - **ios/android**: skriver till en temporär fil (expo-file-system, nya
 *   File/Paths-API:et i SDK 54 - INTE det gamla
 *   FileSystem.writeAsStringAsync/cacheDirectory, som är flyttat till
 *   `expo-file-system/legacy` i den här SDK-versionen) och öppnar
 *   systemets delningsruta (expo-sharing) - OTESTAT på riktig enhet
 *   eftersom det ännu inte finns något EAS-bygge av appen (se
 *   diskussionen om Apple Developer-konto/EAS Build i chatten). Koden
 *   följer expo-file-systems dokumenterade API rakt av, men flagga gärna
 *   om något inte fungerar första gången det provas i en riktig build.
 */
export async function exporteraHistorikSomCsv(
  db: SQLiteDatabase,
  profilId: Uuid,
): Promise<void> {
  const rader = await hamtaAllaDrevForExport(db, profilId);

  const csv = tillCsv(
    ["Datum", "Jaktmark", "Hund", "Start", "Slut", "Drevtid (min)", "Viltart", "Utfall"],
    rader.map((r) => [
      formateraDatumISO(r.datum),
      r.jaktmark,
      r.hundNamn,
      formateraKlockslag(r.startTimestamp),
      formateraKlockslag(r.endTimestamp),
      (r.duration / 60).toFixed(1),
      r.species ?? "",
      r.outcome ?? "",
    ]),
  );

  const filnamn = `skade-historik-${formateraDatumISO(Math.floor(Date.now() / 1000))}.csv`;

  if (Platform.OS === "web") {
    laddaNerPaWeb(csv, filnamn);
    return;
  }

  const file = new File(Paths.cache, filnamn);
  file.write(csv);

  const kanDela = await Sharing.isAvailableAsync();
  if (!kanDela) {
    throw new Error("Delning stöds inte på den här enheten.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Dela historik",
  });
}

/**
 * BOM (`﻿`) först i filen så Excel på Windows känner igen den som
 * UTF-8 och visar å/ä/ö rätt istället för att gissa fel teckenkodning -
 * ett vanligt Excel-specifikt problem med rena UTF-8-CSV:er utan BOM.
 */
function laddaNerPaWeb(csv: string, filnamn: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const lank = document.createElement("a");
  lank.href = url;
  lank.download = filnamn;
  document.body.appendChild(lank);
  lank.click();
  document.body.removeChild(lank);
  URL.revokeObjectURL(url);
}
